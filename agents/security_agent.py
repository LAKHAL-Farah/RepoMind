from __future__ import annotations
from typing import List
from openai import OpenAI
from ingestion.embedder import search_chunks
from analyzers.base_analyzer import Finding

RAG_PROMPT = """You are a security auditor AI agent analyzing a software repository.
Use ONLY the context below (retrieved code + security findings) to answer the question.
If the answer is not in the context, say "I don't have enough context from the repository to answer this."

Security Findings:
{findings}

Relevant Code Context:
{chunks}

Question: {question}

Answer concisely. Cite the relevant file when possible."""

class SecurityAgent:
    def __init__(self):
        pass

    def answer(self, question: str, repo_id: str, parsed_repo, findings: List[Finding]) -> str:
        # Filter relevant findings
        sec_findings = [f for f in findings if f.category == "security"]
        findings_text = "\n".join(
            f"[{f.severity.upper()}] {f.title} — {f.file}: {f.description}"
            for f in sec_findings
        ) or "No security findings detected."

        # Retrieve relevant code chunks
        chunks = search_chunks(repo_id, question, top_k=4)
        chunks_text = "\n\n".join(
            f"[{c['source']}]\n{c['text']}" for c in chunks
        ) or "No relevant code chunks found."

        return (
            "Security analysis fallback: "
            f"{len(sec_findings)} security findings were detected, and {len(chunks)} relevant code chunks were found. "
            f"Relevant files include: {', '.join(sorted({f.file for f in sec_findings})[:4]) or 'none'}. "
            "Please review the repository context for potential hardcoded secrets, insecure CORS, SQL injection risk, and JWT misuse."
        )