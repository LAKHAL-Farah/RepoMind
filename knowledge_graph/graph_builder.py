from __future__ import annotations
from neo4j import GraphDatabase
from ingestion.repo_parser import ParsedRepo
from config import NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD

def get_driver():
    return GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

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
            session.run(
                "MERGE (s:Service {name: $name, repo_id: $id})",
                name=svc, id=repo_id,
            )
            session.run(
                """
                MATCH (r:Repo {repo_id: $id}), (s:Service {name: $name, repo_id: $id})
                MERGE (r)-[:HAS_SERVICE]->(s)
                """,
                id=repo_id, name=svc,
            )

        # Create API nodes linked to their service
        for api in parsed.apis:
            session.run(
                """
                MERGE (a:API {method: $method, file: $file, repo_id: $id})
                WITH a
                MATCH (r:Repo {repo_id: $id})
                MERGE (r)-[:EXPOSES_API]->(a)
                """,
                method=api["method"], file=api["file"], id=repo_id,
            )

        # Link Docker + CI/CD files
        for df in parsed.docker_files:
            session.run(
                "MERGE (d:DockerFile {path: $path, repo_id: $id})",
                path=df, id=repo_id,
            )

    driver.close()
    print(f"[Graph] Built knowledge graph for {repo_id}: "
          f"{len(parsed.services)} services, {len(parsed.apis)} APIs")