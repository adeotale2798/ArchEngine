import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import JWT_SECRET, JWT_TTL_MINUTES

ALGO = "HS256"


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except ValueError:
        return False


def create_token(user_id: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=JWT_TTL_MINUTES)
    return jwt.encode({"sub": user_id, "exp": exp, "typ": "access"}, JWT_SECRET, algorithm=ALGO)


def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[ALGO])


def new_share_token() -> str:
    return secrets.token_urlsafe(32)


def sha256(v: str) -> str:
    return hashlib.sha256(v.encode()).hexdigest()
