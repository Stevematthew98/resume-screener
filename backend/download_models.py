"""Pre-download ML models into the image at build time (run by railpack.json)."""

from sentence_transformers import SentenceTransformer

SentenceTransformer("all-MiniLM-L6-v2")
print("sentence-transformer model cached")
