from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import List
from langchain_text_splitters import RecursiveCharacterTextSplitter
from config import CHUNK_SIZE, CHUNK_OVERLAP

@dataclass
class CodeChunk:
    text: str
    source_file: str    # relative path inside repo
    language: str
    service: str        # which microservice this belongs to (if any)
    chunk_index: int

def chunk_file(file_path: Path, repo_root: Path, service: str = "root") -> List[CodeChunk]:
    """Split a single source file into overlapping chunks."""
    content = _safe_read(file_path)
    if not content.strip():
        return []

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", " ", ""],
    )
    pieces = splitter.split_text(content)
    relative = str(file_path.relative_to(repo_root))
    lang = file_path.suffix.lstrip(".")

    return [
        CodeChunk(text=p, source_file=relative, language=lang,
                  service=service, chunk_index=i)
        for i, p in enumerate(pieces)
    ]

def _safe_read(f: Path) -> str:
    try:
        return f.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return ""