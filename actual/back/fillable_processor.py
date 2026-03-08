from __future__ import annotations

import json
import os
import smtplib
import uuid
from email.message import EmailMessage
from pathlib import Path
from typing import Any, Dict, Optional, Literal

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel, Field
from pypdf import PdfReader

from .core.mapping import build_pdf_field_values
from .core.template_store import load_template, list_templates, load_template_meta
from .engines.acroform import fill_acroform_pdf

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent  # actual/back
DATA_DIR = BASE_DIR / "data"
TEMPLATES_ROOT = DATA_DIR / "templates"
OUTPUT_DIR = DATA_DIR / "output"
I18N_DIR = DATA_DIR / "i18n"
ADMIN_PAGE = BASE_DIR / "static" / "scenario-admin.html"

DEFAULT_LOCALE = "en"


class FeedbackPayload(BaseModel):
    channel: Literal["email", "sms"] = Field(description="Delivery channel for feedback")
    name: str = Field(min_length=1, max_length=100)
    contact: str = Field(min_length=3, max_length=200, description="Email address or phone number")
    message: str = Field(min_length=5, max_length=3000)


class ResolveQuestionsPayload(BaseModel):
    answers: dict = Field(default_factory=dict)


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
    return [f for f in fields if _is_field_visible(f, answers)]


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

        children_amount = children_count * 2000
        dependents_amount = dependents_count * 500
        total_amount = children_amount + dependents_amount

        enriched["qualifying_children_amount"] = str(children_amount)
        enriched["other_dependents_amount"] = str(dependents_amount)
        enriched["total_dependents_amount"] = str(total_amount)

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
# Admin endpoints
# ---------------------------------------------------------------------------

@app.get("/admin/scenario-builder", response_class=HTMLResponse)
def admin_scenario_builder():
    if not ADMIN_PAGE.exists():
        raise HTTPException(404, "Admin page not found")
    return ADMIN_PAGE.read_text(encoding="utf-8")


@app.get("/api/admin/templates")
def api_admin_list_templates():
    template_ids = list_templates(TEMPLATES_ROOT)
    templates = []
    for tid in template_ids:
        try:
            templates.append(load_template_meta(TEMPLATES_ROOT, tid))
        except Exception:
            continue
    return {"templates": templates}


@app.get("/api/admin/templates/{template_id}/bundle")
def api_admin_get_bundle(template_id: str):
    try:
        bundle = load_template(TEMPLATES_ROOT, template_id)
    except Exception as e:
        raise HTTPException(404, str(e))

    return {
        "template": bundle.meta,
        "schema": bundle.schema,
        "mapping": bundle.mapping,
    }


@app.put("/api/admin/templates/{template_id}/bundle")
def api_admin_save_bundle(template_id: str, payload: dict):
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

    (target_dir / "template.json").write_text(json.dumps(template_json, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (target_dir / "schema.json").write_text(json.dumps(schema_json, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (target_dir / "mapping.json").write_text(json.dumps(mapping_json, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    return {"status": "saved", "template_id": template_id}


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
