from __future__ import annotations
from typing import List
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams, PointStruct
from sentence_transformers import SentenceTransformer
from ingestion.chunker import CodeChunk
from config import QDRANT_HOST, QDRANT_PORT, QDRANT_COLLECTION, EMBED_MODEL

_embedder = None

def get_embedder() -> SentenceTransformer:
    global _embedder
    if _embedder is None:
        _embedder = SentenceTransformer(EMBED_MODEL)
    return _embedder

def get_qdrant() -> QdrantClient:
    return QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)

def ensure_collection(client: QdrantClient) -> None:
    """Create the Qdrant collection if it doesn't exist yet."""
    existing = [c.name for c in client.get_collections().collections]
    if QDRANT_COLLECTION not in existing:
        client.create_collection(
            collection_name=QDRANT_COLLECTION,
            vectors_config=VectorParams(size=384, distance=Distance.COSINE),
        )

def store_chunks(repo_id: str, chunks: List[CodeChunk]) -> int:
    """Embed and upsert all chunks for a repository. Returns chunk count."""
    if not chunks:
        return 0

    client = get_qdrant()
    ensure_collection(client)

    # Delete old entries for this repo first (idempotent)
    client.delete(
        collection_name=QDRANT_COLLECTION,
        points_selector={"filter": {"must": [{"key": "repo_id", "match": {"value": repo_id}}]}},
    )

    embedder = get_embedder()
    texts = [c.text for c in chunks]
    vectors = embedder.encode(texts, show_progress_bar=True, batch_size=64)

    points = [
        PointStruct(
            id=abs(hash(f"{repo_id}_{c.source_file}_{c.chunk_index}")) % (10**9),
            vector=vectors[i].tolist(),
            payload={
                "repo_id": repo_id,
                "source_file": c.source_file,
                "language": c.language,
                "service": c.service,
                "text": c.text,
            },
        )
        for i, c in enumerate(chunks)
    ]

    client.upsert(collection_name=QDRANT_COLLECTION, points=points)
    return len(chunks)

def search_chunks(repo_id: str, query: str, top_k: int = 5) -> List[dict]:
    """Embed query and retrieve top-k most similar chunks for a repo."""
    client = get_qdrant()
    embedder = get_embedder()
    query_vec = embedder.encode([query])[0].tolist()

    results = client.search(
        collection_name=QDRANT_COLLECTION,
        query_vector=query_vec,
        limit=top_k,
        query_filter={"must": [{"key": "repo_id", "match": {"value": repo_id}}]},
    )
    return [{"text": r.payload["text"], "source": r.payload["source_file"],
             "service": r.payload["service"], "score": r.score} for r in results]