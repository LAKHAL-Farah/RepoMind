from __future__ import annotations

import re
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from openai import OpenAI
from pydantic import BaseModel, Field

from api.state import _repo_store
from api.routes.ingest import _rehydrate_repo
from config import NVIDIA_API_KEY, NVIDIA_BASE_URL, NVIDIA_MODEL
from ingestion.embedder import search_chunks
from knowledge_graph.graph_queries import get_all_apis, get_all_services, get_repo_summary

router = APIRouter()

_nim_client = OpenAI(
    api_key=NVIDIA_API_KEY,
    base_url=NVIDIA_BASE_URL,
    timeout=90.0,
    max_retries=0,
)


class ChatRequest(BaseModel):
    repo_id: str
    question: str
    history: list[dict[str, str]] = Field(default_factory=list)


class ChatResponse(BaseModel):
    answer: str
    agent_used: str
    chunks_used: int
    sources: list[dict[str, Any]]


class SuggestionsResponse(BaseModel):
    suggestions: list[str]


def _normalize_findings(store_entry: dict) -> dict[str, list[dict]]:
    findings = store_entry.get("findings", {}) or {}
    if isinstance(findings, dict):
        return findings

    grouped = {"security": [], "devops": [], "architecture": [], "code_quality": []}
    for finding in findings:
        category = getattr(finding, "category", None) or getattr(finding, "kind", None) or "security"
        if category not in grouped:
            continue
        grouped[category].append(
            {
                "severity": getattr(finding, "severity", "info"),
                "title": getattr(finding, "title", ""),
                "description": getattr(finding, "description", ""),
                "file": getattr(finding, "file", ""),
            }
        )
    return grouped


def _service_names(services: list[Any]) -> list[str]:
    names: list[str] = []
    for service in services or []:
        if isinstance(service, dict):
            name = service.get("name")
        else:
            name = str(service)
        if name:
            names.append(str(name))
    return names


def _select_agent(question: str) -> str:
    question_lower = question.lower()
    if any(
        keyword in question_lower
        for keyword in ["secret", "cors", "jwt", "sql", "injection", "vulnerability", "auth", "password", "token", "security", "exploit", "attack", "unsafe"]
    ):
        return "Security"
    if any(
        keyword in question_lower
        for keyword in ["docker", "ci", "cd", "deploy", "container", "kubernetes", "k8s", "pipeline", "workflow", "image", "port", "health", "devops"]
    ):
        return "DevOps"
    if any(
        keyword in question_lower
        for keyword in ["service", "gateway", "architecture", "structure", "pattern", "layer", "microservice", "dependency", "design", "diagram"]
    ):
        return "Architecture"
    if any(
        keyword in question_lower
        for keyword in ["quality", "test", "coverage", "refactor", "debt", "clean", "complex", "naming", "duplicate", "smell", "lint"]
    ):
        return "CodeQuality"
    return "General"


def _format_chunks(chunks: list[dict]) -> str:
    if not chunks:
        return "No specific code context found for this question."
    parts: list[str] = []
    for index, chunk in enumerate(chunks, start=1):
        source = chunk.get("source", "unknown")
        score = float(chunk.get("score", 0.0) or 0.0)
        text = str(chunk.get("text", ""))[:400]
        parts.append(f"[Chunk {index} — {source} (relevance: {score:.2f})]\n{text}")
    return "\n\n".join(parts)


