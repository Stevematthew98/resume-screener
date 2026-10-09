"""Pre-download ML models into the image at build time (run at image build time)."""

from sentence_transformers import SentenceTransformer

SentenceTransformer("all-MiniLM-L6-v2")
print("sentence-transformer model cached")
