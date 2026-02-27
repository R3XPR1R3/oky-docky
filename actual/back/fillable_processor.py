from __future__ import annotations
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pypdf import PdfReader

from .core.template_store import load_template, list_templates, load_template_meta
from .core.mapping import build_pdf_field_values
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

    pdf_field_values, sig_overlays = build_pdf_field_values(data, bundle.mapping)

    out_path = OUTPUT_DIR / f"{template_id}_filled.pdf"
    fill_acroform_pdf(bundle.pdf_path, pdf_field_values, out_path, sig_overlays)

    return FileResponse(
        path=str(out_path),
        media_type="application/pdf",
        filename=f"{template_id}.pdf",
    )
