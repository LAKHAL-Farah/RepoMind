from __future__ import annotations

import ast
import re
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List

import yaml

from config import CODE_EXTENSIONS

SKIP_DIRS = {
    ".git", "__pycache__", "node_modules", ".venv", "venv", ".env", "dist", "build", "target",
    ".idea", ".vscode", ".pytest_cache", ".mypy_cache", "htmlcov", "coverage",
}

SKIP_SERVICE_DIRS = {
    "docs", "doc", "documentation", "wiki", "guides", "examples", "example",
    "demo", "demos", "test", "tests", "spec", "specs", "__tests__", "e2e",
    "scripts", "script", "tools", "tool", "utils", "utilities", "helpers",
    "assets", "static", "public", "media", "images", "icons", "fonts",
    "node_modules", ".git", "__pycache__", ".venv", "venv", "dist", "build",
    "coverage", ".github", ".vscode", ".idea", "migrations", "fixtures",
    "stubs", "mocks", "typings", "types", "vendor", "third_party",
}

SPECIAL_FILES = {
    "Dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
}

BUILD_CONFIG_FILES = {
    "package.json",
    "pom.xml",
    "build.gradle",
    "requirements.txt",
    "pyproject.toml",
    "Cargo.toml",
    "composer.json",
    "Gemfile",
    "go.mod",
}

FRAMEWORK_ENTRY_PATTERNS = {
    "nextjs": ["next.config.js", "next.config.ts", "next.config.mjs"],
    "vite": ["vite.config.ts", "vite.config.js"],
    "angular": ["angular.json"],
    "nuxt": ["nuxt.config.ts", "nuxt.config.js"],
    "python": ["main.py", "app.py", "run.py", "server.py", "wsgi.py", "asgi.py"],
    "go": ["main.go"],
    "node": ["index.js", "index.ts", "server.js", "server.ts", "app.js"],
    "dotnet": ["Program.cs"],
    "spring": ["Application.java", "SpringApplication"],
}

COMMON_SERVICE_NAMES = {
    "frontend", "backend", "api", "server", "client", "web", "app", "ui", "gateway", "worker",
    "service", "microservice", "core", "admin", "dashboard", "mobile", "docs", "functions",
}

HTTP_ROUTE_PATTERNS = [
    {"pattern": r'^\s*@\w+\.(get|post|put|delete|patch|head|options)\s*\(', "method_group": 1, "kind": "decorator"},
    {"pattern": r'^\s*@\w+\.route\s*\(', "method": "GET", "kind": "decorator_generic"},
    {"pattern": r'^\s*@router\.(get|post|put|delete|patch)\s*\(', "method_group": 1, "kind": "decorator"},
    {"pattern": r'^\s*@app\.(get|post|put|delete|patch)\s*\(', "method_group": 1, "kind": "decorator"},
    {"pattern": r'^\s*@blueprint\.(get|post|put|delete|patch)\s*\(', "method_group": 1, "kind": "decorator"},
    {"pattern": r'^\s*path\s*\(\s*["\'\`]', "method": "GET", "kind": "django_path"},
    {"pattern": r'^\s*re_path\s*\(\s*["\'\`]', "method": "GET", "kind": "django_path"},
    {"pattern": r'^\s*(app|router)\.(get|post|put|delete|patch)\s*\(\s*["\'\`]', "method_group": 2, "kind": "express"},
    {"pattern": r'^\s*@GetMapping\s*[\(\n]', "method": "GET", "kind": "spring"},
    {"pattern": r'^\s*@PostMapping\s*[\(\n]', "method": "POST", "kind": "spring"},
    {"pattern": r'^\s*@PutMapping\s*[\(\n]', "method": "PUT", "kind": "spring"},
    {"pattern": r'^\s*@DeleteMapping\s*[\(\n]', "method": "DELETE", "kind": "spring"},
    {"pattern": r'^\s*@PatchMapping\s*[\(\n]', "method": "PATCH", "kind": "spring"},
    {"pattern": r'^\s*@RequestMapping\s*\(', "method": "GET", "kind": "spring_generic"},
    {"pattern": r'^\s*r\.(GET|POST|PUT|DELETE|PATCH)\s*\(\s*["\'\`]', "method_group": 1, "kind": "go"},
    {"pattern": r'^\s*http\.HandleFunc\s*\(\s*["\'\`]', "method": "GET", "kind": "go_http"},
]

