from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import ingest, analyze, chat, security

app = FastAPI(title="RepoMind API", version="1.0")

# Allow local Next.js frontend to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest.router, prefix="/api")
app.include_router(analyze.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(security.router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}