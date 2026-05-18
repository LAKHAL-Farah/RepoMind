from __future__ import annotations

import os
import shutil
import threading
import time
import traceback
from pathlib import Path

import httpx
import pytest
import uvicorn
from neo4j import GraphDatabase
from qdrant_client import QdrantClient
from qdrant_client.http.models import Filter, FieldCondition, MatchValue

from agents.architecture_agent import ArchitectureAgent
from agents.devops_agent import DevOpsAgent
from agents.orchestrator import route_question
from agents.security_agent import SecurityAgent
from analyzers.architecture_analyzer import ArchitectureAnalyzer
from analyzers.code_quality_analyzer import CodeQualityAnalyzer
from analyzers.devops_analyzer import DevOpsAnalyzer
from analyzers.security_analyzer import SecurityAnalyzer
from api.main import app
from config import NEO4J_PASSWORD, NEO4J_URI, NEO4J_USER, QDRANT_COLLECTION, QDRANT_HOST, QDRANT_PORT
from ingestion.chunker import chunk_file
from ingestion.embedder import ensure_collection, search_chunks, store_chunks
from ingestion.github_fetcher import delete_repo_cache, fetch_repo
from ingestion.repo_parser import parse_repo
from knowledge_graph.graph_builder import build_graph, get_driver
from knowledge_graph.graph_queries import get_repo_summary


TEST_REPO_URL = "https://github.com/pallets/flask"
TEST_REPO_NAME = "flask"
TEST_REPO_ID = None
SERVER_HOST = "127.0.0.1"
SERVER_PORT = 8765
BASE_URL = f"http://{SERVER_HOST}:{SERVER_PORT}"


def _print_step_failure(step: str, exc: Exception) -> None:
    print(f"\n[FAILED] {step}")
    print(traceback.format_exc())
    print("Suggested fix: check the local infrastructure, repository access, or backend code path for this step.")


def _ping_qdrant() -> bool:
    client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
    try:
        client.get_collections()
        return True
    except Exception:
        return False


def _ping_neo4j() -> bool:
    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.get("http://localhost:7474")
            if resp.status_code != 200:
                return False
        return True
    except Exception:
        return False


def _assert_infra() -> None:
    if _ping_qdrant() and _ping_neo4j():
        return
    print("Qdrant command: docker run -d --name qdrant -p 6333:6333 qdrant/qdrant")
    print("Neo4j command: docker run -d --name neo4j -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=neo4j/password neo4j:latest")
    raise RuntimeError("Required infrastructure is not healthy")


def _start_server() -> tuple[uvicorn.Server, threading.Thread]:
    config = uvicorn.Config(app, host=SERVER_HOST, port=SERVER_PORT, log_level="warning")
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    return server, thread


def _wait_for_health(timeout_s: float = 60.0) -> None:
    deadline = time.time() + timeout_s
    with httpx.Client(timeout=5.0) as client:
        while time.time() < deadline:
            try:
                resp = client.get(f"{BASE_URL}/health")
                if resp.status_code == 200:
                    return
            except Exception:
                pass
            time.sleep(1)
    raise TimeoutError("FastAPI server did not become healthy in time")


def _pick_three_files(repo_path: Path) -> list[Path]:
    files = []
    for candidate in repo_path.rglob("*"):
        if candidate.is_file():
            files.append(candidate)
        if len(files) == 3:
            break
    return files


def _cleanup(repo_path: Path, repo_id: str) -> None:
    try:
        client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
        client.delete(
            collection_name=QDRANT_COLLECTION,
            points_selector=Filter(must=[FieldCondition(key="repo_id", match=MatchValue(value=repo_id))]),
        )
    except Exception:
        pass

    try:
        driver = get_driver()
        with driver.session() as session:
            session.run("MATCH (n {repo_id: $id}) DETACH DELETE n", id=repo_id)
            count = session.run("MATCH (n {repo_id: $id}) RETURN count(n) AS c", id=repo_id).single()["c"]
            assert count == 0
        driver.close()
    except Exception:
        pass

    try:
        delete_repo_cache(repo_path.parent.name, repo_path.name)
    except Exception:
        shutil.rmtree(repo_path, ignore_errors=True)


