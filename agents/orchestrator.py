from __future__ import annotations
from agents.architecture_agent import ArchitectureAgent
from agents.security_agent import SecurityAgent
from agents.devops_agent import DevOpsAgent

AGENT_KEYWORDS = {
    "security": ["secret", "cors", "jwt", "vulnerability", "injection", "exposed", "auth"],
    "devops":   ["docker", "ci/cd", "deploy", "container", "pipeline", "kubernetes", "k8s"],
    "architecture": ["service", "gateway", "architecture", "structure", "dependency",
                     "microservice", "pattern", "layer", "flow"],
}

_agents = {
    "security": SecurityAgent(),
    "devops": DevOpsAgent(),
    "architecture": ArchitectureAgent(),
}

def route_question(question: str, repo_id: str, parsed_repo, findings: list) -> str:
    """Determine which agent should handle this question and return its answer."""
    q_lower = question.lower()
    matched_agent = "architecture"   # default

    for agent_name, keywords in AGENT_KEYWORDS.items():
        if any(kw in q_lower for kw in keywords):
            matched_agent = agent_name
            break

    return _agents[matched_agent].answer(question, repo_id, parsed_repo, findings)