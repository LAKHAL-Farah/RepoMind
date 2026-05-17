from __future__ import annotations
import shutil
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
        print(f"Repo already cached at {local_path}. Pulling latest...")
        repo = git.Repo(local_path)
        repo.remotes.origin.pull()
    else:
        print(f"Cloning {github_url} → {local_path}")
        git.Repo.clone_from(github_url, local_path, depth=1)  # shallow clone = faster

    return local_path

def delete_repo_cache(owner: str, repo_name: str) -> None:
    """Remove a cached repository from disk."""
    local_path = REPOS_CACHE_DIR / f"{owner}__{repo_name}"
    if local_path.exists():
        shutil.rmtree(local_path)