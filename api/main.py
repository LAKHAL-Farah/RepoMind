from fastapi import FastAPI
from api.routes import ingest, analyze, chat

app = FastAPI(title="RepoMind API", version="1.0")
app.include_router(ingest.router, prefix="/api")
app.include_router(analyze.router, prefix="/api")
app.include_router(chat.router, prefix="/api")

@app.get("/health")
def health():
    return {"status": "ok"}