CLI_PATTERNS = [
    {"pattern": r'^\s*@\w+\.command\s*\(', "kind": "cli_decorator"},
    {"pattern": r'^\s*add_parser\s*\(\s*["\'\`]', "kind": "cli_argparse"},
]


@dataclass
class ParsedRepo:
    name: str
    root: Path
    languages: List[str] = field(default_factory=list)
    services: List[Dict] = field(default_factory=list)
    dependencies: Dict[str, List[str]] = field(default_factory=dict)
    apis: List[Dict] = field(default_factory=list)
    docker_files: List[str] = field(default_factory=list)
    ci_cd_files: List[str] = field(default_factory=list)
    all_files: List[Path] = field(default_factory=list)
    repo_kind: str = "library"


def parse_repo(repo_path: Path) -> ParsedRepo:
    """Walk a repository and extract structured metadata."""
    repo_name = repo_path.name.split("__", 1)[1] if "__" in repo_path.name else repo_path.name
    parsed = ParsedRepo(name=repo_name, root=repo_path)

    for file_path in repo_path.rglob("*"):
        if not file_path.is_file():
            continue
        if any(part in SKIP_DIRS or part.endswith(".egg-info") for part in file_path.parts):
            continue
        if not _should_include_file(file_path):
            continue
        parsed.all_files.append(file_path)
        _classify_file(file_path, parsed)

    parsed.languages = _detect_languages(parsed.all_files)
    compose_services = parse_docker_compose(repo_path)
    parsed.services = _detect_services(parsed, compose_services)
    _assign_files_to_services(parsed)
    parsed.repo_kind = _infer_repo_kind(parsed)

    service_names = [service["name"] for service in parsed.services]
    print(f"Detected {len(service_names)} services: {', '.join(service_names) if service_names else 'none'}")
    return parsed


def parse_docker_compose(repo_path: Path) -> dict[str, str | None]:
    compose_path = None
    for candidate in (repo_path / "docker-compose.yml", repo_path / "docker-compose.yaml"):
        if candidate.exists():
            compose_path = candidate
            break
    if compose_path is None:
        return {}

    try:
        data = yaml.safe_load(compose_path.read_text(encoding="utf-8", errors="ignore")) or {}
    except Exception:
        return {}

    services = data.get("services", {}) if isinstance(data, dict) else {}
    if not isinstance(services, dict):
        return {}

    parsed: dict[str, str | None] = {}
    for name, spec in services.items():
        build_context = None
        if isinstance(spec, dict):
            build = spec.get("build")
            if isinstance(build, str):
                build_context = build
            elif isinstance(build, dict):
                build_context = build.get("context")
        parsed[str(name)] = _normalize_rel_path(repo_path, build_context) if build_context else None
    return parsed


