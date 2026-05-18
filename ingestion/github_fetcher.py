from __future__ import annotations
import shutil
import uuid
from pathlib import Path
import git
from config import REPOS_CACHE_DIR

def fetch_repo(github_url: str) -> Path:
    """
    Clone a GitHub repository into the local cache.
    If already cloned, pull latest changes.
    Returns the local path to the repository.
    """
    # Derive a folder name from the URL
    repo_name = github_url.rstrip("/").split("/")[-1].replace(".git", "")
    owner = github_url.rstrip("/").split("/")[-2]
    local_path = REPOS_CACHE_DIR / f"{owner}__{repo_name}"

    if local_path.exists():
        try:
            print(f"Repo already cached at {local_path}. Pulling latest...")
            repo = git.Repo(local_path)
            repo.remotes.origin.pull()
        except Exception:
            # If the cache is corrupted or not a git repo, rebuild it from scratch.
            shutil.rmtree(local_path, ignore_errors=True)
            local_path.parent.mkdir(parents=True, exist_ok=True)
            try:
                git.Repo.clone_from(github_url, local_path, depth=1)
            except Exception:
                fallback_path = REPOS_CACHE_DIR / f"{owner}__{repo_name}__{uuid.uuid4().hex[:8]}"
                git.Repo.clone_from(github_url, fallback_path, depth=1)
                return fallback_path
    else:
        print(f"Cloning {github_url} → {local_path}")
        try:
            git.Repo.clone_from(github_url, local_path, depth=1)  # shallow clone = faster
        except Exception:
            fallback_path = REPOS_CACHE_DIR / f"{owner}__{repo_name}__{uuid.uuid4().hex[:8]}"
            git.Repo.clone_from(github_url, fallback_path, depth=1)
            return fallback_path

    return local_path

def delete_repo_cache(owner: str, repo_name: str) -> None:
    """Remove a cached repository from disk."""
    local_path = REPOS_CACHE_DIR / f"{owner}__{repo_name}"
    if local_path.exists():
        shutil.rmtree(local_path)