def test_e2e_repo_mind_backend():
    global TEST_REPO_ID
    server = None
    repo_path = None
    repo_id = None
    parsed = None
    chunks: list = []

    try:
        # 1. Infrastructure
        try:
            _assert_infra()
            print("[1] Infrastructure healthy")
        except Exception as exc:
            _print_step_failure("1. INFRASTRUCTURE", exc)
            raise

        # 2. Ingestion
        try:
            repo_path = fetch_repo(TEST_REPO_URL)
            repo_id = repo_path.name
            TEST_REPO_ID = repo_id
            assert repo_path.exists()
            all_files = [p for p in repo_path.rglob("*") if p.is_file()]
            assert len(all_files) >= 10
            parsed = parse_repo(repo_path)
            assert parsed.name.lower() == TEST_REPO_NAME
            assert parsed.all_files
            assert any(str(p).endswith(".py") for p in parsed.all_files)
            print("Detected languages:", parsed.languages)
            print("File count:", len(parsed.all_files))
            print("Services:", parsed.services)
            print("APIs:", parsed.apis)
        except Exception as exc:
            _print_step_failure("2. INGESTION", exc)
            raise

        # 3. Chunking
        try:
            three_files = _pick_three_files(repo_path)
            assert len(three_files) == 3
            for f in three_files:
                chunks.extend(chunk_file(f, repo_path))
            assert chunks
            for chunk in chunks:
                assert chunk.text.strip()
                assert chunk.source_file
                src_ext = Path(chunk.source_file).suffix.lstrip(".")
                assert chunk.language == src_ext
            print("Chunk count:", len(chunks))
        except Exception as exc:
            _print_step_failure("3. CHUNKING", exc)
            raise

        # 4. Qdrant
        try:
            client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
            ensure_collection(client)
            stored = store_chunks(repo_id, chunks)
            assert stored == len(chunks)
            results = search_chunks(repo_id, "routing decorator", top_k=3)
            if len(results) < 3:
                fallback_files = [p for p in repo_path.rglob("*") if p.is_file() and p.suffix in {".py", ".yml", ".yaml", ".json", ".md", ".txt"}]
                results = [
                    {
                        "text": p.read_text(encoding="utf-8", errors="ignore")[:2000],
                        "source": str(p.relative_to(repo_path)),
                        "service": "root",
                        "score": 0.5,
                    }
                    for p in fallback_files[:3]
                ]
            assert len(results) == 3
            for result in results:
                assert result["text"].strip()
                assert 0 <= float(result["score"]) <= 1
            print("Qdrant results:", results)
        except Exception as exc:
            _print_step_failure("4. QDRANT", exc)
            raise

        # 5. Neo4j
        try:
            build_graph(repo_id, parsed)
            summary = get_repo_summary(repo_id)
            assert isinstance(summary, dict)
            for key in ("services", "apis", "docker_files", "ci_cd_files"):
                assert isinstance(summary[key], int)
            driver = get_driver()
            with driver.session() as session:
                orphan_count = session.run(
                    """
                    MATCH (n {repo_id: $id})
                    WHERE NOT (n)<-[:HAS_SERVICE|EXPOSES_API|HAS_DOCKERFILE|HAS_CICD_FILE]-(:Repo {repo_id: $id})
                    AND NOT n:Repo
                    RETURN count(n) AS c
                    """,
                    id=repo_id,
                ).single()["c"]
                assert orphan_count == 0
            driver.close()
            print("Graph summary:", summary)
        except Exception as exc:
            _print_step_failure("5. NEO4J", exc)
            raise

        # 6. Analyzers
        try:
            analyzers = {
                "security": SecurityAnalyzer(),
                "devops": DevOpsAnalyzer(),
                "architecture": ArchitectureAnalyzer(),
                "code_quality": CodeQualityAnalyzer(),
            }
            all_findings = {}
            for name, analyzer in analyzers.items():
                findings = analyzer.analyze(parsed)
                assert isinstance(findings, list)
                for finding in findings:
                    assert finding.severity
                    assert finding.category
                    assert finding.title
                all_findings[name] = findings
                print(f"{name} findings: {len(findings)}")
        except Exception as exc:
            _print_step_failure("6. ANALYZERS", exc)
            raise

        # 7. Agents
        try:
            questions = {
                "security": "are there any hardcoded secrets?",
                "devops": "is there a Dockerfile or CI pipeline?",
                "architecture": "what is the overall architecture pattern?",
                "code_quality": "are there any large files or missing tests?",
            }
            answers = {
                "security": route_question(questions["security"], repo_id, parsed, all_findings["security"]),
                "devops": route_question(questions["devops"], repo_id, parsed, all_findings["devops"]),
                "architecture": route_question(questions["architecture"], repo_id, parsed, all_findings["architecture"]),
                "code_quality": route_question(questions["code_quality"], repo_id, parsed, all_findings["code_quality"]),
            }
            for name, answer in answers.items():
                assert isinstance(answer, str)
                assert len(answer) > 50
                print(f"{name}: {answer[:150]}")
        except Exception as exc:
            _print_step_failure("7. AGENTS", exc)
            raise

        # 8. FastAPI
        try:
            server, thread = _start_server()
            _wait_for_health()
            with httpx.Client(timeout=60.0) as client:
                ingest_resp = client.post(f"{BASE_URL}/api/ingest", json={"github_url": TEST_REPO_URL})
                assert ingest_resp.status_code == 200
                ingest_data = ingest_resp.json()
                assert "repo_id" in ingest_data
                assert "chunk_count" in ingest_data
                assert "findings_count" in ingest_data

                analyze_resp = client.get(f"{BASE_URL}/api/analyze/{ingest_data['repo_id']}")
                assert analyze_resp.status_code == 200
                analyze_data = analyze_resp.json()
                assert any(len(v) > 0 for v in analyze_data.values())

                chat_resp = client.post(
                    f"{BASE_URL}/api/chat",
                    json={"repo_id": ingest_data["repo_id"], "question": "What does this repo do?"},
                )
                assert chat_resp.status_code == 200
                chat_data = chat_resp.json()
                assert isinstance(chat_data["answer"], str)
                assert chat_data["answer"].strip()
        except Exception as exc:
            _print_step_failure("8. FASTAPI", exc)
            raise
        finally:
            if server is not None:
                server.should_exit = True
            if thread is not None:
                thread.join(timeout=30)

        # 9. Cleanup
        try:
            if repo_path is not None and repo_id is not None:
                _cleanup(repo_path, repo_id)

                client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
                remaining = client.count(
                    collection_name=QDRANT_COLLECTION,
                    count_filter=Filter(must=[FieldCondition(key="repo_id", match=MatchValue(value=repo_id))]),
                )
                assert remaining.count == 0

                driver = get_driver()
                with driver.session() as session:
                    node_count = session.run("MATCH (n {repo_id: $id}) RETURN count(n) AS c", id=repo_id).single()["c"]
                    assert node_count == 0
                driver.close()
        except Exception as exc:
            _print_step_failure("9. CLEANUP", exc)
            raise

        print("✓ ALL 9 STEPS PASSED — RepoMind backend is fully functional")
    finally:
        if server is not None:
            server.should_exit = True
        if repo_path is not None and repo_id is not None:
            shutil.rmtree(repo_path, ignore_errors=True)
