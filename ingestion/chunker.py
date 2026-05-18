from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import List
try:
    from langchain.text_splitter import RecursiveCharacterTextSplitter
    _HAS_LANGCHAIN = True
except Exception:
    RecursiveCharacterTextSplitter = None
    _HAS_LANGCHAIN = False
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

    if _HAS_LANGCHAIN and RecursiveCharacterTextSplitter is not None:
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP,
            separators=["\n\n", "\n", " ", ""],
        )
        pieces = splitter.split_text(content)
    else:
        # Fallback: simple character-based splitter to avoid hard dependency on langchain
        pieces = []
        step = max(1, CHUNK_SIZE - CHUNK_OVERLAP)
        for i in range(0, max(1, len(content)), step):
            pieces.append(content[i:i + CHUNK_SIZE])
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