def _detect_services(parsed: ParsedRepo, compose_services: dict[str, str | None]) -> List[Dict]:
    direct_children = [child for child in parsed.root.iterdir() if child.is_dir() and not _is_skipped(child)]
    services_by_key: dict[str, dict] = {}
    path_lookup = {child.name: child for child in direct_children}

    for child in direct_children:
        if child.name.lower() in SKIP_SERVICE_DIRS:
            continue
        rel_path = str(child.relative_to(parsed.root)).replace("\\", "/")
        service = _empty_service_record(name=child.name, path=rel_path)

        build_signal = _detect_build_config(child)
        if build_signal:
            _merge_service_signal(service, build_signal)

        framework_signal = _detect_framework_entry(child)
        if framework_signal:
            _merge_service_signal(service, framework_signal)

        docker_signal = _detect_dockerfile(child)
        if docker_signal:
            _merge_service_signal(service, docker_signal)

        fallback_signal = _detect_name_fallback(child)
        if fallback_signal and not service["signals"]:
            _merge_service_signal(service, fallback_signal)

        if service["signals"]:
            services_by_key[rel_path] = service

    for compose_name, build_context in compose_services.items():
        if compose_name.lower() in SKIP_SERVICE_DIRS:
            continue
        normalized_path = None
        if build_context:
            normalized_path = build_context.replace("\\", "/").rstrip("/")
        if normalized_path and normalized_path in services_by_key:
            service = services_by_key[normalized_path]
            service["compose_name"] = compose_name
            service["type"] = service.get("type") or _compose_type_from_name(compose_name)
            continue

        if normalized_path and normalized_path in path_lookup:
            continue

        if normalized_path and normalized_path in services_by_key:
            continue

        if normalized_path and normalized_path in {str(child.relative_to(parsed.root)).replace("\\", "/") for child in direct_children}:
            continue

        if normalized_path and normalized_path in {child.name for child in direct_children}:
            continue

        if normalized_path and normalized_path in services_by_key:
            continue

        if normalized_path and normalized_path in services_by_key:
            continue

        if normalized_path and normalized_path in services_by_key:
            continue

        if normalized_path and normalized_path in services_by_key:
            continue

        if normalized_path and normalized_path in services_by_key:
            continue

        service_key = normalized_path if normalized_path and normalized_path in services_by_key else f"compose:{compose_name}"
        if service_key not in services_by_key:
            services_by_key[service_key] = _empty_service_record(
                name=compose_name,
                path=normalized_path or compose_name,
                service_type=_compose_type_from_name(compose_name),
            )
        service = services_by_key[service_key]
        service["compose_name"] = compose_name
        service["port"] = service.get("port") or _extract_compose_port(compose_name, parsed.root)
        if not service.get("entry_point") and normalized_path:
            service["entry_point"] = normalized_path

    services = list(services_by_key.values())
    if not services:
        return [_build_root_service(parsed)]

    for service in services:
        service["language"] = _most_common_language(service["files"]) or service.get("language") or ""
        service["file_count"] = len(service["files"])
        if service.get("type") in {None, ""}:
            service["type"] = _infer_service_type_from_files(service["files"])
        if service.get("port") is None:
            service["port"] = _extract_service_port(parsed.root, service)
        if not service.get("entry_point"):
            service["entry_point"] = _first_entry_point(service)
        service.pop("signals", None)
        service.pop("compose_name", None)

    services.sort(key=lambda item: (item.get("path") or "", item["name"]))
    return services


def _build_root_service(parsed: ParsedRepo) -> Dict:
    files = [str(file_path.relative_to(parsed.root)).replace("\\", "/") for file_path in parsed.all_files]
    return {
        "name": parsed.name,
        "path": ".",
        "type": _infer_service_type_from_files(files),
        "language": _most_common_language(files),
        "file_count": len(files),
        "files": files,
        "has_dockerfile": any(Path(file_name).name == "Dockerfile" for file_name in files),
        "port": _extract_root_port(parsed.root),
        "entry_point": None,
        "signals": ["root"],
    }


def _assign_files_to_services(parsed: ParsedRepo) -> None:
    if not parsed.services:
        return

    services_by_path = [service for service in parsed.services if service.get("path") and service.get("path") != "."]
    services_by_path.sort(key=lambda item: len(str(item["path"])) , reverse=True)

    for service in parsed.services:
        service["files"] = []

    for file_path in parsed.all_files:
        relative_path = str(file_path.relative_to(parsed.root)).replace("\\", "/")
        best_service = None
        for service in services_by_path:
            service_path = str(service["path"]).strip("./")
            if not service_path:
                continue
            if relative_path == service_path or relative_path.startswith(f"{service_path}/"):
                if best_service is None or len(service_path) > len(str(best_service["path"])):
                    best_service = service
        if best_service is not None:
            best_service["files"].append(relative_path)
        elif len(parsed.services) == 1 and parsed.services[0].get("path") == ".":
            parsed.services[0]["files"].append(relative_path)

    for service in parsed.services:
        service["files"].sort()
        service["file_count"] = len(service["files"])


def _detect_build_config(service_dir: Path) -> dict | None:
    if service_dir.name.lower() in SKIP_SERVICE_DIRS:
        return None
    for name in BUILD_CONFIG_FILES:
        candidate = service_dir / name
        if candidate.exists():
            return {
                "type": _service_type_from_build_file(name),
                "language": _language_from_service_type(_service_type_from_build_file(name)),
                "entry_point": str(candidate.relative_to(service_dir.parent)).replace("\\", "/"),
                "signals": [f"build:{name}"],
                "has_dockerfile": False,
            }
    return None


def _detect_framework_entry(service_dir: Path) -> dict | None:
    if service_dir.name.lower() in SKIP_SERVICE_DIRS:
        return None
    for service_type, patterns in FRAMEWORK_ENTRY_PATTERNS.items():
        for pattern in patterns:
            if pattern == "SpringApplication":
                for file_path in service_dir.rglob("*.java"):
                    content = _safe_read(file_path)
                    if "SpringApplication" in content:
                        return _service_signal(service_dir, service_type, file_path)
                continue
            matches = list(service_dir.rglob(pattern))
            if matches:
                return _service_signal(service_dir, service_type, matches[0])
    return None


