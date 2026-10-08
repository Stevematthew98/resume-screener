"""Resume Screener backend — FastAPI service."""

import json
import os
import uuid
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .pipeline import STAGE_ORDER, analyze_resume, ensure_models
from .screening import (
    build_candidate,
    normalize_job,
    ranking_row,
    screen_one_resume,
)

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

# In-memory candidate screening store: resume_id -> {status, notes,
# reject_reason, filename, updated_at}. LIMITATION: lost on redeploy.
_candidate_store: dict[str, dict] = {}

CANDIDATE_STATUSES = ("New", "Screened", "Shortlisted", "Under Review", "Rejected")


class FeedbackIn(BaseModel):
    analysis_id: str
    verdict: str  # "good_fit" | "bad_fit"


class CandidateStatusIn(BaseModel):
    resume_id: str
    status: str  # one of CANDIDATE_STATUSES — set by humans only, never by scoring
    notes: str = ""
    reject_reason: str = ""


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


# ----------------------------------------------------------------------------
# Batch screening (recruiter flow): POST /api/screen/stream (SSE)
# ----------------------------------------------------------------------------

MAX_BATCH_FILES = 20
MAX_FILE_BYTES = 10 * 1024 * 1024
ALLOWED_EXTS = ("pdf", "docx", "doc")


def _check_upload(filename: str, data: bytes) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTS:
        raise HTTPException(status_code=400,
                            detail=f"'{filename}': only PDF and DOCX resumes are supported.")
    if not data:
        raise HTTPException(status_code=400, detail=f"'{filename}' is empty.")
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(status_code=400, detail=f"'{filename}' exceeds 10 MB.")
    return ext


def _sse(obj: dict) -> str:
    return "data: " + json.dumps(obj, default=str) + "\n\n"


@app.post("/api/screen/stream")
async def screen_stream(resumes: list[UploadFile] = File(...), job: str = Form(...)):
    """Screen a batch of resumes with live per-resume stage events (SSE).

    Form fields: resumes (1..20 files), job (JSON: title, company, jd_text,
    required_skills, preferred_skills, min_experience_years, education_requirements).
    Event types: job_ready, resume_start, stage, resume_done, batch_complete, error.
    """
    try:
        job_spec = normalize_job(json.loads(job))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job JSON.")
    if not job_spec["jd_text"]:
        raise HTTPException(status_code=400, detail="Job description text is required.")
    if not resumes:
        raise HTTPException(status_code=400, detail="Upload at least one resume.")
    if len(resumes) > MAX_BATCH_FILES:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_BATCH_FILES} resumes per batch.")

    items: list[tuple[str, bytes]] = []
    for up in resumes:
        filename = up.filename or "resume"
        data = await up.read()
        _check_upload(filename, data)
        items.append((filename, data))
    # Resume bytes are processed in memory and never logged or persisted.

    async def event_gen():
        total = len(items)
        yield _sse({"type": "job_ready", "total": total,
                    "job": {"title": job_spec["title"], "company": job_spec["company"]}})
        ranking: list[dict] = []
        for idx, (filename, data) in enumerate(items):
            resume_id = uuid.uuid4().hex
            _candidate_store[resume_id] = {
                "status": "New", "notes": "", "reject_reason": "",
                "filename": filename,
            }
            yield _sse({"type": "resume_start", "resume_id": resume_id,
                        "filename": filename, "index": idx, "total": total})
            try:
                for kind, payload in screen_one_resume(data, filename, job_spec, resume_id):
                    if kind == "stage":
                        yield _sse({"type": "stage", "resume_id": resume_id,
                                    "filename": filename, "index": idx, "total": total,
                                    **payload})
                    else:
                        _candidate_store[resume_id]["status"] = "Screened"
                        row = ranking_row(payload)
                        row["status"] = "Screened"
                        ranking.append(row)
                        yield _sse({"type": "resume_done", "resume_id": resume_id,
                                    "filename": filename, "index": idx, "total": total,
                                    "candidate": payload})
            except Exception as exc:  # one bad file must not kill the batch
                yield _sse({"type": "resume_error", "resume_id": resume_id,
                            "filename": filename, "index": idx, "total": total,
                            "message": "Could not analyse this file."})
        ranking.sort(key=lambda r: r["score"], reverse=True)
        for rank, row in enumerate(ranking, start=1):
            row["rank"] = rank
        yield _sse({"type": "batch_complete", "total": total,
                    "screened": len(ranking), "ranking": ranking})

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/candidates/status")
def set_candidate_status(item: CandidateStatusIn):
    """Human-only status change. Scoring never sets statuses automatically —
    a low score can never reject a candidate."""
    if item.status not in CANDIDATE_STATUSES:
        raise HTTPException(status_code=400,
                            detail=f"status must be one of {CANDIDATE_STATUSES}.")
    entry = _candidate_store.get(item.resume_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Unknown resume_id.")
    entry.update({
        "status": item.status,
        "notes": item.notes or "",
        "reject_reason": item.reject_reason if item.status == "Rejected" else "",
    })
    return {"resume_id": item.resume_id, **entry}


@app.get("/api/candidates/statuses")
def get_candidate_statuses():
    return {rid: {"status": e["status"], "notes": e["notes"],
                  "reject_reason": e["reject_reason"], "filename": e["filename"]}
            for rid, e in _candidate_store.items()}
