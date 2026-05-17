from ingestion.chunker import chunk_file
from pathlib import Path

FIXTURE_FILE = Path("tests/fixtures/sample_repo/main.py")

def test_chunk_returns_list():
    chunks = chunk_file(FIXTURE_FILE, FIXTURE_FILE.parent)
    assert isinstance(chunks, list)
    assert all(c.text for c in chunks)

def test_chunk_has_metadata():
    chunks = chunk_file(FIXTURE_FILE, FIXTURE_FILE.parent)
    c = chunks[0]
    assert c.source_file
    assert c.language == "py"