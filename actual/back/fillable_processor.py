from __future__ import annotations
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pypdf import PdfReader

from .core.template_store import load_template, list_templates
from .core.mapping import build_pdf_field_values
from .engines.acroform import fill_acroform_pdf

app = FastAPI()

BASE_DIR = Path(__file__).resolve().parent  # actual/back
TEMPLATES_ROOT = BASE_DIR / "data" / "templates"
OUTPUT_DIR = BASE_DIR / "data" / "output"


@app.get("/api/templates")
def api_list_templates():
    return {"templates": list_templates(TEMPLATES_ROOT)}


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
        raise HTTPException(400, "payload must be: {\"data\": {..}}")

    try:
        bundle = load_template(TEMPLATES_ROOT, template_id)
    except Exception as e:
        raise HTTPException(404, str(e))

    if bundle.engine != "acroform":
        raise HTTPException(400, f"Unsupported engine for now: {bundle.engine}")

    pdf_field_values = build_pdf_field_values(data, bundle.mapping)

    out_path = OUTPUT_DIR / f"{template_id}_filled.pdf"
    fill_acroform_pdf(bundle.pdf_path, pdf_field_values, out_path)

    return FileResponse(
        path=str(out_path),
        media_type="application/pdf",
        filename=f"{template_id}.pdf",
    )
