"""Shared in-memory state for API routes (testing/demo only)."""
from typing import Dict

# repo_id -> {"parsed": ParsedRepo, "findings": list, "chunk_count": int}
_repo_store: Dict[str, dict] = {}
