import pytest
from pathlib import Path
from ingestion.repo_parser import parse_repo

FIXTURE_REPO = Path("tests/fixtures/sample_repo")   # create a small fake repo here

def test_parser_detects_languages():
    parsed = parse_repo(FIXTURE_REPO)
    assert len(parsed.languages) > 0

def test_parser_detects_docker():
    parsed = parse_repo(FIXTURE_REPO)
    # sample_repo should have a Dockerfile
    assert len(parsed.docker_files) > 0