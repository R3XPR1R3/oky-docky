import os
import base64
from typing import Dict, Any, Optional
from pathlib import Path


from pdf_debug_overlay import build_debug_pdf_for_form
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from fastapi import Body, Response
from pydantic import BaseModel

from pdf_registry import get_pdf_form
from oky_docky_single import (
    introspect_pdf_form_for_api,
    fill_pdf_form_bytes
)

from oky_docky_single import introspect_template_path, render_pdf_from_template_path


app = FastAPI()
FORMS_DIR = Path(__file__).parent / "forms"


@app.get("/api/pdf/forms/{form_id}/debug", response_class=Response)
def get_pdf_form_debug(form_id: str):
    """
    Вернуть PDF, в котором все поля подписаны их ID.
    Используется только для дебага маппинга полей.
    """
    try:
        pdf_bytes = build_debug_pdf_for_form(form_id, FORMS_DIR)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        # на проде лучше логировать, а не палить детальки
        raise HTTPException(status_code=500, detail="Failed to build debug PDF")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{form_id}_debug.pdf"'
        },
    )

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https://.*\.app\.github\.dev$",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Регистр форм (id -> файл) ---
TEMPLATES_DIR = "/workspaces/oky-docky/oky-docky/backend/back_old/templates"

FORMS_REGISTRY: Dict[str, Dict[str, Any]] = {
    "w4": {
        "title": "Form W-4",
        "description": "Employee’s Withholding Certificate",
        "tags": ["tax", "employee", "USA", "withholding", "w4", "w-4"],
        "variants": ["2024"],
        "variable_aliases": {
            "lastname": "Type your last name here",
            "name": "Type your first name here",
            "message": "Type your message here",
            "var": "Type test variable here",
        },
        "checkbox_aliases": {
            "1": "What is your status?",
            "1.opt1": "Single",
            "1.opt2": "Married",
            "1.opt3": "Head of Household",
            "2": "Do you have multiple jobs?",
            "2.opt1": "Yes",
            "2.opt2": "No",
        },
        "template": os.path.join(TEMPLATES_DIR, "w4.json"),
        "thumbnail": os.path.join(TEMPLATES_DIR, "thumbnails", "w4.png"),
    },
}


class RenderFormRequest(BaseModel):
    values: Dict[str, Any] = {}
    external_images_b64: Optional[Dict[str, str]] = None  # ref -> base64


@app.get("/forms")
def list_forms():
    return [
        {
            "id": fid,
            "title": cfg["title"],
            "description": cfg["description"],
            "tags": cfg.get("tags", []),
            "variants": cfg.get("variants", []),
            "thumbnail": cfg.get("thumbnail"),
        }
        for fid, cfg in FORMS_REGISTRY.items()
    ]


@app.get("/forms/{form_id}/introspect")
def introspect_form(form_id: str):
    cfg = FORMS_REGISTRY.get(form_id)
    if not cfg:
        raise HTTPException(status_code=404, detail="Unknown form id")

    info = introspect_template_path(cfg["template"])
    return {
        "id": form_id,
        "title": cfg["title"],
        "description": cfg["description"],
        "tags": cfg.get("tags", []),
        "variants": cfg.get("variants", []),
        "variable_aliases": cfg.get("variable_aliases", {}),
        "checkbox_aliases": cfg.get("checkbox_aliases", {}),
        **info,
    }


@app.post("/forms/{form_id}/render")
def render_form(form_id: str, req: RenderFormRequest):
    """
    Рендер PDF по выбранной форме и values.
    Возвращает PDF как application/pdf.
    """
    cfg = FORMS_REGISTRY.get(form_id)
    if not cfg:
        raise HTTPException(status_code=404, detail="Unknown form id")

    external_images: Dict[str, bytes] = {}
    if req.external_images_b64:
        for k, b64str in req.external_images_b64.items():
            try:
                external_images[k] = base64.b64decode(b64str)
            except Exception:
                pass

    pdf_path = render_pdf_from_template_path(
        cfg["template"],
        values=req.values,
        external_images=external_images or None,
    )

    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=500, detail="Render failed")

    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=f"{form_id}.pdf",
    )



# -----------------------------
# PDF: получить список полей
# -----------------------------
@app.get("/api/pdf/forms/{form_id}/fields")
def get_pdf_fields(form_id: str):
    try:
        form = get_pdf_form(form_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Form not found")

    try:
        schema = introspect_pdf_form_for_api(form["path"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "form_id": form_id,
        "title": form.get("title"),
        **schema
    }

# -----------------------------
# PDF: получить схему формы (с нормализацией)
# -----------------------------

from schema_normalize import normalize_schema_rects

@app.get("/api/pdf/forms/{form_id}/schema")
def get_pdf_schema(form_id: str, normalized: bool = True):
    try:
        form = get_pdf_form(form_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Form not found")

    schema = introspect_pdf_form_for_api(form["path"])

    # добавим form_id/title чтобы удобно сохранять
    schema_full = {"form_id": form_id, "title": form.get("title"), **schema}

    if normalized:
        schema_full = normalize_schema_rects(schema_full)

    return schema_full

#------------------------------
# Dev panel
#------------------------------
from fastapi.responses import HTMLResponse

@app.get("/dev", response_class=HTMLResponse)
def dev_panel():
    path = Path("static/test.html")
    if not path.exists():
        return HTMLResponse("<h3>static/test.html not found</h3>", status_code=404)
    return HTMLResponse(path.read_text(encoding="utf-8"))

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pathlib import Path

app = FastAPI()

STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/dev/test", response_class=HTMLResponse)
def dev_test():
    return (STATIC_DIR / "dev" / "test.html").read_text(encoding="utf-8")




# -----------------------------
# PDF: заполнить форму
# -----------------------------
@app.post("/api/pdf/forms/{form_id}/fill")
def fill_pdf_form(
    form_id: str,
    payload: Dict[str, Any] = Body(...)
):
    """
    payload = {
      "values": { field_id: value }
    }
    """
    try:
        form = get_pdf_form(form_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Form not found")

    values = payload.get("values")
    if not isinstance(values, dict):
        raise HTTPException(status_code=400, detail="values must be dict")

    try:
        pdf_bytes = fill_pdf_form_bytes(
            form["path"],
            values
        )
    except ValueError as e:
        # например: PDF не fillable
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{form_id}_filled.pdf"'
        }
    )

# --- Frontend ---
FRONT_DIR = "/workspaces/oky-docky/oky-docky/frontend/"

app.mount("/static", StaticFiles(directory="static"), name="static")