from __future__ import annotations

import json
import os
import smtplib
import secrets
import time
import uuid
from datetime import datetime, timezone
from html import escape
from collections import defaultdict
from io import BytesIO
from email.message import EmailMessage
from pathlib import Path
from typing import Any, Dict, Optional, Literal
from urllib.parse import urlparse

import base64
import re

import httpx
from fastapi import FastAPI, HTTPException, Query, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, Response, JSONResponse
from pydantic import BaseModel, Field
from pypdf import PdfReader

from .core.mapping import build_pdf_field_values
from .core.template_store import load_template, list_templates, load_template_meta
from .core.transforms import apply_transforms
from .core.admin_auth import (
    ADMIN_USERNAME,
    COOKIE_NAME,
    SESSION_MAX_AGE,
    create_session_token,
    is_configured as admin_auth_configured,
    verify_password,
    verify_session_token,
)
from .core.analytics import metrics as analytics_metrics, record_event
from .engines.acroform import fill_acroform_pdf

app = FastAPI()

# ---------------------------------------------------------------------------
# Security configuration
# ---------------------------------------------------------------------------

# CORS: restrict to known origins (comma-separated env var), fallback to "*"
_allowed_origins = os.getenv("CORS_ALLOWED_ORIGINS", "*")
CORS_ORIGINS: list[str] = (
    [o.strip() for o in _allowed_origins.split(",") if o.strip()]
    if _allowed_origins != "*"
    else ["*"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Admin-Key"],
)

# Admin API key: set ADMIN_API_KEY env var to protect /api/admin/* endpoints
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "")
ADMIN_COOKIE_SECURE = os.getenv("ADMIN_COOKIE_SECURE", "1") != "0"

# Rate limiting: simple in-memory sliding window
RATE_LIMIT_WINDOW = int(os.getenv("RATE_LIMIT_WINDOW", "60"))        # seconds
RATE_LIMIT_MAX = int(os.getenv("RATE_LIMIT_MAX", "120"))             # requests per window
RATE_LIMIT_RENDER_MAX = int(os.getenv("RATE_LIMIT_RENDER_MAX", "10"))  # PDF renders per window

_rate_buckets: Dict[str, list[float]] = defaultdict(list)


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _check_rate_limit(ip: str, max_requests: int = RATE_LIMIT_MAX) -> None:
    """Raise 429 if the IP exceeded its quota in the current window."""
    now = time.time()
    bucket = _rate_buckets[ip]
    # Prune old entries
    cutoff = now - RATE_LIMIT_WINDOW
    _rate_buckets[ip] = bucket = [t for t in bucket if t > cutoff]
    if len(bucket) >= max_requests:
        raise HTTPException(429, "Too many requests. Please slow down.")
    bucket.append(now)


def _require_admin_key(request: Request) -> None:
    """Require a signed admin session, with API-key compatibility for automation."""
    key = request.headers.get("x-admin-key") or request.headers.get("authorization", "").removeprefix("Bearer ").strip()
    if ADMIN_API_KEY and key and secrets.compare_digest(key, ADMIN_API_KEY):
        return

    if not admin_auth_configured():
        raise HTTPException(503, "Admin login is not configured. Run deploy-pi.sh to create credentials.")
    username = verify_session_token(request.cookies.get(COOKIE_NAME, ""))
    if not username:
        raise HTTPException(401, "Admin login required")

    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        origin = request.headers.get("origin", "")
        if not origin or urlparse(origin).netloc.lower() != request.headers.get("host", "").lower():
            raise HTTPException(403, "Invalid admin request origin")


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """Global rate limiter — applied to all non-static requests."""
    path = request.url.path
    # Skip rate limiting for static assets and health checks
    if path.startswith("/assets") or path in ("/robots.txt", "/sitemap.xml"):
        return await call_next(request)

    ip = _get_client_ip(request)
    try:
        # Stricter limit for PDF rendering
        if path.startswith("/api/render/"):
            _check_rate_limit(f"render:{ip}", RATE_LIMIT_RENDER_MAX)
        else:
            _check_rate_limit(ip)
    except HTTPException as exc:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    return await call_next(request)


BASE_DIR = Path(__file__).resolve().parent  # actual/back
DATA_DIR = BASE_DIR / "data"
TEMPLATES_ROOT = DATA_DIR / "templates"
OUTPUT_DIR = DATA_DIR / "output"
I18N_DIR = DATA_DIR / "i18n"
ADMIN_PAGE = BASE_DIR / "static" / "scenario-admin.html"

DEFAULT_LOCALE = "en"
MAX_TEMPLATE_PDF_BYTES = int(os.getenv("MAX_TEMPLATE_PDF_BYTES", str(20 * 1024 * 1024)))


class FeedbackPayload(BaseModel):
    channel: Literal["email", "sms"] = Field(description="Delivery channel for feedback")
    name: str = Field(min_length=1, max_length=100)
    contact: str = Field(min_length=3, max_length=200, description="Email address or phone number")
    message: str = Field(min_length=5, max_length=3000)


class ResolveQuestionsPayload(BaseModel):
    answers: dict = Field(default_factory=dict)


class AdminLoginPayload(BaseModel):
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=300)