def _local_fallback_chunks(parsed, question: str, top_k: int = 6) -> list[dict]:
    question_terms = [term for term in re.findall(r"[a-zA-Z0-9_]+", question.lower()) if len(term) > 2]
    scored: list[tuple[int, str, Any]] = []
    for file_path in (getattr(parsed, "all_files", []) or [])[:120]:
        rel_path = str(file_path.relative_to(parsed.root)).replace("\\", "/")
        lowered = rel_path.lower()
        score = 0
        if any(term in lowered for term in question_terms):
            score += 3
        if file_path.name.lower() in question_terms:
            score += 2
        try:
            content = file_path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            content = ""
        if content:
            content_lower = content.lower()
            for term in question_terms:
                if term in content_lower:
                    score += 1
        if score > 0:
            scored.append((score, rel_path, file_path))

    if not scored:
        for file_path in (getattr(parsed, "all_files", []) or [])[:top_k]:
            rel_path = str(file_path.relative_to(parsed.root)).replace("\\", "/")
            try:
                content = file_path.read_text(encoding="utf-8", errors="ignore")[:600]
            except Exception:
                content = ""
            scored.append((0, rel_path, content))

    scored.sort(key=lambda item: (-item[0], item[1]))
    chunks: list[dict] = []
    for score, rel_path, file_source in scored[:top_k]:
        try:
            text = file_source.read_text(encoding="utf-8", errors="ignore") if hasattr(file_source, "read_text") else str(file_source)
        except Exception:
            text = str(file_source)
        chunks.append({
            "text": text[:800],
            "source": rel_path,
            "service": "local",
            "score": float(min(0.95, 0.35 + (score * 0.12))),
        })
    return chunks


def _build_system_prompt(parsed, services: list[str], apis: list[dict], graph_summary: dict, findings: dict[str, list[dict]], chunks: list[dict]) -> str:
    security_findings = findings.get("security", [])
    critical_count = len([f for f in security_findings if str(f.get("severity", "")).lower() == "critical"])
    warning_count = len([f for f in security_findings if str(f.get("severity", "")).lower() == "warning"])
    languages = (getattr(parsed, "languages", []) or ["Unknown"])[:5]
    service_text = ", ".join(services) if services else "None (flat/single-service repo)"
    chunk_text = _format_chunks(chunks)
    representative_files = [str(file_path.relative_to(parsed.root)).replace("\\", "/") for file_path in (getattr(parsed, "all_files", []) or [])[:25]]
    findings_preview = "\n".join(
        f"- [{finding.get('severity', 'info').upper()}] {finding.get('title', '')} — {finding.get('file', 'N/A')}: {finding.get('description', '')}"
        for finding in security_findings[:5]
    ) or "- No security findings captured yet"
    return (
        "You are an expert AI assistant specializing in software repository analysis.\n"
        "You have deep knowledge of the following repository and must answer questions\n"
        "about it accurately and concisely. Always reference specific files, services,\n"
        "or code patterns from the repository context when relevant.\n"
        "If the answer is not in the provided context, say so clearly — do not invent\n"
        "file names or code that does not exist in the repository.\n\n"
        "=== REPOSITORY OVERVIEW ===\n"
        f"Name: {getattr(parsed, 'name', 'Unknown')}\n"
        f"Languages: {', '.join(languages)}\n"
        f"Total files: {len(getattr(parsed, 'all_files', []))}\n"
        f"Services detected: {service_text}\n"
        f"APIs/routes detected: {len(apis)}\n"
        f"Security findings: {critical_count} critical, {warning_count} warnings\n"
        f"Graph summary: services={graph_summary.get('services', 0)}, apis={graph_summary.get('apis', 0)}, docker_files={graph_summary.get('docker_files', 0)}, ci_cd_files={graph_summary.get('ci_cd_files', 0)}\n\n"
        "=== DETECTED SERVICES ===\n"
        f"{chr(10).join(f'- {service}' for service in services) if services else '- Single service repository'}\n\n"
        "=== REPRESENTATIVE FILES ===\n"
        f"{chr(10).join(f'- {file_path}' for file_path in representative_files) if representative_files else '- No files detected'}\n\n"
        "=== SECURITY FINDINGS PREVIEW ===\n"
        f"{findings_preview}\n\n"
        "=== RELEVANT CODE CONTEXT ===\n"
        "The following code snippets from the repository are most relevant to the question:\n"
        f"{chunk_text}\n\n"
        "Answer the question below based on this context. Be specific and reference\n"
        "actual file names and code when possible. Keep answers concise (under 300 words)\n"
        "unless the user asks for detailed explanation."
    )


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    if req.repo_id not in _repo_store and not _rehydrate_repo(req.repo_id):
        raise HTTPException(status_code=404, detail="Repo not found. Ingest it first.")

    store_entry = _repo_store[req.repo_id]
    parsed = store_entry["parsed"]
    findings = _normalize_findings(store_entry)
    services = []
    apis: list[dict] = []
    graph_summary: dict[str, Any] = {}

    try:
        services = _service_names(get_all_services(req.repo_id))
        apis = list(get_all_apis(req.repo_id))
        graph_summary = get_repo_summary(req.repo_id)
    except Exception:
        services = []
        apis = []
        graph_summary = {}

    chunks = search_chunks(req.repo_id, req.question, top_k=6) or []
    if not chunks or all(chunk.get("source") == "fallback.txt" for chunk in chunks):
        chunks = _local_fallback_chunks(parsed, req.question, top_k=6)
    agent = _select_agent(req.question)
    system_prompt = _build_system_prompt(parsed, services, apis, graph_summary, findings, chunks)

    history = [message for message in (req.history or [])[-6:] if isinstance(message, dict) and message.get("role") and message.get("content")]
    messages = [{"role": "system", "content": system_prompt}, *history, {"role": "user", "content": req.question}]

    try:
        response = _nim_client.chat.completions.create(
            model=NVIDIA_MODEL,
            messages=messages,
            max_tokens=600,
            temperature=0.3,
        )
        answer = (response.choices[0].message.content or "").strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"NIM call failed: {str(e)}")

    return {
        "answer": answer,
        "agent_used": agent,
        "chunks_used": len(chunks),
        "sources": [{"file": chunk.get("source", ""), "score": round(float(chunk.get("score", 0.0) or 0.0), 3)} for chunk in chunks],
    }


