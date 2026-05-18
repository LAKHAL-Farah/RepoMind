from __future__ import annotations
from knowledge_graph.graph_builder import get_driver, _GRAPH_STORE

def get_all_services(repo_id: str) -> list[str]:
    return list(_GRAPH_STORE.get(repo_id, {}).get("services", []))

def get_all_apis(repo_id: str) -> list[dict]:
    return list(_GRAPH_STORE.get(repo_id, {}).get("apis", []))


def get_repo_summary(repo_id: str) -> dict:
    store = _GRAPH_STORE.get(repo_id, {})
    return {
        "services": int(len(store.get("services", []))),
        "apis": int(len(store.get("apis", []))),
        "docker_files": int(len(store.get("docker_files", []))),
        "ci_cd_files": int(len(store.get("ci_cd_files", []))),
    }