def _detect_dockerfile(service_dir: Path) -> dict | None:
    if service_dir.name.lower() in SKIP_SERVICE_DIRS:
        return None
    candidate = service_dir / "Dockerfile"
    if candidate.exists():
        return {
            "type": None,
            "language": _most_common_language([str(candidate.relative_to(service_dir.parent)).replace("\\", "/")]),
            "entry_point": str(candidate.relative_to(service_dir.parent)).replace("\\", "/"),
            "signals": ["dockerfile"],
            "has_dockerfile": True,
        }
    return None


def _detect_name_fallback(service_dir: Path) -> dict | None:
    if service_dir.name.lower() in SKIP_SERVICE_DIRS:
        return None
    if service_dir.name.lower() in COMMON_SERVICE_NAMES:
        return {
            "type": None,
            "language": _most_common_language([str(file_path.relative_to(service_dir.parent)).replace("\\", "/") for file_path in service_dir.rglob("*") if file_path.is_file()]),
            "entry_point": None,
            "signals": ["name"],
            "has_dockerfile": False,
        }
    return None


def _service_signal(service_dir: Path, service_type: str, file_path: Path) -> dict:
    rel_file = str(file_path.relative_to(service_dir.parent)).replace("\\", "/")
    return {
        "type": service_type,
        "language": _language_from_service_type(service_type),
        "entry_point": rel_file,
        "signals": [f"framework:{service_type}"],
        "has_dockerfile": False,
    }


def _merge_service_signal(service: dict, signal: dict) -> None:
    service["signals"].extend(signal.get("signals", []))
    current_priority = _service_type_priority(service.get("type"))
    incoming_priority = _service_type_priority(signal.get("type"))
    if signal.get("type") and incoming_priority >= current_priority:
        service["type"] = signal["type"]
    if signal.get("language") and (not service.get("language") or incoming_priority >= current_priority):
        service["language"] = signal["language"]
    if signal.get("entry_point") and (not service.get("entry_point") or incoming_priority >= current_priority):
        service["entry_point"] = signal["entry_point"]
    service["has_dockerfile"] = bool(service.get("has_dockerfile") or signal.get("has_dockerfile"))


def _service_type_priority(service_type: str | None) -> int:
    return {
        None: 0,
        "": 0,
        "node": 10,
        "python": 20,
        "go": 20,
        "dotnet": 20,
        "spring": 20,
        "vite": 30,
        "angular": 30,
        "nuxt": 30,
        "nextjs": 40,
        "library": 5,
    }.get(service_type or "", 0)


def _empty_service_record(name: str, path: str, service_type: str | None = None) -> dict:
    return {
        "name": name,
        "path": path,
        "type": service_type,
        "language": None,
        "file_count": 0,
        "files": [],
        "has_dockerfile": False,
        "port": None,
        "entry_point": None,
        "signals": [],
    }


def _service_type_from_build_file(file_name: str) -> str:
    mapping = {
        "package.json": "node",
        "pom.xml": "spring",
        "build.gradle": "spring",
        "requirements.txt": "python",
        "pyproject.toml": "python",
        "Cargo.toml": "go",
        "composer.json": "node",
        "Gemfile": "node",
        "go.mod": "go",
    }
    return mapping.get(file_name, "node")


def _language_from_service_type(service_type: str | None) -> str:
    mapping = {
        "nextjs": "TypeScript",
        "vite": "TypeScript",
        "angular": "TypeScript",
        "nuxt": "TypeScript",
        "python": "Python",
        "go": "Go",
        "node": "JavaScript",
        "dotnet": "C#",
        "spring": "Java",
    }
    return mapping.get(service_type or "", "")


def _compose_type_from_name(name: str) -> str:
    lowered = name.lower()
    if any(part in lowered for part in ("front", "web", "client", "ui")):
        return "nextjs"
    if any(part in lowered for part in ("back", "api", "server")):
        return "python"
    return "node"


def _first_entry_point(service: dict) -> str | None:
    if service.get("entry_point"):
        return service["entry_point"]
    for signal in service.get("signals", []):
        if signal.startswith(("framework:", "build:")):
            files = service.get("files") or []
            return files[0] if files else None
    files = service.get("files") or []
    return files[0] if files else None