class AnalyticsEventPayload(BaseModel):
    session_id: str = Field(min_length=8, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    event_type: Literal["page_view", "click", "search", "form_start", "form_complete", "download"]
    path: str = Field(default="", max_length=180)
    template_id: str = Field(default="", max_length=80)
    source: str = Field(default="", max_length=80)
    medium: str = Field(default="", max_length=80)
    campaign: str = Field(default="", max_length=100)
    referrer_host: str = Field(default="", max_length=120)
    search_term: str = Field(default="", max_length=120)
    element: str = Field(default="", max_length=120)
    metadata: dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# i18n helpers
# ---------------------------------------------------------------------------

def _load_json(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def _supported_locales() -> list[str]:
    """Return list of available locale codes based on i18n/*.json files."""
    if not I18N_DIR.exists():
        return [DEFAULT_LOCALE]
    return sorted(p.stem for p in I18N_DIR.glob("*.json"))


def _apply_locale_to_schema(
    schema: Dict[str, Any],
    template_dir: Path,
    locale: str,
) -> Dict[str, Any]:
    """Merge per-template i18n translations into schema fields."""
    if locale == DEFAULT_LOCALE:
        return schema

    i18n_path = template_dir / "i18n" / f"{locale}.json"
    translations = _load_json(i18n_path)
    field_translations = translations.get("fields", {})

    if not field_translations:
        return schema

    fields = schema.get("fields", [])
    merged = []
    for field in fields:
        key = field["key"]
        tr = field_translations.get(key)
        if not tr:
            merged.append(field)
            continue

        f = {**field}
        for prop in ("label", "helpText", "placeholder"):
            if prop in tr:
                f[prop] = tr[prop]

        if "options" in tr and f.get("options"):
            opt_tr = tr["options"]
            f["options"] = [
                {**opt, "label": opt_tr.get(opt["value"], opt["label"])}
                for opt in f["options"]
            ]

        merged.append(f)

    return {**schema, "fields": merged}


# ---------------------------------------------------------------------------
# Visibility resolver
# ---------------------------------------------------------------------------

def _check_condition_group(group: dict, answers: dict) -> bool:
    """Check if ALL conditions in a group match (AND logic)."""
    for dep_key, allowed_values in group.items():
        current_value = answers.get(dep_key)
        if current_value in (None, ""):
            return False
        if str(current_value) not in [str(v) for v in allowed_values]:
            return False
    return True


def _is_field_visible(field: dict, answers: dict) -> bool:
    visible_when = field.get("visible_when")
    visible_when_any = field.get("visible_when_any")

    # visible_when_any: list of condition groups, ANY group can match (OR logic)
    if visible_when_any and isinstance(visible_when_any, list):
        return any(_check_condition_group(group, answers) for group in visible_when_any)

    # visible_when: single condition group, ALL must match (AND logic)
    if visible_when:
        return _check_condition_group(visible_when, answers)

    return True


def _resolve_visible_fields(schema: dict, answers: dict) -> list[dict]:
    fields = schema.get("fields", []) if isinstance(schema, dict) else []
    return [f for f in fields if not f.get("hidden") and _is_field_visible(f, answers)]


def _collect_hidden_defaults(schema: dict) -> dict:
    """Collect default values from hidden fields."""
    fields = schema.get("fields", []) if isinstance(schema, dict) else []
    defaults = {}
    for f in fields:
        if f.get("hidden") and f.get("key") and "defaultValue" in f:
            defaults[f["key"]] = f["defaultValue"]
    return defaults


# ---------------------------------------------------------------------------
# W-4 enrichment
# ---------------------------------------------------------------------------

def _to_non_negative_int(value: object) -> int:
    if value is None:
        return 0
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return max(0, value)

    raw = str(value).strip()
    digits = "".join(ch for ch in raw if ch.isdigit())
    if not digits:
        return 0
    return int(digits)


def enrich_form_data(template_id: str, data: dict) -> dict:
    """Derive UX-friendly inputs into PDF-ready values."""
    from datetime import date as _date

    enriched = dict(data)

    if template_id == "w9-2026":
        # Derive legal_name from person_name (individuals/LLC) or company_name (entities)
        tax_class = enriched.get("tax_class", "")
        if tax_class in ("individual", "llc"):
            enriched["legal_name"] = enriched.get("person_name", "")
        else:
            enriched["legal_name"] = enriched.get("company_name", "")

        # Derive business_name from llc_name for LLC entities
        if tax_class == "llc":
            enriched["business_name"] = enriched.get("llc_name", "")

        # Auto-fill signature date as today
        enriched.setdefault("sign_date", _date.today().strftime("%m/%d/%Y"))

    elif template_id == "w4-2026":
        children_count = _to_non_negative_int(enriched.get("qualifying_children_count"))
        dependents_count = _to_non_negative_int(enriched.get("other_dependents_count"))

        children_amount = children_count * 2200
        dependents_amount = dependents_count * 500
        total_amount = children_amount + dependents_amount

        enriched["qualifying_children_amount"] = str(children_amount)
        enriched["other_dependents_amount"] = str(dependents_amount)
        enriched["total_dependents_amount"] = str(total_amount)

        # If worksheet deductions were filled, copy Line 5 into the main deductions field
        ws_ded_5 = enriched.get("ws_ded_5", "").strip()
        if ws_ded_5 and enriched.get("use_deductions_worksheet") == "yes":
            enriched.setdefault("deductions", ws_ded_5)

        # If worksheet extra withholding was calculated, copy into main field
        ws_mj_4 = enriched.get("ws_mj_4", "").strip()
        if ws_mj_4 and enriched.get("use_worksheet") == "yes":
            enriched.setdefault("extra_withholding", ws_mj_4)

    elif template_id == "f14039-2026":
        # Derive Section A checkboxes from conversational radio "how_discovered"
        how = enriched.get("how_discovered", "")
        if how == "irs_letter":
            enriched["reason_notice"] = True
        elif how == "rejected":
            enriched["reason_rejected"] = True
        elif how == "other_agency":
            enriched["reason_other_agency"] = True
        elif how == "self_discovered":
            enriched["reason_other"] = True

        # Derive Section B checkboxes from conversational radio "what_they_did"
        what = enriched.get("what_they_did", "")
        if what == "fake_return":
            enriched["theft_tax_return"] = True
        elif what == "used_ssn_job":
            enriched["theft_ssn_work"] = True
        elif what == "claimed_dependent":
            enriched["theft_dependent"] = True

        # Map phone_cell → phone_home as well (mapping expects phone_home)
        phone = enriched.get("phone_cell", "")
        if phone:
            enriched.setdefault("phone_home", phone)

        # Auto-fill signature date as today
        enriched.setdefault("date_signed", _date.today().strftime("%m/%d/%Y"))

    return enriched


# ---------------------------------------------------------------------------
# Feedback helpers
# ---------------------------------------------------------------------------

def _send_feedback_email(payload: FeedbackPayload) -> None:
    host = os.getenv("FEEDBACK_SMTP_HOST")
    port = int(os.getenv("FEEDBACK_SMTP_PORT", "587"))
    username = os.getenv("FEEDBACK_SMTP_USERNAME")
    password = os.getenv("FEEDBACK_SMTP_PASSWORD")
    to_addr = os.getenv("FEEDBACK_TO_EMAIL")
    from_addr = os.getenv("FEEDBACK_FROM_EMAIL", username or "noreply@oky-docky.local")

    if not (host and username and password and to_addr):
        raise HTTPException(
            503,
            "Email feedback is not configured. Set FEEDBACK_SMTP_HOST/PORT/USERNAME/PASSWORD/TO_EMAIL.",
        )

    msg = EmailMessage()
    msg["Subject"] = f"[Oky-Docky] Feedback from {payload.name}"
    msg["From"] = from_addr
    msg["To"] = to_addr
    msg.set_content(
        f"Name: {payload.name}\n"
        f"Contact: {payload.contact}\n"
        f"Channel: {payload.channel}\n\n"
        f"Message:\n{payload.message}\n"
    )

    with smtplib.SMTP(host, port, timeout=20) as smtp:
        smtp.starttls()
        smtp.login(username, password)
        smtp.send_message(msg)


def _send_feedback_sms(payload: FeedbackPayload) -> None:
    webhook_url = os.getenv("FEEDBACK_SMS_WEBHOOK_URL")
    if not webhook_url:
        raise HTTPException(503, "SMS feedback is not configured. Set FEEDBACK_SMS_WEBHOOK_URL.")

    body = {
        "to": payload.contact,
        "message": payload.message,
        "name": payload.name,
        "source": "oky-docky-feedback",
    }

    try:
        response = httpx.post(webhook_url, json=body, timeout=20)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(502, f"Failed to send SMS feedback: {exc}") from exc


# ---------------------------------------------------------------------------
# Admin authentication and first-party analytics
# ---------------------------------------------------------------------------

@app.post("/api/admin/login")
def api_admin_login(payload: AdminLoginPayload, request: Request):
    _check_rate_limit(f"admin-login:{_get_client_ip(request)}", 5)
    if not admin_auth_configured():
        raise HTTPException(503, "Admin login is not configured. Run deploy-pi.sh first.")
    if not verify_password(payload.username, payload.password):
        raise HTTPException(401, "Invalid username or password")

    response = JSONResponse({"authenticated": True, "username": ADMIN_USERNAME})
    response.set_cookie(
        COOKIE_NAME,
        create_session_token(ADMIN_USERNAME),
        max_age=SESSION_MAX_AGE,
        httponly=True,
        secure=ADMIN_COOKIE_SECURE,
        samesite="strict",
        path="/",
    )
    return response


@app.post("/api/admin/logout")
def api_admin_logout():
    response = JSONResponse({"authenticated": False})
    response.delete_cookie(COOKIE_NAME, path="/", secure=ADMIN_COOKIE_SECURE, samesite="strict")
    return response


@app.get("/api/admin/session")
def api_admin_session(request: Request):
    if not admin_auth_configured():
        return JSONResponse(status_code=503, content={"authenticated": False, "configured": False})
    username = verify_session_token(request.cookies.get(COOKIE_NAME, ""))
    if not username:
        return JSONResponse(status_code=401, content={"authenticated": False, "configured": True})
    return {"authenticated": True, "configured": True, "username": username}


@app.post("/api/analytics/events", status_code=202)
def api_analytics_event(payload: AnalyticsEventPayload):
    record_event(payload.model_dump())
    return {"accepted": True}


@app.get("/api/admin/analytics")
def api_admin_analytics(request: Request, days: int = Query(30, ge=1, le=365)):
    _require_admin_key(request)
    return analytics_metrics(days)


# ---------------------------------------------------------------------------
# Admin endpoints
# ---------------------------------------------------------------------------

@app.get("/admin/scenario-builder", response_class=HTMLResponse)
def admin_scenario_builder(request: Request):
    _require_admin_key(request)
    if not ADMIN_PAGE.exists():
        raise HTTPException(404, "Admin page not found")
    return ADMIN_PAGE.read_text(encoding="utf-8")


@app.get("/api/admin/templates")
def api_admin_list_templates(request: Request):
    _require_admin_key(request)
    template_ids = list_templates(TEMPLATES_ROOT, include_unpublished=True)
    templates = []
    for tid in template_ids:
        try:
            templates.append(load_template_meta(TEMPLATES_ROOT, tid, include_unpublished=True))
        except Exception:
            continue
    return {"templates": templates}


@app.get("/api/admin/templates/{template_id}/bundle")
def api_admin_get_bundle(template_id: str, request: Request):
    _require_admin_key(request)
    try:
        bundle = load_template(TEMPLATES_ROOT, template_id, include_unpublished=True)
    except Exception as e:
        raise HTTPException(404, str(e))

    return {
        "template": bundle.meta,
        "schema": bundle.schema,
        "mapping": bundle.mapping,
    }


@app.get("/api/admin/templates/{template_id}/pdf-fields")
def api_admin_pdf_fields(template_id: str, request: Request):
    _require_admin_key(request)
    try:
        bundle = load_template(TEMPLATES_ROOT, template_id, include_unpublished=True)
    except Exception as exc:
        raise HTTPException(404, str(exc))
    fields = PdfReader(str(bundle.pdf_path)).get_fields() or {}
    return {"count": len(fields), "fields": list(fields.keys())}


@app.get("/api/admin/templates/{template_id}/pdf-field-rects")
def api_admin_pdf_field_rects(template_id: str, request: Request):
    _require_admin_key(request)
    try:
        bundle = load_template(TEMPLATES_ROOT, template_id, include_unpublished=True)
    except Exception as exc:
        raise HTTPException(404, str(exc))

    reader = PdfReader(str(bundle.pdf_path))
    result: list[dict] = []
    for page_idx, page in enumerate(reader.pages):
        for annot_ref in page.get("/Annots", []) or []:
            annotation = annot_ref.get_object()
            field_name = annotation.get("/T")
            if not field_name:
                parent = annotation.get("/Parent")
                while parent and not field_name:
                    parent_obj = parent.get_object() if hasattr(parent, "get_object") else parent
                    field_name = parent_obj.get("/T")
                    parent = parent_obj.get("/Parent")
            rect = annotation.get("/Rect")
            if not field_name or not rect:
                continue
            result.append({
                "name": str(field_name),
                "page": page_idx,
                "rect": [float(value) for value in rect],
                "page_width": float(page.mediabox.width),
                "page_height": float(page.mediabox.height),
            })
    return {"count": len(result), "fields": result}


@app.get("/api/admin/templates/{template_id}/pdf-file")
def api_admin_pdf_file(template_id: str, request: Request):
    _require_admin_key(request)
    try:
        bundle = load_template(TEMPLATES_ROOT, template_id, include_unpublished=True)
    except Exception as exc:
        raise HTTPException(404, str(exc))
    return FileResponse(str(bundle.pdf_path), media_type="application/pdf", filename=f"{template_id}.pdf")


@app.put("/api/admin/templates/{template_id}/bundle")
def api_admin_save_bundle(template_id: str, payload: dict, request: Request):
    _require_admin_key(request)
    target_dir = TEMPLATES_ROOT / template_id
    if not target_dir.exists():
        raise HTTPException(404, f"Template folder not found: {template_id}")

    template_json = payload.get("template")
    schema_json = payload.get("schema")
    mapping_json = payload.get("mapping")

    if not isinstance(template_json, dict) or not isinstance(schema_json, dict) or not isinstance(mapping_json, dict):
        raise HTTPException(400, "payload must include object fields: template, schema, mapping")

    if template_json.get("id") and template_json["id"] != template_id:
        raise HTTPException(400, "template.id must match URL template_id")

    fields = schema_json.get("fields")
    if not isinstance(fields, list):
        raise HTTPException(400, "schema.fields must be an array")

    allowed_types = {"text", "date", "radio", "checkbox", "signature", "text_input", "checkbox_input", "signature_area"}
    keys: dict[str, int] = {}
    validation_errors: list[str] = []
    for index, field in enumerate(fields):
        if not isinstance(field, dict):
            validation_errors.append(f"Field {index + 1} must be an object")
            continue
        key = str(field.get("key", "")).strip()
        label = str(field.get("label", "")).strip()
        if not key:
            validation_errors.append(f"Field {index + 1} has no key")
        elif not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]*", key):
            validation_errors.append(f"Field key '{key}' is invalid")
        elif key in keys:
            validation_errors.append(f"Field key '{key}' is duplicated")
        else:
            keys[key] = index
        if not field.get("hidden") and not label:
            validation_errors.append(f"Field '{key or index + 1}' has no label")
        if field.get("type") not in allowed_types:
            validation_errors.append(f"Field '{key or index + 1}' has unsupported type '{field.get('type')}'")
        if field.get("type") == "radio":
            options = field.get("options") or []
            option_values = [str(option.get("value", "")) for option in options if isinstance(option, dict)]
            if len(options) < 2 or len(option_values) != len(options):
                validation_errors.append(f"Radio field '{key}' needs at least two valid options")
            elif any(not value for value in option_values) or len(set(option_values)) != len(option_values):
                validation_errors.append(f"Radio field '{key}' has blank or duplicate option values")

    for index, field in enumerate(fields):
        if not isinstance(field, dict):
            continue
        for conditions in [field.get("visible_when"), *(field.get("visible_when_any") or [])]:
            if not conditions:
                continue
            if not isinstance(conditions, dict):
                validation_errors.append(f"Field '{field.get('key', index + 1)}' has invalid visibility conditions")
                continue
            for dependency, allowed_values in conditions.items():
                if dependency not in keys:
                    validation_errors.append(f"Field '{field.get('key')}' references missing condition field '{dependency}'")
                elif keys[dependency] >= index:
                    validation_errors.append(f"Field '{field.get('key')}' condition must reference an earlier field")
                if not isinstance(allowed_values, list) or not allowed_values:
                    validation_errors.append(f"Field '{field.get('key')}' condition '{dependency}' has no values")

    if validation_errors:
        raise HTTPException(400, {"message": "Invalid form schema", "errors": validation_errors})

    pending_files: list[tuple[Path, Path]] = []
    try:
        for filename, data in (
            ("template.json", template_json),
            ("schema.json", schema_json),
            ("mapping.json", mapping_json),
        ):
            target = target_dir / filename
            temporary = target.with_name(f".{target.name}.tmp")
            temporary.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            pending_files.append((temporary, target))
        for temporary, target in pending_files:
            temporary.replace(target)
    finally:
        for temporary, _ in pending_files:
            temporary.unlink(missing_ok=True)

    return {"status": "saved", "template_id": template_id}


class CreateTemplatePayload(BaseModel):
    id: str = Field(min_length=1, max_length=80, description="Unique template ID (folder name)")
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=500)
    category: str = Field(default="general", max_length=50)
    tags: list[str] = Field(default_factory=list)
    country: str = Field(default="US", max_length=5)
    estimated_time: str = Field(default="5 min", max_length=20)
    pdf_base64: str = Field(default="", description="Base64-encoded PDF file content")
    pdf_filename: str = Field(default="", description="Original PDF filename")


