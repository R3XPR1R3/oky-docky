from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
import time


COOKIE_NAME = "oky_admin_session"
SESSION_MAX_AGE = int(os.getenv("ADMIN_SESSION_MAX_AGE", str(12 * 60 * 60)))
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "").strip()
ADMIN_PASSWORD_HASH = os.getenv("ADMIN_PASSWORD_HASH", "").strip()
SESSION_SECRET = os.getenv("ADMIN_SESSION_SECRET", "").strip()


def is_configured() -> bool:
    if not (ADMIN_USERNAME and ADMIN_PASSWORD_HASH and SESSION_SECRET):
        return False
    try:
        algorithm, raw_iterations, salt, digest = ADMIN_PASSWORD_HASH.split(":", 3)
        return algorithm == "pbkdf2_sha256" and int(raw_iterations) >= 100_000 and bool(salt and digest)
    except ValueError:
        return False


def hash_password(password: str, *, iterations: int = 310_000) -> str:
    salt = secrets.token_bytes(18)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return ":".join(
        (
            "pbkdf2_sha256",
            str(iterations),
            base64.urlsafe_b64encode(salt).decode("ascii").rstrip("="),
            base64.urlsafe_b64encode(digest).decode("ascii").rstrip("="),
        )
    )


def verify_password(username: str, password: str) -> bool:
    if not is_configured() or not hmac.compare_digest(username, ADMIN_USERNAME):
        return False
    try:
        algorithm, raw_iterations, raw_salt, raw_digest = ADMIN_PASSWORD_HASH.split(":", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        salt = base64.urlsafe_b64decode(raw_salt + "=" * (-len(raw_salt) % 4))
        expected = base64.urlsafe_b64decode(raw_digest + "=" * (-len(raw_digest) % 4))
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(raw_iterations))
        return hmac.compare_digest(actual, expected)
    except (TypeError, ValueError):
        return False


def create_session_token(username: str) -> str:
    expires = int(time.time()) + SESSION_MAX_AGE
    nonce = secrets.token_urlsafe(12)
    payload = f"{username}:{expires}:{nonce}"
    signature = hmac.new(SESSION_SECRET.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).digest()
    encoded_payload = base64.urlsafe_b64encode(payload.encode("utf-8")).decode("ascii").rstrip("=")
    encoded_signature = base64.urlsafe_b64encode(signature).decode("ascii").rstrip("=")
    return f"{encoded_payload}.{encoded_signature}"


def verify_session_token(token: str) -> str | None:
    if not is_configured() or not token or "." not in token:
        return None
    try:
        encoded_payload, encoded_signature = token.split(".", 1)
        payload = base64.urlsafe_b64decode(encoded_payload + "=" * (-len(encoded_payload) % 4)).decode("utf-8")
        signature = base64.urlsafe_b64decode(encoded_signature + "=" * (-len(encoded_signature) % 4))
        expected = hmac.new(SESSION_SECRET.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).digest()
        username, raw_expires, _ = payload.split(":", 2)
        if not hmac.compare_digest(signature, expected):
            return None
        if int(raw_expires) < int(time.time()) or not hmac.compare_digest(username, ADMIN_USERNAME):
            return None
        return username
    except (UnicodeDecodeError, ValueError):
        return None