def _extract_service_port(repo_root: Path, service: dict) -> int | None:
    ports = _extract_compose_ports(repo_root, service)
    if ports:
        return ports[0]

    service_path = service.get("path") or "."
    if service_path == ".":
        search_roots = [repo_root]
    else:
        search_roots = [repo_root / service_path]

    for root in search_roots:
        for env_name in (".env", ".env.local", ".env.example"):
            candidate = root / env_name
            if not candidate.exists():
                continue
            content = _safe_read(candidate)
            for key in ("PORT", "NEXT_PUBLIC_PORT", "APP_PORT"):
                match = re.search(rf'^{key}\s*=\s*([0-9]+)', content, re.MULTILINE)
                if match:
                    return int(match.group(1))
    return None


def _extract_root_port(repo_root: Path) -> int | None:
    dummy = {"path": ".", "files": [], "signals": []}
    return _extract_service_port(repo_root, dummy)


def _extract_compose_ports(repo_root: Path, service: dict) -> List[int]:
    for compose_name, build_context in parse_docker_compose(repo_root).items():
        if compose_name != service.get("name") and compose_name != service.get("compose_name"):
            continue
        compose_path = repo_root / ("docker-compose.yml" if (repo_root / "docker-compose.yml").exists() else "docker-compose.yaml")
        try:
            data = yaml.safe_load(compose_path.read_text(encoding="utf-8", errors="ignore")) or {}
        except Exception:
            return []
        spec = data.get("services", {}).get(compose_name, {}) if isinstance(data, dict) else {}
        if not isinstance(spec, dict):
            return []
        ports = []
        for port_mapping in spec.get("ports", []) or []:
            if isinstance(port_mapping, str) and ":" in port_mapping:
                host_part = port_mapping.split(":", 1)[0].strip().strip('"').strip("'")
                if host_part.isdigit():
                    ports.append(int(host_part))
        return ports
    return []


def _extract_compose_port(compose_name: str, repo_root: Path) -> int | None:
    compose_path = next((candidate for candidate in (repo_root / "docker-compose.yml", repo_root / "docker-compose.yaml") if candidate.exists()), None)
    if compose_path is None:
        return None
    try:
        data = yaml.safe_load(compose_path.read_text(encoding="utf-8", errors="ignore")) or {}
    except Exception:
        return None
    services = data.get("services", {}) if isinstance(data, dict) else {}
    spec = services.get(compose_name) if isinstance(services, dict) else None
    if not isinstance(spec, dict):
        return None
    for port_mapping in spec.get("ports", []) or []:
        if isinstance(port_mapping, str) and ":" in port_mapping:
            host_part = port_mapping.split(":", 1)[0].strip().strip('"').strip("'")
            if host_part.isdigit():
                return int(host_part)
    return None


def _infer_service_type_from_files(files: List[str]) -> str:
    file_names = {Path(file_name).name for file_name in files}
    if any(name.startswith("next.config") for name in file_names):
        return "nextjs"
    if any(name.startswith("vite.config") for name in file_names):
        return "vite"
    if "angular.json" in file_names:
        return "angular"
    if any(name.startswith("nuxt.config") for name in file_names):
        return "nuxt"
    if any(name in {"main.py", "app.py", "run.py", "server.py", "wsgi.py", "asgi.py"} for name in file_names):
        return "python"
    if "main.go" in file_names:
        return "go"
    if any(name in {"index.js", "index.ts", "server.js", "server.ts", "app.js"} for name in file_names):
        return "node"
    if "Program.cs" in file_names:
        return "dotnet"
    if any(name == "Application.java" for name in file_names) or any("SpringApplication" in _safe_read(Path(file_name)) for file_name in files):
        return "spring"
    if any(name in BUILD_CONFIG_FILES for name in file_names):
        return _service_type_from_build_file(next(name for name in file_names if name in BUILD_CONFIG_FILES))
    return "library"


def _normalize_rel_path(repo_root: Path, value: str | None) -> str | None:
    if not value:
        return None
    normalized = value.replace("\\", "/")
    candidate = (repo_root / normalized).resolve()
    try:
        return str(candidate.relative_to(repo_root)).replace("\\", "/")
    except Exception:
        return normalized.strip("./") or None


