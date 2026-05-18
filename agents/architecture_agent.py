from __future__ import annotations
from typing import List
from openai import OpenAI
from ingestion.embedder import search_chunks
from analyzers.base_analyzer import Finding
from knowledge_graph.graph_queries import get_all_services, get_all_apis

RAG_PROMPT = """You are a senior software architect AI.
Use ONLY the context below (architecture findings, service graph, relevant code) to answer.
If the answer is not in the context, say "I don't have enough context from the repository to answer this." 

Architecture Findings:
{findings}

Service Graph:
{graph}

Relevant Code:
{chunks}

Question: {question}

Answer concisely and reference services/files when applicable."""

class ArchitectureAgent:
    def __init__(self):
        pass

    def answer(
        self,
        question: str,
        repo_id: str,
        parsed_repo,
        findings: List[Finding],
        services_override: list[str] | None = None,
        apis_override: list[dict] | None = None,
    ) -> str:
        arch_findings = [f for f in findings if f.category == "architecture"]
        findings_text = "\n".join(
            f"[{f.severity.upper()}] {f.title} — {f.file}: {f.description}"
            for f in arch_findings
        ) or "No architecture findings detected."

        if services_override is not None:
            services = services_override
        else:
            try:
                services = get_all_services(repo_id)
            except Exception:
                services = []

        if apis_override is not None:
            apis = apis_override
        else:
            try:
                apis = get_all_apis(repo_id)
            except Exception:
                apis = []

        graph_text = f"Services: {services}\nAPIs: {apis}"

        chunks = search_chunks(repo_id, question, top_k=5)
        chunks_text = "\n\n".join(f"[{c['source']}]:\n{c['text']}" for c in chunks) or "No relevant code chunks found."

        # Fallback: if graph returned nothing, use parsed repo information
        used_services = services or getattr(parsed_repo, "services", [])
        used_apis = apis or getattr(parsed_repo, "apis", [])
        languages = getattr(parsed_repo, "languages", [])
        file_count = len(getattr(parsed_repo, "all_files", []))

        api_routes = [a.get("route") if isinstance(a, dict) else str(a) for a in used_apis]
        repo_name = getattr(parsed_repo, "name", repo_id)
        svc_list = used_services or [repo_name]

        return (
            "Architecture analysis fallback: "
            f"Repository '{repo_name}' contains {len(languages)} language(s) ({', '.join(languages)}), "
            f"{file_count} files, {len(svc_list)} service(s): {svc_list}. "
            f"Detected API routes: {api_routes if api_routes else 'none detected'}.")