@app.post("/api/admin/templates")
def api_admin_create_template(payload: CreateTemplatePayload, request: Request):
    """Create a brand-new template with directory structure and starter files."""
    _require_admin_key(request)
    template_id = payload.id.strip()

    # Validate template ID format
    if not re.match(r'^[a-zA-Z0-9][a-zA-Z0-9_-]*$', template_id):
        raise HTTPException(400, "Template ID must start with a letter/digit and contain only letters, digits, hyphens, underscores")

    target_dir = TEMPLATES_ROOT / template_id
    if target_dir.exists():
        raise HTTPException(409, f"Template '{template_id}' already exists")

    # Determine PDF filename
    pdf_filename = payload.pdf_filename.strip() if payload.pdf_filename else f"{template_id}.pdf"
    if not pdf_filename.lower().endswith(".pdf"):
        pdf_filename += ".pdf"

    # Create directory
    target_dir.mkdir(parents=True, exist_ok=True)

    try:
        # Write PDF if provided
        if payload.pdf_base64:
            try:
                pdf_bytes = base64.b64decode(payload.pdf_base64, validate=True)
            except Exception:
                raise HTTPException(400, "Invalid PDF base64 payload")

            if len(pdf_bytes) > MAX_TEMPLATE_PDF_BYTES:
                raise HTTPException(400, f"PDF is too large (>{MAX_TEMPLATE_PDF_BYTES} bytes)")
            if not pdf_bytes.startswith(b"%PDF"):
                raise HTTPException(400, "Uploaded file is not a valid PDF")

            # Ensure the uploaded document can be parsed and is not encrypted.
            try:
                reader = PdfReader(BytesIO(pdf_bytes))
                if reader.is_encrypted:
                    raise HTTPException(400, "Encrypted PDFs are not supported")
                # Touch first page to validate cross-reference and page tree integrity.
                _ = len(reader.pages)
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(400, "Uploaded PDF could not be parsed")

            (target_dir / pdf_filename).write_bytes(pdf_bytes)
        else:
            # Create a minimal blank PDF placeholder
            (target_dir / pdf_filename).write_bytes(
                b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
                b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
                b"3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\n"
                b"xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n"
                b"0000000058 00000 n \n0000000115 00000 n \n"
                b"trailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF\n"
            )

        # template.json
        template_meta = {
            "id": template_id,
            "engine": "acroform",
            "pdf": pdf_filename,
            "schema": "schema.json",
            "mapping": "mapping.json",
            "title": payload.title,
            "description": payload.description,
            "category": payload.category,
            "tags": payload.tags,
            "country": payload.country,
            "popular": False,
            "published": False,
            "estimated_time": payload.estimated_time,
        }
        (target_dir / "template.json").write_text(
            json.dumps(template_meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )

        # schema.json — empty starter
        schema = {"fields": [], "transforms": []}
        (target_dir / "schema.json").write_text(
            json.dumps(schema, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )

        # mapping.json — empty starter
        (target_dir / "mapping.json").write_text(
            json.dumps({}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )

        # Detect PDF form fields if a real PDF was uploaded
        pdf_fields: list[str] = []
        if payload.pdf_base64:
            try:
                reader = PdfReader(str(target_dir / pdf_filename))
                raw_fields = reader.get_fields() or {}
                pdf_fields = list(raw_fields.keys())
            except Exception:
                pass

    except HTTPException:
        # Preserve user-facing validation errors.
        import shutil
        shutil.rmtree(target_dir, ignore_errors=True)
        raise
    except Exception as e:
        # Clean up on failure
        import shutil
        shutil.rmtree(target_dir, ignore_errors=True)
        raise HTTPException(500, f"Failed to create template: {e}")

    return {
        "status": "created",
        "template_id": template_id,
        "pdf_fields": pdf_fields,
    }


@app.post("/api/admin/templates/sync-to-repo")
def api_admin_sync_to_repo(request: Request):
    """Commit and push all template changes in data/templates/ to the git repo."""
    _require_admin_key(request)
    import subprocess

    repo_root = BASE_DIR.parent.parent  # oky-docky root
    templates_rel = str(TEMPLATES_ROOT.relative_to(repo_root))

    # Check if we're inside a git repo
    git_dir = repo_root / ".git"
    if not git_dir.exists():
        raise HTTPException(
            503,
            "Not a git repository. If running in Docker, mount .git volume: "
            "'./.git:/app/.git' in docker-compose.",
        )

    try:
        # Mark directory as safe (needed inside Docker where uid may differ)
        subprocess.run(
            ["git", "config", "--global", "--add", "safe.directory", str(repo_root)],
            cwd=str(repo_root), capture_output=True, text=True,
        )

        # Ensure git user is configured for commits
        user_check = subprocess.run(
            ["git", "config", "user.email"],
            cwd=str(repo_root), capture_output=True, text=True,
        )
        if not user_check.stdout.strip():
            subprocess.run(
                ["git", "config", "user.email", "admin@oky-docky.local"],
                cwd=str(repo_root), capture_output=True, text=True,
            )
            subprocess.run(
                ["git", "config", "user.name", "Oky-Docky Admin"],
                cwd=str(repo_root), capture_output=True, text=True,
            )

        # Stage all template changes
        subprocess.run(
            ["git", "add", templates_rel],
            cwd=str(repo_root), check=True, capture_output=True, text=True,
        )

        # Check if there's anything to commit
        status = subprocess.run(
            ["git", "diff", "--cached", "--name-only"],
            cwd=str(repo_root), capture_output=True, text=True,
        )
        changed_files = [f for f in status.stdout.strip().split("\n") if f]
        if not changed_files:
            return {"status": "nothing_to_sync", "message": "No template changes to commit"}

        # Commit
        subprocess.run(
            ["git", "commit", "-m", f"sync: update templates ({len(changed_files)} files changed)"],
            cwd=str(repo_root), check=True, capture_output=True, text=True,
        )

        # Get current branch
        branch_result = subprocess.run(
            ["git", "branch", "--show-current"],
            cwd=str(repo_root), capture_output=True, text=True,
        )
        branch = branch_result.stdout.strip()

        # Push
        push_result = subprocess.run(
            ["git", "push", "-u", "origin", branch],
            cwd=str(repo_root), capture_output=True, text=True,
            timeout=30,
        )

        if push_result.returncode != 0:
            return {
                "status": "committed_not_pushed",
                "message": f"Committed {len(changed_files)} files but push failed: {push_result.stderr}",
                "files": changed_files,
            }

        return {
            "status": "synced",
            "message": f"Committed and pushed {len(changed_files)} files",
            "branch": branch,
            "files": changed_files,
        }

    except subprocess.CalledProcessError as e:
        raise HTTPException(500, f"Git operation failed: {e.stderr or str(e)}")
    except FileNotFoundError:
        raise HTTPException(500, "git is not installed or not in PATH")
    except Exception as e:
        raise HTTPException(500, f"Sync failed: {e}")


# ---------------------------------------------------------------------------
# SEO endpoints
# ---------------------------------------------------------------------------

BASE_SITE_URL = os.getenv("SITE_URL", "https://oky-docky.com").rstrip("/")
BASE_SITE_HOST = urlparse(BASE_SITE_URL).netloc

STATIC_PAGES = [
    {"path": "/", "priority": "1.0", "changefreq": "daily"},
    {"path": "/templates", "priority": "0.95", "changefreq": "daily"},
    {"path": "/how-it-works", "priority": "0.8", "changefreq": "weekly"},
    {"path": "/pricing", "priority": "0.7", "changefreq": "weekly"},
    {"path": "/disclaimer", "priority": "0.4", "changefreq": "monthly"},
]


def _utc_date_from_timestamp(timestamp: float) -> str:
    return datetime.fromtimestamp(timestamp, tz=timezone.utc).date().isoformat()


def _template_lastmod(template_id: str) -> str:
    template_dir = TEMPLATES_ROOT / template_id
    newest_mtime = max(
        (path.stat().st_mtime for path in template_dir.rglob("*") if path.is_file()),
        default=template_dir.stat().st_mtime if template_dir.exists() else time.time(),
    )
    return _utc_date_from_timestamp(newest_mtime)


def _url_entry(path: str, changefreq: str, priority: str, lastmod: str) -> str:
    loc = escape(f"{BASE_SITE_URL}{path}", quote=True)
    return (
        "  <url>\n"
        f"    <loc>{loc}</loc>\n"
        f"    <lastmod>{lastmod}</lastmod>\n"
        f"    <changefreq>{changefreq}</changefreq>\n"
        f"    <priority>{priority}</priority>\n"
        "  </url>"
    )


@app.get("/sitemap.xml")
def sitemap_xml():
    """Generate sitemap.xml with all template pages and static pages."""
    template_ids = list_templates(TEMPLATES_ROOT)

    today = datetime.now(timezone.utc).date().isoformat()
    urls = [
        _url_entry(page["path"], page["changefreq"], page["priority"], today)
        for page in STATIC_PAGES
    ]

    for tid in template_ids:
        try:
            load_template_meta(TEMPLATES_ROOT, tid)
            urls.append(_url_entry(f"/{tid}", "weekly", "0.9", _template_lastmod(tid)))
        except Exception:
            continue

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls)
        + "\n</urlset>\n"
    )
    return Response(content=xml, media_type="application/xml")


@app.get("/robots.txt")
def robots_txt():
    """Serve robots.txt with sitemap reference."""
    content = (
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /oky-docky/builder\n"
        "Disallow: /oky-docky/admin\n"
        "Disallow: /api/admin/\n"
        "Disallow: /api/render/\n"
        "Disallow: /api/feedback\n"
        "\nUser-agent: Googlebot\n"
        "Allow: /\n"
        "Disallow: /oky-docky/builder\n"
        "Disallow: /oky-docky/admin\n"
        "Disallow: /api/admin/\n"
        "Disallow: /api/render/\n"
        "Disallow: /api/feedback\n"
        f"\nSitemap: {BASE_SITE_URL}/sitemap.xml\n"
        f"Host: {BASE_SITE_HOST}\n"
    )
    return Response(content=content, media_type="text/plain")


@app.get("/api/seo/{template_id}")
def api_seo_meta(template_id: str):
    """Return SEO metadata for a template — used by SSR/prerender."""
    try:
        meta = load_template_meta(TEMPLATES_ROOT, template_id)
    except Exception:
        raise HTTPException(404, f"Template '{template_id}' not found")

    title = meta.get("seo_title") or f"{meta.get('title', template_id)} — Free Online Form | Oky-Docky"
    description = meta.get("seo_description") or (
        f"Fill out {meta.get('title', '')} online for free. "
        f"{meta.get('description', '')} "
        f"Guided step-by-step Q&A with instant PDF download."
    )

    return {
        "title": title,
        "description": description,
        "canonical": f"{BASE_SITE_URL}/{template_id}",
        "keywords": meta.get("seo_keywords", meta.get("tags", [])),
        "og": {
            "type": "website",
            "title": title,
            "description": description,
            "url": f"{BASE_SITE_URL}/{template_id}",
            "site_name": "Oky-Docky",
        },
        "structured_data": {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": meta.get("title", template_id),
            "description": description,
            "url": f"{BASE_SITE_URL}/{template_id}",
            "applicationCategory": "BusinessApplication",
            "operatingSystem": "Web",
            "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD",
            },
            "isBasedOn": meta.get("source_url"),
            "publisher": {"@type": "Organization", "name": "Oky-Docky"},
        },
    }


