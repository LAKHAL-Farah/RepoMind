from __future__ import annotations
import re
from typing import List, Dict, Set
from analyzers.base_analyzer import BaseAnalyzer, Finding
from ingestion.repo_parser import ParsedRepo


class ArchitectureAnalyzer(BaseAnalyzer):
    def analyze(self, parsed: ParsedRepo) -> List[Finding]:
        findings: List[Finding] = []
        service_names = [svc["name"] if isinstance(svc, dict) else svc for svc in parsed.services]

        svc_count = len(service_names)
        if svc_count == 0:
            findings.append(Finding(severity="info", category="architecture",
                                    title="Monolithic structure detected",
                                    description="No service submodules were detected; repository appears monolithic."))
        elif svc_count <= 2:
            findings.append(Finding(severity="info", category="architecture",
                                    title="Modular monolith",
                                    description=f"Detected {svc_count} service(s); appears modular or small microservice set."))
        else:
            findings.append(Finding(severity="info", category="architecture",
                                    title="Microservices detected",
                                    description=f"Detected {svc_count} services; repository looks like a microservices architecture."))

        # Missing gateway
        if svc_count > 2:
            gateway_found = any("gateway" in str(p).lower() for p in parsed.all_files)
            if not gateway_found:
                findings.append(Finding(severity="warning", category="architecture",
                                        title="No API gateway detected",
                                        description="Multiple services detected but no gateway-related file name was found."))

        # Service discovery
        if svc_count > 2:
            # look for references to common service discovery tools
            sd_patterns = re.compile(r"eureka|consul|nacos", re.IGNORECASE)
            sd_found = False
            for p in parsed.all_files:
                try:
                    txt = p.read_text(encoding="utf-8", errors="ignore")
                except Exception:
                    continue
                if sd_patterns.search(txt):
                    sd_found = True
                    break
            if not sd_found:
                findings.append(Finding(severity="warning", category="architecture",
                                        title="No service discovery detected",
                                        description="No references to Eureka/Consul/Nacos were found."))

        # Detect circular-looking dependencies by scanning imports per service
        service_imports: Dict[str, Set[str]] = {s: set() for s in service_names}
        for p in parsed.all_files:
            rel = str(p.relative_to(parsed.root))
            try:
                txt = p.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue
            # simple import extraction
            for line in txt.splitlines():
                line = line.strip()
                if line.startswith("import ") or line.startswith("from "):
                    # naive: check for service names in the import line
                    for svc in service_names:
                        if svc in rel or svc in line:
                            # attribute the import to the file's service (if any)
                            owner = next((s for s in service_names if s in rel), "root")
                            if svc != owner:
                                service_imports.setdefault(owner, set()).add(svc)

        # find mutual imports
        for a, deps in service_imports.items():
            for b in deps:
                if a in service_imports.get(b, set()):
                    findings.append(Finding(severity="warning", category="architecture",
                                            title="Possible circular dependency",
                                            description=f"Service '{a}' and '{b}' appear to import each other."))

        # overly large services
        for svc in service_names:
            count = 0
            for p in parsed.all_files:
                if svc in str(p):
                    count += 1
            if count > 50:
                findings.append(Finding(severity="info", category="architecture",
                                        title="Large service detected",
                                        file=svc,
                                        description=f"Service '{svc}' contains {count} files (>{50}). Consider splitting responsibilities."))

        return findings
