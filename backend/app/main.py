"""Resume Screener backend — FastAPI service."""

import os
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .pipeline import analyze_resume, ensure_models

app = FastAPI(title="Resume Screener API", version="1.0.0")

_frontend = os.getenv("FRONTEND_URL", "*")
_origins = [o.strip() for o in _frontend.split(",") if o.strip()] if _frontend != "*" else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory feedback store. LIMITATION: lost on every redeploy/restart;
# use a durable database before any real use.
_feedback_store: dict[str, list[str]] = {}


class FeedbackIn(BaseModel):
    analysis_id: str
    verdict: str  # "good_fit" | "bad_fit"


@app.on_event("startup")
def _startup():
    # Models are pre-downloaded into the image at build time; this just loads them.
    ensure_models()


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/analyze")
async def analyze(
    resume: UploadFile = File(...),
    job_description: str = Form(""),
    min_experience_years: float = Form(0.0),
):
    filename = resume.filename or "resume"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ("pdf", "docx", "doc"):
        raise HTTPException(status_code=400, detail="Only PDF and DOCX resumes are supported.")
    data = await resume.read()
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB).")
    # Resume bytes are processed in memory and never logged or persisted.
    result = analyze_resume(data, filename, job_description, min_experience_years)
    return result


@app.post("/api/feedback")
def feedback(item: FeedbackIn):
    if item.verdict not in ("good_fit", "bad_fit"):
        raise HTTPException(status_code=400, detail="verdict must be 'good_fit' or 'bad_fit'.")
    _feedback_store.setdefault(item.analysis_id, []).append(item.verdict)
    return {
        "analysis_id": item.analysis_id,
        "verdicts_recorded": len(_feedback_store[item.analysis_id]),
        "note": "Feedback is stored in memory and is lost on redeploy.",
    }


@app.get("/api/feedback/stats")
def feedback_stats():
    total = sum(len(v) for v in _feedback_store.values())
    return {"analyses_with_feedback": len(_feedback_store), "total_verdicts": total}