def _classify_file(file_path: Path, parsed: ParsedRepo) -> None:
    name_lower = file_path.name.lower()
    content = _safe_read(file_path)

    if "dockerfile" in name_lower:
        parsed.docker_files.append(str(file_path.relative_to(parsed.root)).replace("\\", "/"))
    if name_lower in {"docker-compose.yml", "docker-compose.yaml"}:
        parsed.docker_files.append(str(file_path.relative_to(parsed.root)).replace("\\", "/"))

    if ".github/workflows" in str(file_path) or name_lower in (".travis.yml", "jenkinsfile", "gitlab-ci.yml"):
        parsed.ci_cd_files.append(str(file_path.relative_to(parsed.root)).replace("\\", "/"))

    for entry in _collect_interface_entries(file_path, parsed, content):
        parsed.apis.append(entry)


def _should_include_file(file_path: Path) -> bool:
    if file_path.name in SPECIAL_FILES:
        return True
    if file_path.name.startswith(".env"):
        return True
    if file_path.suffix.lower() in CODE_EXTENSIONS:
        return True
    if file_path.suffix.lower() in {".yaml", ".yml"}:
        return True
    return False


def _is_skipped(path: Path) -> bool:
    return any(part in SKIP_DIRS or part.endswith(".egg-info") for part in path.parts)


def _detect_languages(files: List[Path]) -> List[str]:
    counter = Counter()
    for file_path in files:
        suffix = file_path.suffix.lower().lstrip(".")
        if suffix:
            counter[suffix] += 1
        elif file_path.name == "Dockerfile":
            counter["dockerfile"] += 1
    return [language for language, _ in counter.most_common()]


def _most_common_language(files: List[str]) -> str:
    counter = Counter()
    for rel_path in files:
        suffix = Path(rel_path).suffix.lower().lstrip(".")
        if suffix:
            counter[suffix] += 1
    if not counter:
        return ""
    extension = counter.most_common(1)[0][0]
    labels = {
        "ts": "TypeScript",
        "tsx": "TypeScript",
        "js": "JavaScript",
        "jsx": "JavaScript",
        "py": "Python",
        "go": "Go",
        "java": "Java",
        "cs": "C#",
        "rs": "Rust",
        "json": "JSON",
        "toml": "TOML",
        "yml": "YAML",
        "yaml": "YAML",
    }
    return labels.get(extension, extension.upper())


def _collect_interface_entries(file_path: Path, parsed: ParsedRepo, content: str) -> list[dict]:
    entries: list[dict] = []
    suffix = file_path.suffix.lower()
    file_rel = str(file_path.relative_to(parsed.root)).replace("\\", "/")
    lines = content.splitlines()

    if suffix == ".py":
        entries.extend(_collect_python_public_entries(file_path, parsed, content, lines))
        entries.extend(_collect_python_cli_entries(file_path, parsed, lines))
        entries.extend(_collect_http_entries(file_path, parsed, lines))
    elif suffix in {".js", ".jsx", ".ts", ".tsx"}:
        entries.extend(_collect_js_ts_public_entries(file_path, parsed, lines))
        entries.extend(_collect_http_entries(file_path, parsed, lines))
    elif suffix == ".java":
        entries.extend(_collect_java_public_entries(file_path, parsed, lines))
        entries.extend(_collect_http_entries(file_path, parsed, lines))
    elif suffix == ".go":
        entries.extend(_collect_go_public_entries(file_path, parsed, lines))
        entries.extend(_collect_http_entries(file_path, parsed, lines))

    deduped = _dedupe_api_entries(entries)
    return _cap_and_sort_entries(deduped)


def _collect_http_entries(file_path: Path, parsed: ParsedRepo, lines: list[str]) -> list[dict]:
    entries: list[dict] = []
    file_rel = str(file_path.relative_to(parsed.root)).replace("\\", "/")
    for index, line in enumerate(lines):
        stripped = line.strip()
        for route_pattern in HTTP_ROUTE_PATTERNS:
            if route_pattern["kind"] == "django_path" and file_path.name != "urls.py":
                continue
            if re.search(route_pattern["pattern"], line):
                method = _infer_http_method(route_pattern, stripped, lines[index:index + 4])
                route_text = _extract_http_route_text(route_pattern, stripped, lines[index:index + 4])
                entries.append({"kind": "HTTP", "method": method, "route": route_text, "file": file_rel, "line": index + 1})
    return entries


