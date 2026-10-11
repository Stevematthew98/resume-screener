"""Tests for the Step-3 NLP gaps: explicit extraction errors, not-detected
wording, structured warnings, and matching behaviour across resume quality
levels and file formats.

Covers the prompt's Feature 8 list: strong / partial / poor matches, missing
skills, empty resumes, unreadable files, duplicate uploads, different resume
formats, and missing job-description requirements.
"""

import io

import pymupdf
from docx import Document

from app.pipeline import analyze_resume
from app.screening import (
    _skills_component,
    build_candidate,
    normalize_job,
    screen_one_resume,
)

# ----------------------------------------------------------------------------
# Fixtures: synthetic resumes + job
# ----------------------------------------------------------------------------

JD = (
    "We are hiring a Data Scientist. Required: Python, SQL, Machine Learning. "
    "You will build models with Pandas and NumPy, and some NLP work. "
    "Power BI experience is a plus."
)

STRONG_RESUME = """Alexander Mathew
alex@example.com | +91 98765 43210

Professional Summary
Data Scientist with 4 years of experience building ML models in Python.

Skills
Python, SQL, Machine Learning, Pandas, NumPy, NLP, scikit-learn, TensorFlow

Work Experience
Data Scientist, XYZ Analytics, Jan 2022 - Dec 2024
- Built churn models with Python and scikit-learn.
Data Analyst, ABC Corp, Jun 2020 - Dec 2021
- Wrote SQL pipelines and dashboards.

Education
B.Sc Data Science, Bengaluru University, 2020
"""

PARTIAL_RESUME = """Jordan Lee

Summary
Analyst who likes data.

Skills
Python, Excel

Work Experience
Business Analyst, Somewhere Inc
- Made reports.

Education
BBA, 2019
"""

POOR_RESUME = """Sam Cook

Summary
Chef with 10 years in kitchens.

Skills
Cooking, Baking, Menu planning

Work Experience
Head Chef, Tasty Place, 2015 - 2025

Education
Culinary Diploma, 2014
"""


def make_pdf(text: str) -> bytes:
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 72), text, fontsize=11)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def make_docx(text: str) -> bytes:
    doc = Document()
    for line in text.splitlines():
        doc.add_paragraph(line)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


JOB = normalize_job({
    "title": "Data Scientist",
    "jd_text": JD,
    "required_skills": ["python", "sql", "machine learning"],
    "preferred_skills": ["power bi"],
    "min_experience_years": 2,
    "education_requirements": "B.Sc",
})


def candidate_for(pdf_text: str, job=JOB):
    data = make_pdf(pdf_text)
    kinds = list(screen_one_resume(data, "resume.pdf", job, "rid-1"))
    assert kinds[-1][0] == "candidate", f"expected candidate, got {kinds[-1][0]}"
    return kinds[-1][1]


# ----------------------------------------------------------------------------
# Feature 8: matching quality levels
# ----------------------------------------------------------------------------

def test_strong_match_outranks_partial_outranks_poor():
    strong = candidate_for(STRONG_RESUME)
    partial = candidate_for(PARTIAL_RESUME)
    poor = candidate_for(POOR_RESUME)
    assert strong["score"] > partial["score"] > poor["score"]
    assert strong["band"] == "Strong match"
    assert poor["band"] == "Weak match"


def test_strong_match_detects_required_skills():
    cand = candidate_for(STRONG_RESUME)
    for skill in ("python", "sql", "machine learning"):
        assert skill in cand["matched_skills"], f"{skill} should be detected"
    assert "power bi" in cand["components"]["skills"]["preferred_missing"]


def test_missing_skills_are_not_detected_not_absent():
    cand = candidate_for(STRONG_RESUME)
    assert "detection_note" in cand
    assert "Not detected" in cand["detection_note"]
    assert "not proof" in cand["detection_note"]
    # the legacy key is preserved for API compatibility
    assert "missing_skills" in cand


