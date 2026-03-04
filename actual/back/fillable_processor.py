from __future__ import annotations

import os
import smtplib
from email.message import EmailMessage
from pathlib import Path
from typing import Optional, Literal

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
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
TEMPLATES_ROOT = BASE_DIR / "data" / "templates"
OUTPUT_DIR = BASE_DIR / "data" / "output"


class FeedbackPayload(BaseModel):
    channel: Literal["email", "sms"] = Field(description="Delivery channel for feedback")
    name: str = Field(min_length=1, max_length=100)
    contact: str = Field(min_length=3, max_length=200, description="Email address or phone number")
    message: str = Field(min_length=5, max_length=3000)


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
    enriched = dict(data)

    if template_id == "w4-2026":
        # Client-friendly input: ask counts, backend computes IRS amounts.
        children_count = _to_non_negative_int(enriched.get("qualifying_children_count"))
        dependents_count = _to_non_negative_int(enriched.get("other_dependents_count"))

        children_amount = children_count * 2000
        dependents_amount = dependents_count * 500
        total_amount = children_amount + dependents_amount

        enriched["qualifying_children_amount"] = str(children_amount)
        enriched["other_dependents_amount"] = str(dependents_amount)
        enriched["total_dependents_amount"] = str(total_amount)

    return enriched


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
    """
    SMS delivery uses a webhook so you can connect Twilio/MessageBird/etc without code changes.
    """
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


@app.get("/api/templates")
def api_list_templates(
    q: Optional[str] = Query(None, description="Search by title, description, or tags"),
    category: Optional[str] = Query(None, description="Filter by category"),
    country: Optional[str] = Query(None, description="Filter by country code"),
    tag: Optional[str] = Query(None, description="Filter by tag"),
):
    """Return all templates with full metadata. Supports search and filtering."""
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
    """Return full metadata for a single template."""
    try:
        meta = load_template_meta(TEMPLATES_ROOT, template_id)
    except Exception as e:
        raise HTTPException(404, str(e))
    return meta


@app.get("/api/templates/{template_id}/schema")
def api_template_schema(template_id: str):
    """Return the schema (fields definition) for a template."""
    try:
        bundle = load_template(TEMPLATES_ROOT, template_id)
    except Exception as e:
        raise HTTPException(404, str(e))
    return bundle.schema


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
    """
    payload = {"data": {...human keys...}}
    """
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

    out_path = OUTPUT_DIR / f"{template_id}_filled.pdf"
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
