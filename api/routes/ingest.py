from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ingestion.github_fetcher import fetch_repo
from ingestion.repo_parser import parse_repo
from ingestion.chunker import chunk_file
from ingestion.embedder import store_chunks
from knowledge_graph.graph_builder import build_graph
from analyzers.security_analyzer import SecurityAnalyzer
from analyzers.devops_analyzer import DevOpsAnalyzer

router = APIRouter()

class IngestRequest(BaseModel):
    github_url: str

# In-memory store for demo; use Redis or a DB in production
_repo_store = {}

@router.post("/ingest")
def ingest_repo(req: IngestRequest):
    try:
        # 1. Clone
        repo_path = fetch_repo(req.github_url)
        repo_id = repo_path.name

        # 2. Parse
        parsed = parse_repo(repo_path)

        # 3. Chunk + Embed (all code files)
        all_chunks = []
        for f in parsed.all_files:
            service = next((s for s in parsed.services if s in str(f)), "root")
            all_chunks.extend(chunk_file(f, repo_path, service=service))
        chunk_count = store_chunks(repo_id, all_chunks)

        # 4. Build knowledge graph
        build_graph(repo_id, parsed)

        # 5. Run analyzers
        findings = []
        for Analyzer in [SecurityAnalyzer, DevOpsAnalyzer]:
            findings.extend(Analyzer().analyze(parsed))

        # Cache for chat route
        _repo_store[repo_id] = {"parsed": parsed, "findings": findings}

        return {
            "repo_id": repo_id,
            "services": parsed.services,
            "languages": parsed.languages,
            "chunk_count": chunk_count,
            "findings_count": len(findings),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))