def test_required_vs_preferred_distinction():
    # required listed -> basis is the required list
    comp = _skills_component(
        ["python", "power bi"], ["python"], ["power bi"], ["python", "sql"])
    assert comp["matched"] == ["python"]
    assert comp["missing"] == []
    assert comp["preferred_matched"] == ["power bi"]
    assert comp["preferred_missing"] == []
    assert "detection_note" in comp
    # no required listed -> falls back to JD-extracted skills
    comp2 = _skills_component(["python"], [], [], ["python", "sql"])
    assert comp2["matched"] == ["python"]
    assert comp2["missing"] == ["sql"]


# ----------------------------------------------------------------------------
# Feature 1: extraction failures are explicit errors, never silent scores
# ----------------------------------------------------------------------------

def test_empty_file_is_processing_error_not_score():
    result = analyze_resume(b"", "resume.pdf", JD)
    assert result["processing_error"] is not None
    assert "empty" in result["processing_error"].lower()


def test_corrupt_pdf_is_processing_error():
    result = analyze_resume(b"\x00\x01not a pdf at all\xff\xfe", "resume.pdf", JD)
    assert result["processing_error"] is not None
    assert "could not" in result["processing_error"].lower() or \
           "no readable text" in result["processing_error"].lower()


def test_unsupported_format_is_processing_error():
    result = analyze_resume(b"just some text", "resume.txt", JD)
    err = result["processing_error"]
    assert err is not None
    assert ".txt" in err or "unsupported" in err.lower()


def test_failed_extraction_never_yields_candidate():
    kinds = list(screen_one_resume(b"\x00\x01junk", "resume.pdf", JOB, "rid-x"))
    kinds_only = [k for k, _ in kinds]
    assert "error" in kinds_only
    assert "candidate" not in kinds_only
    err_payload = dict((k, p) for k, p in kinds)["error"]
    assert err_payload["message"]


def test_duplicate_uploads_score_identically():
    data = make_pdf(STRONG_RESUME)
    c1 = list(screen_one_resume(data, "a.pdf", JOB, "r1"))[-1][1]
    c2 = list(screen_one_resume(data, "b.pdf", JOB, "r2"))[-1][1]
    assert c1["score"] == c2["score"]
    assert c1["matched_skills"] == c2["matched_skills"]


# ----------------------------------------------------------------------------
# Feature 8: formats + missing JD requirements
# ----------------------------------------------------------------------------

def test_docx_format_supported():
    data = make_docx(STRONG_RESUME)
    result = analyze_resume(data, "resume.docx", JD)
    assert result["processing_error"] is None
    assert "python" in result["step3_preprocessing"]["skills_found"]


def test_pdf_format_supported():
    result = analyze_resume(make_pdf(STRONG_RESUME), "resume.pdf", JD)
    assert result["processing_error"] is None
    assert result["step2_extraction"]["words_extracted"] > 30


def test_jd_without_detectable_skills_is_graceful():
    job = normalize_job({"title": "Mystery role", "jd_text": "We need a nice person."})
    cand = candidate_for(STRONG_RESUME, job=job)
    assert 0.0 <= cand["score"] <= 1.0
    assert any("limited signal" in w for w in cand["warnings"])


# ----------------------------------------------------------------------------
# Feature 6: warnings and uncertainty
# ----------------------------------------------------------------------------

def test_warnings_present_on_candidate():
    cand = candidate_for(PARTIAL_RESUME)
    assert isinstance(cand["warnings"], list)
    assert any("experience" in w.lower() for w in cand["warnings"])


def test_warnings_present_on_analyze_result():
    result = analyze_resume(make_pdf(PARTIAL_RESUME), "resume.pdf", JD)
    assert isinstance(result["step7_result"]["warnings"], list)
    assert result["step7_result"]["warnings"]


def test_explanation_cites_evidence_only():
    cand = candidate_for(PARTIAL_RESUME)  # missing required skills -> note appears
    text = " ".join(cand["explanation"]).lower()
    assert "not detected in the resume" in text
    # never claims proof of lacking a skill
    assert "lacks" not in text and "does not have" not in text