def _collect_python_public_entries(file_path: Path, parsed: ParsedRepo, content: str, lines: list[str]) -> list[dict]:
    try:
        module = ast.parse(content)
    except SyntaxError:
        return []

    entries: list[dict] = []
    file_rel = str(file_path.relative_to(parsed.root)).replace("\\", "/")
    public_nodes = []
    for node in module.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and not node.name.startswith("_"):
            public_nodes.append((node.lineno, "FUNC", node.name))
        elif isinstance(node, ast.ClassDef):
            public_nodes.append((node.lineno, "CLASS", node.name))

    for lineno, kind, name in sorted(public_nodes, key=lambda item: item[0])[:5]:
        line = lines[lineno - 1].strip() if 0 < lineno <= len(lines) else f"{kind.lower()} {name}"
        route = line or f"{kind.lower()} {name}"
        entries.append({"kind": kind, "method": kind, "route": route, "file": file_rel, "line": lineno})
    return entries


def _collect_python_cli_entries(file_path: Path, parsed: ParsedRepo, lines: list[str]) -> list[dict]:
    entries: list[dict] = []
    file_rel = str(file_path.relative_to(parsed.root)).replace("\\", "/")
    for index, line in enumerate(lines):
        stripped = line.strip()
        if re.search(r'^\s*@\w+\.command\s*\(', line):
            command_name = _extract_click_command_name(lines, index)
            route = command_name or f"decorator:{stripped}"
            entries.append({"kind": "CLI", "method": "CLI", "route": route, "file": file_rel, "line": index + 1})
        elif re.search(r'^\s*add_parser\s*\(\s*["\'\`]', line):
            command_name = _extract_first_string(stripped)
            route = command_name or f"decorator:{stripped}"
            entries.append({"kind": "CLI", "method": "CLI", "route": route, "file": file_rel, "line": index + 1})
    return entries


def _collect_js_ts_public_entries(file_path: Path, parsed: ParsedRepo, lines: list[str]) -> list[dict]:
    entries: list[dict] = []
    file_rel = str(file_path.relative_to(parsed.root)).replace("\\", "/")
    public_nodes: list[dict] = []
    for index, line in enumerate(lines):
        stripped = line.strip()
        if re.search(r'^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z][A-Za-z0-9_]*)\s*\(', line):
            public_nodes.append({"line": index + 1, "kind": "FUNC", "method": "FUNC", "route": stripped})
        elif re.search(r'^\s*(?:export\s+)?class\s+([A-Za-z][A-Za-z0-9_]*)\s*[\(:]', line):
            public_nodes.append({"line": index + 1, "kind": "CLASS", "method": "CLASS", "route": stripped})
    for entry in public_nodes[:5]:
        entry.update({"file": file_rel})
        entries.append(entry)
    return entries


def _collect_java_public_entries(file_path: Path, parsed: ParsedRepo, lines: list[str]) -> list[dict]:
    entries: list[dict] = []
    file_rel = str(file_path.relative_to(parsed.root)).replace("\\", "/")
    for index, line in enumerate(lines):
        stripped = line.strip()
        if re.search(r'^\s*public\s+(static\s+)?[A-Za-z0-9_<>,\[\]\?\s]+\s+([A-Za-z][A-Za-z0-9_]*)\s*\(', line):
            entries.append({"kind": "FUNC", "method": "FUNC", "route": stripped, "file": file_rel, "line": index + 1})
    return entries[:5]


def _collect_go_public_entries(file_path: Path, parsed: ParsedRepo, lines: list[str]) -> list[dict]:
    entries: list[dict] = []
    file_rel = str(file_path.relative_to(parsed.root)).replace("\\", "/")
    for index, line in enumerate(lines):
        stripped = line.strip()
        if re.search(r'^func\s+([A-Z][A-Za-z0-9_]*)\s*\(', line):
            entries.append({"kind": "FUNC", "method": "FUNC", "route": stripped, "file": file_rel, "line": index + 1})
    return entries[:5]


def _infer_http_method(route_pattern: dict, line: str, nearby_lines: list[str]) -> str:
    joined = "\n".join(nearby_lines)
    if "method_group" in route_pattern:
        method = _group_to_method(route_pattern["method_group"], line)
        if route_pattern["kind"] == "decorator_generic":
            return _infer_methods_argument(joined) or "GET"
        return method
    if route_pattern.get("method"):
        if route_pattern["kind"] == "decorator_generic":
            return _infer_methods_argument(joined) or route_pattern["method"]
        return route_pattern["method"]
    return "GET"


