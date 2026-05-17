from __future__ import annotations
from knowledge_graph.graph_builder import get_driver

def get_all_services(repo_id: str) -> list[str]:
    driver = get_driver()
    with driver.session() as s:
        result = s.run(
            "MATCH (r:Repo {repo_id: $id})-[:HAS_SERVICE]->(svc) RETURN svc.name AS name",
            id=repo_id,
        )
        return [r["name"] for r in result]

def get_all_apis(repo_id: str) -> list[dict]:
    driver = get_driver()
    with driver.session() as s:
        result = s.run(
            "MATCH (r:Repo {repo_id: $id})-[:EXPOSES_API]->(a) RETURN a.method, a.file",
            id=repo_id,
        )
        return [{"method": r["a.method"], "file": r["a.file"]} for r in result]