# ---------------------------------------------------------------------------
# i18n endpoints
# ---------------------------------------------------------------------------

@app.get("/api/meta")
def api_meta():
    """App-level metadata: supported locales, template count, computed stats."""
    template_ids = list_templates(TEMPLATES_ROOT)
    total_fields = 0
    for tid in template_ids:
        try:
            bundle = load_template(TEMPLATES_ROOT, tid)
            total_fields += len(bundle.schema.get("fields", []))
        except Exception:
            pass

    return {
        "locales": _supported_locales(),
        "default_locale": DEFAULT_LOCALE,
        "template_count": len(template_ids),
        "total_fields": total_fields,
    }


@app.get("/api/i18n/{locale}")
def api_i18n(locale: str):
    """Return global UI translations for the given locale."""
    path = I18N_DIR / f"{locale}.json"
    if not path.exists():
        raise HTTPException(404, f"Locale '{locale}' not found")
    return _load_json(path)


# ---------------------------------------------------------------------------
# Public API endpoints
# ---------------------------------------------------------------------------

@app.get("/api/templates")
def api_list_templates(
    q: Optional[str] = Query(None, description="Search by title, description, or tags"),
    category: Optional[str] = Query(None, description="Filter by category"),
    country: Optional[str] = Query(None, description="Filter by country code"),
    tag: Optional[str] = Query(None, description="Filter by tag"),
):
    template_ids = list_templates(TEMPLATES_ROOT)
    results = []

    for tid in template_ids:
        try:
            meta = load_template_meta(TEMPLATES_ROOT, tid)
        except Exception:
            continue

        if category and meta.get("category", "") != category:
            continue
        if country and meta.get("country", "") != country:
            continue
        if tag and tag not in meta.get("tags", []):
            continue

        if q:
            query = q.lower()
            title = meta.get("title", "").lower()
            desc = meta.get("description", "").lower()
            tags = [t.lower() for t in meta.get("tags", [])]
            if not (query in title or query in desc or any(query in t for t in tags)):
                continue

        results.append(meta)

    return {"templates": results}


