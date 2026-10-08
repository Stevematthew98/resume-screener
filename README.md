# Resume Screener — NLP-based candidate matching

Upload a resume (PDF/DOCX) and a job description; the backend runs an 8-step NLP
pipeline and returns a fit assessment with a full, inspectable breakdown.

Monorepo:

- `backend/` — Python FastAPI (`app/main.py`, `app/pipeline.py`)
- `frontend/` — Vite + React single-page app

## The 8 steps (as implemented)

1. **Ingest** — file metadata (name, type, size), JD length.
2. **Extraction** — PyMuPDF for PDFs (pdfplumber fallback), python-docx for Word;
   text split into summary / experience / skills / education via heading regex.
3. **Preprocessing** — spaCy `en_core_web_sm` tokenize + lemmatize; skill extraction
   with a `PhraseMatcher` over `backend/data/skills.json` (~200-skill taxonomy with
   aliases, e.g. `ML` → `machine learning`); experience years from date ranges;
   degrees and job titles via regex/heuristics. PII (emails, phones) redacted.
4. **Vectors** — scikit-learn TF-IDF cosine (resume vs JD) plus
   `sentence-transformers/all-MiniLM-L6-v2` embedding cosine per section
   (full text, skills, experience) vs the JD.
5. **Matching / scoring** — hard filter on minimum experience.
   Single mode (`/api/analyze`): weighted score
   `0.35·emb_full + 0.25·emb_skills + 0.15·emb_experience + 0.15·skill_overlap + 0.10·tfidf`.
   Recruiter batch mode (`/api/screen/stream`): explainable fixed weights
   `0.50·skills_match + 0.25·jd_similarity + 0.15·experience + 0.10·education`,
   each component shown with its point contribution.
   Bands: ≥0.65 Strong match · 0.40–0.65 Worth reviewing · <0.40 Weak match.
   Matched vs missing JD skills listed.
6. **Transparency** — full score breakdown, method note, fairness note
   (names/colleges never used in scoring), limitations.
7. **Output** — final result object with band, score, facts.
8. **Feedback hook** — `analysis_id` returned for `POST /api/feedback`.

Bands are assessments, not guarantees — the final decision always belongs to a human.

## API

- `GET /api/health` → `{"status": "ok"}`
- `POST /api/analyze` (multipart): `resume` (PDF/DOCX, ≤10 MB),
  `job_description` (text), `min_experience_years` (float, optional, default 0)
- `POST /api/feedback`: `{"analysis_id": "...", "verdict": "good_fit"|"bad_fit"}`
- `GET /api/feedback/stats` → counts of recorded verdicts

## Run locally

Backend (Python 3.10+):

```bash
cd backend
pip install -r requirements.txt
python -m spacy download en_core_web_sm
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"
uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
npm install
VITE_API_URL=http://localhost:8000 npm run dev
```

## Deploy

- **Backend → Railway** from `backend/`: Railpack build pre-downloads the spaCy and
  sentence-transformer models into the image (`railpack.json` sets the start command
  `uvicorn app.main:app --host 0.0.0.0 --port $PORT` and the model pre-download step).
- **Frontend → Vercel** from `frontend/` (root directory = `frontend`);
  set `VITE_API_URL` to the live Railway URL in production env.

## Batch screening (recruiter flow)

- `POST /api/screen/stream` (multipart, SSE `text/event-stream`): `resumes` (1–20
  PDF/DOCX files), `job` (JSON: `title`, `company`, `jd_text`, `required_skills`,
  `preferred_skills`, `min_experience_years`, `education_requirements`).
  Streams `job_ready` → per-resume `resume_start` → 8 `stage` events (same NLP
  pipeline, plain-language labels + one-line summaries from real outputs) →
  `resume_done` (full candidate profile) → `batch_complete` (ranking).
- Candidate scoring (fixed, explainable weights):
  `0.50·skills_match + 0.25·jd_similarity + 0.15·experience + 0.10·education`.
  Every component is shown with its point contribution and a grounded,
  evidence-only explanation.
- `POST /api/candidates/status`: `{"resume_id","status","notes","reject_reason"}` —
  statuses: New, Screened, Shortlisted, Under Review, Rejected. **Human-only**:
  scoring never changes a status; a low score can never auto-reject.
- `GET /api/candidates/statuses` → all known candidate statuses.
- Bias rules: names, colleges, contact details and other identity markers are
  never scoring inputs; personal info (name/email/phone) is extracted only for
  display in candidate profiles. Files are processed in memory and never stored.

## Known limitations

- Feedback and candidate-status stores are **in-memory** — lost on every backend
  redeploy. Use a durable database before any real use.
- No OCR: scanned/image PDFs with no text layer extract nothing.
- Skill taxonomy is demo-grade (~200 entries); niche domains need a bigger list.
- Experience parsing is regex-based and approximate.
- No ML training in v1: scoring is similarity + rules, no learned ranker.

## Roadmap (deferred)

- Login / recruiter authentication and multi-user workspaces
- Persistent database for candidates, statuses, notes and feedback
- Dashboard charts (score distributions, funnel by status, skill-gap analytics)
- CSV / Excel / PDF export of the shortlist
- Screening history across batches
