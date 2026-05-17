import re
from typing import List
from ingestion.repo_parser import ParsedRepo
from analyzers.base_analyzer import BaseAnalyzer, Finding
from config import CODE_EXTENSIONS

HARDCODED_SECRET_PATTERNS = [
    (r'password\s*=\s*["\'][^"\']+["\']', "Hardcoded password"),
    (r'secret\s*=\s*["\'][^"\']+["\']', "Hardcoded secret"),
    (r'api[_-]?key\s*=\s*["\'][^"\']+["\']', "Hardcoded API key"),
    (r'Bearer\s+[A-Za-z0-9\-_\.]+', "Hardcoded Bearer token"),
]

CORS_WILDCARD = re.compile(r'Access-Control-Allow-Origin.*\*')
SQL_INJECTION_RISK = re.compile(r'(\"|\').*SELECT.*\+.*(\"|\')', re.IGNORECASE)

class SecurityAnalyzer(BaseAnalyzer):
    def analyze(self, parsed: ParsedRepo) -> List[Finding]:
        findings = []
        for file_path in parsed.all_files:
            try:
                content = file_path.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue

            relative = str(file_path.relative_to(parsed.root))

            # Check hardcoded secrets
            for pattern, label in HARDCODED_SECRET_PATTERNS:
                if re.search(pattern, content, re.IGNORECASE):
                    findings.append(Finding(
                        severity="critical", category="security",
                        title=label, file=relative,
                        description=f"Potential {label.lower()} detected in {relative}. "
                                    "Move secrets to environment variables or a secrets manager.",
                    ))

            # CORS wildcard
            if CORS_WILDCARD.search(content):
                findings.append(Finding(
                    severity="warning", category="security",
                    title="Permissive CORS policy", file=relative,
                    description="Wildcard CORS origin (*) detected. "
                                "Restrict to known domains, especially if credentials are enabled.",
                ))

            # SQL injection risk
            if SQL_INJECTION_RISK.search(content):
                findings.append(Finding(
                    severity="critical", category="security",
                    title="Potential SQL injection", file=relative,
                    description="String concatenation in SQL query detected. Use parameterized queries.",
                ))

        return findings