@app.get("/api/templates/{template_id}")
def api_template_detail(template_id: str):
    try:
        meta = load_template_meta(TEMPLATES_ROOT, template_id)
    except Exception as e:
        raise HTTPException(404, str(e))
    return meta


@app.get("/api/templates/{template_id}/schema")
def api_template_schema(
    template_id: str,
    locale: Optional[str] = Query(None, description="Locale code for translated labels"),
):
    """Return the schema (fields definition) for a template, optionally localized."""
    try:
        bundle = load_template(TEMPLATES_ROOT, template_id)
    except Exception as e:
        raise HTTPException(404, str(e))

    schema = bundle.schema
    if locale and locale != DEFAULT_LOCALE:
        schema = _apply_locale_to_schema(schema, bundle.base_dir, locale)

    return schema


@app.post("/api/templates/{template_id}/resolve-questions")
def api_resolve_questions(template_id: str, payload: ResolveQuestionsPayload):
    try:
        bundle = load_template(TEMPLATES_ROOT, template_id)
    except Exception as e:
        raise HTTPException(404, str(e))

    answers = payload.answers if isinstance(payload.answers, dict) else {}
    visible_fields = _resolve_visible_fields(bundle.schema, answers)
    return {"fields": visible_fields}


@app.get("/api/templates/{template_id}/pdf-fields")
def api_pdf_fields(template_id: str):
    try:
        bundle = load_template(TEMPLATES_ROOT, template_id)
    except Exception as e:
        raise HTTPException(404, str(e))

    reader = PdfReader(str(bundle.pdf_path))
    fields = reader.get_fields() or {}
    return {"count": len(fields), "fields": list(fields.keys())}


