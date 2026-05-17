from typing import List
from ingestion.repo_parser import ParsedRepo
from analyzers.base_analyzer import BaseAnalyzer, Finding

class DevOpsAnalyzer(BaseAnalyzer):
    def analyze(self, parsed: ParsedRepo) -> List[Finding]:
        findings = []

        if not parsed.docker_files:
            findings.append(Finding(
                severity="info", category="devops",
                title="No Dockerfile detected",
                description="The repository has no Dockerfile. Consider containerizing for consistent deployments.",
            ))

        if not parsed.ci_cd_files:
            findings.append(Finding(
                severity="warning", category="devops",
                title="No CI/CD pipeline detected",
                description="No CI/CD configuration found (GitHub Actions, Travis, Jenkins, etc.). "
                            "Automated testing and deployment pipelines are strongly recommended.",
            ))

        for df_path in parsed.docker_files:
            full_path = parsed.root / df_path
            try:
                content = full_path.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue

            if "COPY . ." in content and "RUN pip install" in content and "FROM" in content.split("RUN pip install")[0].count("FROM") < 2:
                findings.append(Finding(
                    severity="info", category="devops",
                    title="Single-stage Docker build", file=df_path,
                    description="Dependencies are compiled in the final image. "
                                "Consider multi-stage builds to reduce image size.",
                ))

            if "HEALTHCHECK" not in content:
                findings.append(Finding(
                    severity="info", category="devops",
                    title="Missing HEALTHCHECK", file=df_path,
                    description="Docker image has no HEALTHCHECK instruction. "
                                "Add one so orchestrators (Kubernetes, Compose) can detect unhealthy containers.",
                ))

        return findings