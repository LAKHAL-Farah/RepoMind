from __future__ import annotations
import re
from typing import List
from analyzers.base_analyzer import BaseAnalyzer, Finding
from ingestion.repo_parser import ParsedRepo


class CodeQualityAnalyzer(BaseAnalyzer):
    def analyze(self, parsed: ParsedRepo) -> List[Finding]:
        findings: List[Finding] = []

        test_found = False

        func_pattern = re.compile(r"\b(def\s+\w+|public\s+void\s+\w+|function\s+\w+)\b")
        todo_pattern = re.compile(r"TODO|FIXME|HACK", re.IGNORECASE)

        for p in parsed.all_files:
            rel = str(p.relative_to(parsed.root))
            name = p.name.lower()
            if re.match(r"test_.*\.py$", name) or name.endswith(".test.ts") or name.endswith("test.java"):
                test_found = True

            try:
                txt = p.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue

            lines = txt.splitlines()
            line_count = len(lines)
            if line_count > 500:
                findings.append(Finding(severity="warning", category="code_quality",
                                        title="Oversized file",
                                        file=rel,
                                        description=f"File has {line_count} lines (>500). Consider splitting."))

            # count functions/methods
            funcs = func_pattern.findall(txt)
            if len(funcs) > 20:
                findings.append(Finding(severity="warning", category="code_quality",
                                        title="God class / file",
                                        file=rel,
                                        description=f"File contains {len(funcs)} function/method declarations (>20)."))

            # TODO/FIXME/HACK
            todos = len(todo_pattern.findall(txt))
            if todos > 5:
                findings.append(Finding(severity="info", category="code_quality",
                                        title="High technical debt markers",
                                        file=rel,
                                        description=f"Found {todos} TODO/FIXME/HACK markers."))

            # Deep nesting: detect sequences of increased indentation levels
            max_indent = 0
            for line in lines:
                stripped = line.lstrip(" ")
                if not stripped:
                    continue
                indent = len(line) - len(stripped)
                # consider 4 spaces per level
                level = indent // 4
                if level > max_indent:
                    max_indent = level
            if max_indent >= 4:
                findings.append(Finding(severity="info", category="code_quality",
                                        title="Deep nesting detected",
                                        file=rel,
                                        description=f"Max nesting level detected: {max_indent} (>=4)."))

        if not test_found:
            findings.append(Finding(severity="warning", category="code_quality",
                                    title="No test files detected",
                                    description="No test files matching common patterns were found."))

        return findings
