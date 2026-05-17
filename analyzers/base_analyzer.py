from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List
from ingestion.repo_parser import ParsedRepo

@dataclass
class Finding:
    severity: str       # "critical" | "warning" | "info"
    category: str       # e.g. "security", "architecture"
    title: str
    description: str
    file: str = ""

class BaseAnalyzer(ABC):
    @abstractmethod
    def analyze(self, parsed: ParsedRepo) -> List[Finding]:
        """Run analysis and return a list of findings."""
        ...