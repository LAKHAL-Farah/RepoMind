from fastapi import APIRouter, HTTPException
from api.state import _repo_store

router = APIRouter()


def _finding_to_dict(finding):
	return {
		"category": finding.category,
		"severity": finding.severity,
		"title": finding.title,
		"description": finding.description,
		"file": getattr(finding, "file", ""),
	}


@router.get("/analyze/{repo_id}")
def analyze_repo(repo_id: str, category: str | None = None):
	if repo_id not in _repo_store:
		raise HTTPException(status_code=404, detail="Repo not ingested. Call /ingest first.")

	findings = _repo_store[repo_id]["findings"]
	grouped = {"security": [], "devops": [], "architecture": [], "code_quality": []}
	for finding in findings:
		if finding.category not in grouped:
			continue
		if category and finding.category != category:
			continue
		grouped[finding.category].append(_finding_to_dict(finding))

	if category:
		return {category: grouped.get(category, [])}
	return grouped
