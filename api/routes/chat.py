from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from agents.orchestrator import route_question
from api.routes.ingest import _repo_store

router = APIRouter()

class ChatRequest(BaseModel):
    repo_id: str
    question: str

@router.post("/chat")
def chat(req: ChatRequest):
    if req.repo_id not in _repo_store:
        raise HTTPException(status_code=404, detail="Repo not ingested. Call /ingest first.")
    store = _repo_store[req.repo_id]
    answer = route_question(
        question=req.question,
        repo_id=req.repo_id,
        parsed_repo=store["parsed"],
        findings=store["findings"],
    )
    return {"answer": answer}