def _infer_methods_argument(text: str) -> str | None:
    for candidate in ("POST", "PUT", "DELETE", "PATCH", "GET"):
        if f'methods=["{candidate}"]' in text or f"methods=['{candidate}']" in text or f'methods=\"{candidate}\"' in text:
            return candidate
    match = re.search(r'methods\s*=\s*\[(.*?)\]', text, re.IGNORECASE | re.DOTALL)
    if match:
        for candidate in ("POST", "PUT", "DELETE", "PATCH", "GET"):
            if candidate in match.group(1).upper():
                return candidate
    return None


def _group_to_method(group_index: int, line: str) -> str:
    match = re.search(r'^\s*(?:app|router)\.(get|post|put|delete|patch)\s*\(', line, re.IGNORECASE)
    if match and group_index == 2:
        return match.group(1).upper()
    match = re.search(r'^\s*r\.(GET|POST|PUT|DELETE|PATCH)\s*\(', line, re.IGNORECASE)
    if match and group_index == 1:
        return match.group(1).upper()
    match = re.search(r'^\s*@\w+\.(get|post|put|delete|patch|head|options)\s*\(', line, re.IGNORECASE)
    if match and group_index == 1:
        return match.group(1).upper()
    return "GET"


def _extract_http_route_text(route_pattern: dict, line: str, nearby_lines: list[str]) -> str:
    string_match = _extract_first_string(line)
    if not string_match:
        for nearby in nearby_lines[1:4]:
            string_match = _extract_first_string(nearby.strip())
            if string_match:
                break
    if string_match:
        return string_match
    if route_pattern["kind"] in {"decorator", "decorator_generic", "spring", "spring_generic"}:
        return f"decorator:{line}"
    return line


def _extract_first_string(text: str) -> str | None:
    match = re.search(r'["\'\`]{1}([^"\'\`]+)["\'\`]{1}', text)
    return match.group(1) if match else None


def _extract_click_command_name(lines: list[str], index: int) -> str | None:
    for nearby in lines[index + 1:index + 4]:
        match = re.search(r'^\s*def\s+([A-Za-z][A-Za-z0-9_]*)\s*\(', nearby)
        if match:
            return match.group(1)
    return None


def _dedupe_api_entries(entries: list[dict]) -> list[dict]:
    seen: set[tuple[str, str]] = set()
    deduped: list[dict] = []
    for entry in entries:
        key = (entry["file"], entry["route"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(entry)
    return deduped


def _cap_and_sort_entries(entries: list[dict]) -> list[dict]:
    kind_order = {"HTTP": 0, "CLI": 1, "CLASS": 2, "FUNC": 3}
    per_file_counts: dict[str, int] = {}
    filtered: list[dict] = []
    for entry in sorted(entries, key=lambda item: (item["file"], item.get("line", 0), kind_order.get(item["kind"], 99))):
        if entry["kind"] in {"CLASS", "FUNC"}:
            current = per_file_counts.get(entry["file"], 0)
            if current >= 5:
                continue
            per_file_counts[entry["file"]] = current + 1
        filtered.append(entry)
    filtered.sort(key=lambda item: (item["file"], kind_order.get(item["kind"], 99), item.get("line", 0)))
    return filtered[:50]


def _infer_repo_kind(parsed: ParsedRepo) -> str:
    kinds = {entry.get("kind") for entry in parsed.apis if entry.get("kind")}
    if "HTTP" in kinds and len(kinds - {"HTTP"}) > 0:
        return "mixed"
    if "HTTP" in kinds:
        return "web_server"
    if "CLI" in kinds:
        return "cli_tool"
    if _has_gui_imports(parsed.root):
        return "gui_app"
    if kinds & {"CLASS", "FUNC"}:
        return "library"
    return "library"


def _has_gui_imports(repo_root: Path) -> bool:
    gui_modules = {"tkinter", "PyQt5", "PyQt6", "PySide2", "PySide6", "wx", "kivy"}
    for file_path in repo_root.rglob("*.py"):
        if _is_skipped(file_path):
            continue
        content = _safe_read(file_path)
        try:
            module = ast.parse(content)
        except SyntaxError:
            continue
        for node in module.body:
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                names = []
                if isinstance(node, ast.Import):
                    names = [alias.name.split(".")[0] for alias in node.names]
                elif node.module:
                    names = [node.module.split(".")[0]]
                if any(name in gui_modules for name in names):
                    return True
    return False


def _safe_read(file_path: Path) -> str:
    try:
        return file_path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return ""