@router.get("/chat/suggestions/{repo_id}", response_model=SuggestionsResponse)
def get_suggestions(repo_id: str):
    if repo_id not in _repo_store and not _rehydrate_repo(repo_id):
        raise HTTPException(status_code=404, detail="Repo not found")

    parsed = _repo_store[repo_id]["parsed"]
    findings = _normalize_findings(_repo_store[repo_id])
    has_security = len(findings.get("security", [])) > 0
    has_docker = len(getattr(parsed, "docker_files", []) or []) > 0
    has_ci = len(getattr(parsed, "ci_cd_files", []) or []) > 0
    services = getattr(parsed, "services", []) or []
    service_names = _service_names(services)

    prompt = (
        "Generate exactly 6 short, practical chat questions for a code repository assistant. "
        "Use only the repository facts below. Return one question per line, no numbering, no bullets.\n\n"
        f"Repository: {parsed.name}\n"
        f"Languages: {', '.join(getattr(parsed, 'languages', [])[:5] or ['Unknown'])}\n"
        f"Services: {', '.join(service_names) if service_names else 'single service'}\n"
        f"APIs/routes: {len(getattr(parsed, 'apis', []) or [])}\n"
        f"Docker files: {len(getattr(parsed, 'docker_files', []) or [])}\n"
        f"CI/CD files: {len(getattr(parsed, 'ci_cd_files', []) or [])}\n"
        f"Has security findings: {'yes' if has_security else 'no'}\n"
        f"Has docker: {'yes' if has_docker else 'no'}\n"
        f"Has ci: {'yes' if has_ci else 'no'}\n"
    )

    heuristic = [
        f"What does the {parsed.name} repository do?",
        "What are the main languages and frameworks used?",
        "Are there any security concerns in this codebase?" if not has_security else "What are the most critical security issues found?",
        "How is this application containerized?" if has_docker else "How is the codebase structured?",
        "How does the CI/CD pipeline work?" if has_ci else "How do the main services communicate with each other?",
        "What would you recommend to improve this codebase?",
    ]

    try:
        response = _nim_client.chat.completions.create(
            model=NVIDIA_MODEL,
            messages=[
                {"role": "system", "content": "You generate concise repository chat suggestions."},
                {"role": "user", "content": prompt},
            ],
            max_tokens=120,
            temperature=0.2,
        )
        text = (response.choices[0].message.content or "").strip()
        suggestions = [
            re.sub(r"^[\d\-\*\.\)\s]+", "", line).strip()
            for line in text.splitlines()
            if line.strip()
        ]
        suggestions = [suggestion for suggestion in suggestions if suggestion][:6]
        if suggestions:
            return {"suggestions": suggestions}
    except Exception:
        pass

    return {"suggestions": heuristic[:6]}
