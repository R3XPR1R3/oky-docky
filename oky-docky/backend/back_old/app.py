# app.py (или где у тебя FastAPI)
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, Optional
import os

from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse

# Путь к фронту


# Отдаём всё содержимое папки (index.html, app.js, styles.css, resources/...)


from oky_docky_single import (
    introspect_template_path,
    render_pdf_from_template_path,
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https://.*\.app\.github\.dev$",  # любой порт codespaces
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
# --- Регистр форм (id -> файл) ---
TEMPLATES_DIR = "/workspaces/oky-docky/oky-docky/backend/back_old/templates"

FORMS_REGISTRY: Dict[str, Dict[str, str]] = {
    "w4": {
        "title": "Form W-4",
        "description": "Employee’s Withholding Certificate",
        "tags": ["tax", "employee", "USA", "withholding","w4","w-4"],
        "variants": ["2024"],
        "variable_aliases": {
            "lastname": "Type your last name here",
            "name": "Type your first name here",
            "message": "Type your message here",
            "var": "Type test variable here",
        },

        # Алиасы для чекбокс-групп и их опций
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
    # добавишь остальные формы по мере появления JSON
}

class RenderFormRequest(BaseModel):
    values: Dict[str, Any] = {}
    # если хочешь прикручивать внешние картинки:
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
    # info: { fields: [...], ... }

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


@app.post("/forms/{form_id}/render", response_class=None)
def render_form(form_id: str, req: RenderFormRequest):
    """
    Рендер PDF по выбранной форме и values.
    Возвращает PDF как application/pdf.
    """
    from fastapi.responses import FileResponse
    import base64
    cfg = FORMS_REGISTRY.get(form_id)
    if not cfg:
        raise HTTPException(status_code=404, detail="Unknown form id")

    external_images: Dict[str, bytes] = {}
    if req.external_images_b64:
        for k, b64 in req.external_images_b64.items():
            try:
                external_images[k] = base64.b64decode(b64)
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
 #-------------------------------------# 
 
FRONT_DIR = "/workspaces/oky-docky/oky-docky/front/resources"
app.mount(
    "/",
    StaticFiles(directory=FRONT_DIR, html=True),
    name="front",
)
