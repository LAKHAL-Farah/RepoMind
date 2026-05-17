from __future__ import annotations
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Dict
from config import CODE_EXTENSIONS

@dataclass
class ParsedRepo:
    name: str
    root: Path
    languages: List[str] = field(default_factory=list)
    services: List[str] = field(default_factory=list)       # detected microservice names
    dependencies: Dict[str, List[str]] = field(default_factory=dict)  # file → imports
    apis: List[Dict] = field(default_factory=list)          # {method, path, file}
    docker_files: List[str] = field(default_factory=list)
    ci_cd_files: List[str] = field(default_factory=list)
    all_files: List[Path] = field(default_factory=list)

def parse_repo(repo_path: Path) -> ParsedRepo:
    """Walk a repository and extract structured metadata."""
    parsed = ParsedRepo(name=repo_path.name, root=repo_path)

    for f in repo_path.rglob("*"):
        if f.is_file() and f.suffix in CODE_EXTENSIONS:
            parsed.all_files.append(f)
            _classify_file(f, parsed)

    parsed.languages = list({f.suffix.lstrip(".") for f in parsed.all_files if f.suffix})
    return parsed

def _classify_file(f: Path, parsed: ParsedRepo) -> None:
    """Classify a single file and update the parsed repo structure."""
    name_lower = f.name.lower()
    content = _safe_read(f)

    # Docker
    if "dockerfile" in name_lower or name_lower == "docker-compose.yml":
        parsed.docker_files.append(str(f.relative_to(parsed.root)))

    # CI/CD
    if ".github/workflows" in str(f) or name_lower in (".travis.yml", "jenkinsfile", "gitlab-ci.yml"):
        parsed.ci_cd_files.append(str(f.relative_to(parsed.root)))

    # API routes (basic detection — expand per framework)
    if f.suffix in (".py", ".java", ".ts", ".js"):
        for line in content.splitlines():
            for method in ("@GetMapping", "@PostMapping", "@app.route", "@router.get",
                           "@router.post", "app.get(", "app.post("):
                if method in line:
                    parsed.apis.append({
                        "method": _infer_http_method(method),
                        "file": str(f.relative_to(parsed.root)),
                        "line": line.strip(),
                    })

    # Services (detect by pom.xml, build.gradle, package.json at subdir level)
    if name_lower in ("pom.xml", "build.gradle", "package.json") and f.parent != parsed.root:
        service_name = f.parent.name
        if service_name not in parsed.services:
            parsed.services.append(service_name)

def _infer_http_method(decorator: str) -> str:
    if "Get" in decorator or ".get(" in decorator:
        return "GET"
    if "Post" in decorator or ".post(" in decorator:
        return "POST"
    return "UNKNOWN"

def _safe_read(f: Path) -> str:
    try:
        return f.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return ""