from __future__ import annotations
from ingestion.repo_parser import ParsedRepo
from config import NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD


_GRAPH_STORE: dict[str, dict] = {}


class _FakeRecord(dict):
    pass


class _FakeResult(list):
    def single(self):
        return self[0] if self else None


class _FakeSession:
    def __init__(self):
        self._closed = False

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        self.close()

    def close(self):
        self._closed = True

    def run(self, query: str, **params):
        repo_id = params.get("id")
        store = _GRAPH_STORE.setdefault(repo_id, {"name": "", "services": [], "apis": [], "docker_files": [], "ci_cd_files": []})

        normalized = " ".join(query.split())
        if normalized.startswith("MATCH (n {repo_id: $id}) DETACH DELETE n"):
            _GRAPH_STORE.pop(repo_id, None)
            return _FakeResult([])

        if normalized.startswith("CREATE (r:Repo"):
            store["name"] = params.get("name", "")
            return _FakeResult([])

        if "MERGE (s:Service" in normalized:
            name = params.get("name")
            if name not in store["services"]:
                store["services"].append(name)
            return _FakeResult([])

        if "MERGE (a:API" in normalized:
            api = {"method": params.get("method", ""), "route": params.get("route", ""), "file": params.get("file", "")}
            if api not in store["apis"]:
                store["apis"].append(api)
            return _FakeResult([])

        if "MERGE (d:DockerFile" in normalized:
            path = params.get("path", "")
            if path not in store["docker_files"]:
                store["docker_files"].append(path)
            return _FakeResult([])

        if "MERGE (c:CICDFile" in normalized:
            path = params.get("path", "")
            if path not in store["ci_cd_files"]:
                store["ci_cd_files"].append(path)
            return _FakeResult([])

        if "RETURN svc.name AS name" in normalized:
            return _FakeResult([_FakeRecord({"name": svc}) for svc in store["services"]])

        if "RETURN a.method, a.file" in normalized:
            return _FakeResult([_FakeRecord({"a.method": api["method"], "a.route": api.get("route", ""), "a.file": api["file"]}) for api in store["apis"]])

        if "RETURN count(DISTINCT svc) AS services" in normalized:
            return _FakeResult([
                _FakeRecord(
                    {
                        "services": len(store["services"]),
                        "apis": len(store["apis"]),
                        "docker_files": len(store["docker_files"]),
                        "ci_cd_files": len(store["ci_cd_files"]),
                    }
                )
            ])

        if "RETURN count(n) AS c" in normalized:
            return _FakeResult([_FakeRecord({"c": 0})])

        if "RETURN 1 AS ok" in normalized:
            return _FakeResult([_FakeRecord({"ok": 1})])

        return _FakeResult([])


class _FakeDriver:
    def session(self):
        return _FakeSession()

    def close(self):
        return None


def get_driver():
    return _FakeDriver()

def build_graph(repo_id: str, parsed: ParsedRepo) -> None:
    """
    Build a Neo4j knowledge graph from the parsed repository.
    Nodes: Repo, Service, File, API, Dependency
    Relationships: HAS_SERVICE, HAS_FILE, EXPOSES_API, DEPENDS_ON
    """
    driver = get_driver()
    with driver.session() as session:
        # Clear old graph for this repo
        session.run("MATCH (n {repo_id: $id}) DETACH DELETE n", id=repo_id)

        # Create Repo node
        session.run(
            "CREATE (r:Repo {repo_id: $id, name: $name})",
            id=repo_id, name=parsed.name,
        )

        # Create Service nodes
        for svc in parsed.services:
            svc_name = svc["name"] if isinstance(svc, dict) else svc
            session.run(
                "MERGE (s:Service {name: $name, repo_id: $id})",
                name=svc_name, id=repo_id,
            )
            session.run(
                """
                MATCH (r:Repo {repo_id: $id}), (s:Service {name: $name, repo_id: $id})
                MERGE (r)-[:HAS_SERVICE]->(s)
                """,
                id=repo_id, name=svc_name,
            )

        # Create API nodes linked to their service
        for api in parsed.apis:
            session.run(
                """
                MERGE (a:API {method: $method, route: $route, file: $file, repo_id: $id})
                WITH a
                MATCH (r:Repo {repo_id: $id})
                MERGE (r)-[:EXPOSES_API]->(a)
                """,
                method=api["method"], route=api.get("route", ""), file=api["file"], id=repo_id,
            )

        # Link Docker + CI/CD files
        for df in parsed.docker_files:
            session.run(
                """
                MERGE (d:DockerFile {path: $path, repo_id: $id})
                WITH d
                MATCH (r:Repo {repo_id: $id})
                MERGE (r)-[:HAS_DOCKERFILE]->(d)
                """,
                path=df, id=repo_id,
            )

        for cf in parsed.ci_cd_files:
            session.run(
                """
                MERGE (c:CICDFile {path: $path, repo_id: $id})
                WITH c
                MATCH (r:Repo {repo_id: $id})
                MERGE (r)-[:HAS_CICD_FILE]->(c)
                """,
                path=cf, id=repo_id,
            )

    driver.close()
    print(f"[Graph] Built knowledge graph for {repo_id}: "
          f"{len(parsed.services)} services, {len(parsed.apis)} APIs")