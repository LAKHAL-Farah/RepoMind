from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ingestion.github_fetcher import fetch_repo
from ingestion.repo_parser import parse_repo
from ingestion.chunker import chunk_file
from ingestion.embedder import store_chunks
from knowledge_graph.graph_builder import build_graph
from analyzers.security_analyzer import SecurityAnalyzer
from analyzers.devops_analyzer import DevOpsAnalyzer
from analyzers.architecture_analyzer import ArchitectureAnalyzer
from analyzers.code_quality_analyzer import CodeQualityAnalyzer
from knowledge_graph.graph_queries import get_repo_summary, get_all_services, get_all_apis
import os
from collections import Counter
from datetime import datetime
from config import REPOS_CACHE_DIR
from api.state import _repo_store

router = APIRouter()

_github_store = {}


def _rehydrate_repo(repo_id: str) -> bool:
    if repo_id in _repo_store:
        return True

    repo_path = REPOS_CACHE_DIR / repo_id
    if not repo_path.exists():
        return False

    parsed = parse_repo(repo_path)
    findings = []
    for Analyzer in [SecurityAnalyzer, DevOpsAnalyzer, ArchitectureAnalyzer, CodeQualityAnalyzer]:
        findings.extend(Analyzer().analyze(parsed))

    _repo_store[repo_id] = {
        "parsed": parsed,
        "findings": findings,
        "chunk_count": 0,
        "ingested_at": datetime.utcnow().isoformat(),
        "github_url": None,
    }
    return True


def _service_for_file(parsed, file_path):
    relative_path = str(file_path.relative_to(parsed.root)).replace("\\", "/")
    best_service = None
    best_length = -1
    for service in parsed.services:
        service_path = service.get("path") or ""
        if not service_path or service_path == ".":
            continue
        normalized_path = service_path.replace("\\", "/").strip("/")
        if relative_path == normalized_path or relative_path.startswith(f"{normalized_path}/"):
            if len(normalized_path) > best_length:
                best_length = len(normalized_path)
                best_service = service
    return best_service


class IngestRequest(BaseModel):
    github_url: str

@router.post("/ingest")
def ingest_repo(req: IngestRequest):
    try:
        if req.github_url in _github_store:
            return _github_store[req.github_url]

        # 1. Clone
        repo_path = fetch_repo(req.github_url)
        repo_id = repo_path.name

        # 2. Parse
        parsed = parse_repo(repo_path)

        # 3. Chunk + Embed every parsed file
        all_chunks = []
        files_to_chunk = parsed.all_files
        total_files = len(files_to_chunk)
        for index, f in enumerate(files_to_chunk, start=1):
            print(f"Chunking file {index} of {total_files}: {f}")
            service = _service_for_file(parsed, f)
            all_chunks.extend(chunk_file(f, repo_path, service=(service["name"] if service else parsed.name)))
        chunk_count = store_chunks(repo_id, all_chunks)

        # 4. Build knowledge graph
        build_graph(repo_id, parsed)

        # 5. Run analyzers
        findings = []
        for Analyzer in [SecurityAnalyzer, DevOpsAnalyzer, ArchitectureAnalyzer, CodeQualityAnalyzer]:
            findings.extend(Analyzer().analyze(parsed))

        # Cache for chat route
        from datetime import datetime
        _repo_store[repo_id] = {
            "parsed": parsed,
            "findings": findings,
            "chunk_count": chunk_count,
            "ingested_at": datetime.utcnow().isoformat(),
            "github_url": req.github_url,
        }

        response = {
            "repo_id": repo_id,
            "services": [service["name"] for service in parsed.services],
            "languages": parsed.languages,
            "chunk_count": chunk_count,
            "findings_count": len(findings),
        }
        _github_store[req.github_url] = response
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary/{repo_id}")
def summary(repo_id: str):
    if not _rehydrate_repo(repo_id):
        raise HTTPException(status_code=404, detail="Repo not ingested. Call /api/ingest first.")
    store = _repo_store[repo_id]
    parsed = store["parsed"]
    findings = store["findings"]
    graph_summary = get_repo_summary(repo_id)

    response = {
        "repo_id": repo_id,
        "name": parsed.name,
        "github_url": store.get("github_url"),
        "repo_kind": parsed.repo_kind,
        "languages": parsed.languages,
        "services_count": len(parsed.services),
        "apis_count": len(parsed.apis),
        "total_files": len(parsed.all_files),
        "chunk_count": store.get("chunk_count", 0),
        "findings_count": len(findings),
        "docker_files": parsed.docker_files,
        "ci_cd_files": parsed.ci_cd_files,
        "ingested_at": store.get("ingested_at"),
        "all_files": [str(f.relative_to(parsed.root)) for f in parsed.all_files][:500],
    }
    return response


@router.get("/services/{repo_id}")
def services(repo_id: str):
    if not _rehydrate_repo(repo_id):
        raise HTTPException(status_code=404, detail="Repo not ingested. Call /api/ingest first.")
    store = _repo_store[repo_id]
    parsed = store["parsed"]

    # Debug: print store keys so we can verify repo_id presence in runtime
    try:
        print("[INGEST.services] _repo_store keys:", list(_repo_store.keys()))
    except Exception:
        pass

    def most_common_language(file_paths: list[str]) -> str:
        counts: Counter[str] = Counter()
        for rel_path in file_paths:
            ext = os.path.splitext(rel_path)[1].lstrip(".").lower()
            if ext:
                counts[ext] += 1
        return counts.most_common(1)[0][0] if counts else ""

    services = []
    for service in parsed.services:
        services.append({
            "name": service.get("name"),
            "path": service.get("path"),
            "type": service.get("type"),
            "language": service.get("language") or most_common_language(service.get("files", [])),
            "file_count": service.get("file_count", len(service.get("files", []))),
            "files": service.get("files", []),
            "has_dockerfile": service.get("has_dockerfile", False),
            "port": service.get("port"),
            "entry_point": service.get("entry_point"),
        })
    return {"services_count": len(services), "services": services}


@router.get("/apis/{repo_id}")
def apis(repo_id: str):
    if not _rehydrate_repo(repo_id):
        raise HTTPException(status_code=404, detail="Repo not ingested. Call /api/ingest first.")
    store = _repo_store[repo_id]
    parsed = store["parsed"]
    try:
        print("[INGEST.apis] _repo_store keys:", list(_repo_store.keys()))
    except Exception:
        pass
    apis = get_all_apis(repo_id) or []
    if not apis:
        apis = parsed.apis

    normalized = []
    for api in apis:
        kind = api.get("kind") if isinstance(api, dict) else None
        method = api.get("method") if isinstance(api, dict) else ""
        if not kind:
            if method in {"GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"}:
                kind = "HTTP"
            elif method == "CLI":
                kind = "CLI"
            elif method == "CLASS":
                kind = "CLASS"
            else:
                kind = "FUNC"
        normalized.append({**api, "kind": kind})

    return {"repo_kind": parsed.repo_kind, "apis": normalized}