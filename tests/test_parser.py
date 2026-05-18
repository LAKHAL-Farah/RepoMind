import pytest
from pathlib import Path
from ingestion.repo_parser import parse_repo

FIXTURE_REPO = Path("tests/fixtures/sample_repo")   # create a small fake repo here
MONOREPO_REPO = Path("tests/fixtures/monorepo_repo")

def test_parser_detects_languages():
    parsed = parse_repo(FIXTURE_REPO)
    assert len(parsed.languages) > 0

def test_parser_detects_docker():
    parsed = parse_repo(FIXTURE_REPO)
    # sample_repo should have a Dockerfile
    assert len(parsed.docker_files) > 0


def test_parser_detects_multiple_services():
    parsed = parse_repo(MONOREPO_REPO)
    service_names = {service["name"] for service in parsed.services}

    assert len(parsed.services) == 2
    assert service_names == {"frontend", "backend"}

    frontend = next(service for service in parsed.services if service["name"] == "frontend")
    backend = next(service for service in parsed.services if service["name"] == "backend")

    assert frontend["type"] == "nextjs"
    assert frontend["port"] == 3000
    assert frontend["has_dockerfile"] is False
    assert any(file_path.startswith("frontend/") for file_path in frontend["files"])

    assert backend["type"] == "python"
    assert backend["port"] == 8000
    assert any(file_path.startswith("backend/") for file_path in backend["files"])