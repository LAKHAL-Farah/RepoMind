# config.py
from pathlib import Path
from dotenv import load_dotenv
import os

load_dotenv()

# NVIDIA NIM — uses the OpenAI-compatible API
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")
NVIDIA_BASE_URL = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
NVIDIA_MODEL = "meta/llama-3.1-8b-instruct"

# Qdrant
QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", 6333))
QDRANT_COLLECTION = "repomind_chunks"

# Neo4j
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")

# Embedding
EMBED_MODEL = "all-MiniLM-L6-v2"
CHUNK_SIZE = 400
CHUNK_OVERLAP = 40

# Paths
REPOS_CACHE_DIR = Path(os.getenv("REPOS_CACHE_DIR", "./repos_cache"))
REPOS_CACHE_DIR.mkdir(exist_ok=True)

# Supported file extensions for code parsing
CODE_EXTENSIONS = {
    ".py", ".js", ".ts", ".tsx", ".jsx", ".java", ".go", ".rs", ".cpp", ".c", ".h", ".cs",
    ".rb", ".php", ".swift", ".kt", ".yaml", ".yml", ".json", ".toml", ".ini", ".cfg", ".env",
    ".properties", ".xml", ".gradle", ".maven", ".md", ".rst", ".txt", ".dockerfile", ".tf",
    ".hcl", ".sh", ".bash", ".zsh", ".bat", ".ps1", ".sql",
}
                   