@app.get("/api/templates/{template_id}/pdf-field-rects")
def api_pdf_field_rects(template_id: str):
    """Return field names with their bounding rectangles and page indices."""
    try:
        bundle = load_template(TEMPLATES_ROOT, template_id)
    except Exception as e:
        raise HTTPException(404, str(e))

    reader = PdfReader(str(bundle.pdf_path))
    result: list[dict] = []

    for page_idx, page in enumerate(reader.pages):
        page_box = page.mediabox
        page_w = float(page_box.width)
        page_h = float(page_box.height)

        annotations = page.get("/Annots")
        if not annotations:
            continue
        for annot_ref in annotations:
            annot = annot_ref.get_object()
            field_name = annot.get("/T")
            if not field_name:
                # Walk up parent chain for partial names
                parent = annot.get("/Parent")
                parts = []
                while parent:
                    parent_obj = parent.get_object() if hasattr(parent, "get_object") else parent
                    if parent_obj.get("/T"):
                        parts.append(str(parent_obj["/T"]))
                    parent = parent_obj.get("/Parent")
                if parts:
                    field_name = ".".join(reversed(parts))

            rect = annot.get("/Rect")
            if not field_name or not rect:
                continue

            x1, y1, x2, y2 = [float(v) for v in rect]
            result.append({
                "name": str(field_name),
                "page": page_idx,
                "rect": [x1, y1, x2, y2],
                "page_width": page_w,
                "page_height": page_h,
            })

    return {"count": len(result), "fields": result}


