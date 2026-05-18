from __future__ import annotations
from typing import List
from openai import OpenAI
from ingestion.embedder import search_chunks
from analyzers.base_analyzer import Finding

RAG_PROMPT = """You are a DevOps consultant AI agent analyzing a software repository.
Use ONLY the context below (infrastructure files + devops findings) to answer the question.
If the answer is not in the context, say "I don't have enough context from the repository to answer this." 

DevOps Findings:
{findings}

Infrastructure Files:
{infra}

Relevant Code Context:
{chunks}

Question: {question}

Answer concisely. Cite files when possible."""

class DevOpsAgent:
    def __init__(self):
        pass

    def answer(self, question: str, repo_id: str, parsed_repo, findings: List[Finding]) -> str:
        dev_findings = [f for f in findings if f.category == "devops"]
        findings_text = "\n".join(
            f"[{f.severity.upper()}] {f.title} — {f.file}: {f.description}"
            for f in dev_findings
        ) or "No devops findings detected."

        infra = []
        if getattr(parsed_repo, "docker_files", None):
            infra.append("Dockerfiles: " + ", ".join(parsed_repo.docker_files))
        if getattr(parsed_repo, "ci_cd_files", None):
            infra.append("CI/CD: " + ", ".join(parsed_repo.ci_cd_files))
        infra_text = "\n".join(infra) or "No infra files detected."

        chunks = search_chunks(repo_id, question, top_k=4)
        chunks_text = "\n\n".join(f"[{c['source']}]:\n{c['text']}" for c in chunks) or "No relevant code chunks found."

        return (
            "DevOps analysis fallback: "
            f"{len(dev_findings)} devops findings were detected. Infrastructure files include: {infra_text}. "
            "Look for missing Docker health checks, multi-stage builds, root users, exposed SSH ports, and CI/CD workflow hygiene."
        )
