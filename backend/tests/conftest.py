"""Offline model bootstrap for tests.

Loads the pre-downloaded sentence-transformer snapshot from the local
HuggingFace cache (no network) and injects it into pipeline._model so
ensure_models() never hits the network during tests.
"""

import os
from pathlib import Path

import pytest
from sentence_transformers import SentenceTransformer

from app import pipeline


def _local_minilm_path() -> str:
    base = Path(os.environ.get(
        "MINILM_SNAPSHOT",
        str(Path.home() / ".cache/huggingface/hub/models--sentence-transformers--all-MiniLM-L6-v2"
             "/snapshots/1110a243fdf4706b3f48f1d95db1a4f5529b4d41"),
    ))
    if not base.is_dir():
        pytest.skip(f"MiniLM snapshot not found at {base}; cannot run NLP tests offline.")
    return str(base)


@pytest.fixture(scope="session", autouse=True)
def _offline_models():
    pipeline._model = SentenceTransformer(_local_minilm_path())
    pipeline._load_nlp()  # spaCy model ships with the venv
    yield