@app.get("/api/templates/{template_id}/pdf-file")
def api_pdf_file(template_id: str):
    """Serve the raw PDF template file for preview."""
    try:
        bundle = load_template(TEMPLATES_ROOT, template_id)
    except Exception as e:
        raise HTTPException(404, str(e))

    return FileResponse(
        str(bundle.pdf_path),
        media_type="application/pdf",
        filename=f"{template_id}.pdf",
    )


@app.post("/api/render/{template_id}")
def api_render(template_id: str, payload: dict):
    data = payload.get("data")
    if not isinstance(data, dict):
        raise HTTPException(400, 'payload must be: {"data": {..}}')

    try:
        bundle = load_template(TEMPLATES_ROOT, template_id)
    except Exception as e:
        raise HTTPException(404, str(e))

    if bundle.engine != "acroform":
        raise HTTPException(400, f"Unsupported engine for now: {bundle.engine}")

    # Inject default values from hidden fields
    hidden_defaults = _collect_hidden_defaults(bundle.schema)
    for k, v in hidden_defaults.items():
        if k not in data:
            data[k] = v

    # Use declarative transforms from schema if available, else legacy enrichment
    schema_transforms = bundle.schema.get("transforms")
    if schema_transforms:
        prepared_data = apply_transforms(data, schema_transforms)
    else:
        prepared_data = enrich_form_data(template_id, data)
    pdf_field_values, sig_overlays = build_pdf_field_values(prepared_data, bundle.mapping)

    request_id = uuid.uuid4().hex[:12]
    out_path = OUTPUT_DIR / f"{template_id}_{request_id}.pdf"
    fill_acroform_pdf(bundle.pdf_path, pdf_field_values, out_path, sig_overlays)

    return FileResponse(
        path=str(out_path),
        media_type="application/pdf",
        filename=f"{template_id}.pdf",
    )


@app.post("/api/feedback")
def api_feedback(payload: FeedbackPayload):
    """Receive customer feedback and forward via configured channel."""
    if payload.channel == "email":
        _send_feedback_email(payload)
    else:
        _send_feedback_sms(payload)

    return {"status": "accepted", "channel": payload.channel}


# ---------------------------------------------------------------------------
# SPA static file serving (dev mode — when running without nginx)
# ---------------------------------------------------------------------------
FRONT_DIST = BASE_DIR.parent / "front" / "dist"

if FRONT_DIST.exists():
    from starlette.staticfiles import StaticFiles

    # Serve /assets/* directly
    app.mount("/assets", StaticFiles(directory=str(FRONT_DIST / "assets")), name="frontend-assets")

    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        """Serve frontend SPA — any non-API route returns index.html."""
        file_path = FRONT_DIST / full_path
        if file_path.is_file() and ".." not in full_path:
            return FileResponse(str(file_path))
        return FileResponse(str(FRONT_DIST / "index.html"))
