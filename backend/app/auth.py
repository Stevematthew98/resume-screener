"""Demo authentication — signup / login / logout with JWT sessions.

Clearly labelled as DEMO auth: passwords are salted+hashed (PBKDF2),
sessions are stateless JWTs. A demo recruiter account is seeded on
startup so the product can be tried without signing up:
    demo@recruiter.com / demo1234
"""

import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .db import User, get_session

JWT_ALGORITHM = "HS256"
JWT_EXPIRY_DAYS = 7
DEMO_EMAIL = "demo@recruiter.com"
DEMO_PASSWORD = "demo1234"
DEMO_NAME = "Demo Recruiter"

_bearer = HTTPBearer(auto_error=False)


def _jwt_secret() -> str:
    secret = os.getenv("JWT_SECRET", "").strip()
    if not secret:
        # Dev fallback only — production sets JWT_SECRET in Railway variables.
        secret = "dev-only-insecure-secret-change-me"
    return secret


# ----------------------------------------------------------------------------
# Password hashing (PBKDF2-SHA256, no extra dependencies)
# ----------------------------------------------------------------------------

_ITERATIONS = 200_000


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _ITERATIONS)
    return f"pbkdf2${_ITERATIONS}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, iters, salt_hex, hash_hex = stored.split("$")
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"),
                                 bytes.fromhex(salt_hex), int(iters))
        return hmac.compare_digest(dk.hex(), hash_hex)
    except Exception:
        return False


# ----------------------------------------------------------------------------
# JWT
# ----------------------------------------------------------------------------

def create_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(days=JWT_EXPIRY_DAYS),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> int:
    try:
        payload = jwt.decode(token, _jwt_secret(), algorithms=[JWT_ALGORITHM])
        return int(payload["sub"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired session. Please log in again.")


def get_current_user(creds: HTTPAuthorizationCredentials = Depends(_bearer)) -> User:
    if creds is None or not creds.credentials:
        raise HTTPException(status_code=401, detail="Not signed in.")
    user_id = decode_token(creds.credentials)
    db = get_session()
    try:
        user = db.query(User).filter(User.id == user_id).first()
    finally:
        db.close()
    if user is None:
        raise HTTPException(status_code=401, detail="Account not found. Please log in again.")
    return user


def user_public(u: User) -> dict:
    return {"id": u.id, "email": u.email, "name": u.name,
            "created_at": u.created_at.isoformat() if u.created_at else ""}


def seed_demo_user() -> None:
    """Create the demo recruiter account if it doesn't exist yet."""
    db = get_session()
    try:
        existing = db.query(User).filter(User.email == DEMO_EMAIL).first()
        if existing is None:
            db.add(User(email=DEMO_EMAIL, name=DEMO_NAME,
                        password_hash=hash_password(DEMO_PASSWORD)))
            db.commit()
    finally:
        db.close()
