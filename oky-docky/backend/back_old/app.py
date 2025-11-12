# app.py
from __future__ import annotations
import io, os, json, tempfile
from typing import Optional, Dict, Any, List

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ValidationError

from oky_docky_single import (
    introspect_template_path,
    run_validation_and_render,
)

app = FastAPI(title="Oky-Docky PDF API", version="0.1")

# CORS — можешь ужесточить списком доменов
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------ Модели (для JSON-варианта) ------
class RenderBody(BaseModel):
    template_json: Dict[str, Any] = Field(..., description="Figma-like JSON")
    values: Dict[str, Any] = Field(default_factory=dict)
    # Картинки можно прислать инлайн base64: {"ref":"base64..."} — не обязательно
    external_images_b64: Dict[str, str] = Field(default_factory=dict)

# ------ Утилиты ------
def _save_upload_to_temp(up: UploadFile) -> str:
    suffix = os.path.splitext(up.filename or "template.json")[-1] or ".json"
    fd, path = tempfile.mkstemp(prefix="okydocky_", suffix=suffix)
    os.close(fd)
    with open(path, "wb") as f:
        # простая проверка размера (50 МБ)
        buf = up.file.read()
        if len(buf) > 50 * 1024 * 1024:
            os.remove(path)
            raise HTTPException(status_code=413, detail="File too large (>50MB)")
        f.write(buf)
    up.file.close()
    return path

def _bytes_from_upload(up: UploadFile) -> bytes:
    data = up.file.read()
    up.file.close()
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Image {up.filename} too large (>25MB)")
    return data

# ================== ЭНДПОИНТЫ ==================

@app.get("/health")
def health():
    return {"status": "ok"}

# --- 1) Интроспекция через multipart (файл шаблона) ---
@app.post("/introspect")
async def introspect(template: UploadFile = File(..., description="JSON шаблон")):
    try:
        path = _save_upload_to_temp(template)
        info = introspect_template_path(path)
        os.remove(path)
        return JSONResponse(info)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Introspect failed: {e}")

# --- 2) Интроспекция через application/json ---
@app.post("/introspect_json")
async def introspect_json(body: RenderBody):
    # сохраняем временно JSON, чтобы переиспользовать существующую функцию
    fd, path = tempfile.mkstemp(prefix="okydocky_", suffix=".json")
    os.close(fd)
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(body.template_json, f, ensure_ascii=False)
        info = introspect_template_path(path)
        return JSONResponse(info)
    finally:
        os.remove(path)

# --- 3) Рендер через multipart (файл шаблона + values + опциональные картинки) ---
@app.post("/render", response_class=StreamingResponse)
async def render_pdf_api(
    template: UploadFile = File(..., description="JSON шаблон"),
    values_json: Optional[str] = Form(None, description='JSON-словарь значений плейсхолдеров'),
    # загрузка нескольких картинок: имя файла = ключ ref (logo.png -> imageRef: 'logo')
    images: Optional[List[UploadFile]] = File(None, description="Набор изображений для imageRef (stem=ключ)"),
):
    # --- парсим values ---
    values: Dict[str, Any] = {}
    if values_json:
        try:
            values = json.loads(values_json)
            if not isinstance(values, dict):
                raise ValueError("values_json must be a JSON object")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Bad values_json: {e}")

    # --- сохраняем шаблон во временный файл ---
    try:
        tpl_path = _save_upload_to_temp(template)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Template save failed: {e}")

    # --- собираем external_images ---
    external_images: Dict[str, bytes] = {}
    if images:
        for up in images:
            key = os.path.splitext(os.path.basename(up.filename or ""))[0] or "img"
            try:
                external_images[key] = _bytes_from_upload(up)
            except HTTPException:
                os.remove(tpl_path)
                raise
            except Exception as e:
                os.remove(tpl_path)
                raise HTTPException(status_code=400, detail=f"Image '{up.filename}' read error: {e}")

    # --- рендерим в temp и отдаём как stream ---
    try:
        out_path = os.path.join(tempfile.mkdtemp(prefix="okydocky_out_"), "out.pdf")
        result_path = run_validation_and_render(
            tpl_path, out_path, external_images=external_images, values=values
        )
        if not result_path or not os.path.exists(result_path):
            raise HTTPException(status_code=500, detail="Render failed")

        def _iterfile():
            with open(result_path, "rb") as f:
                yield from f

        filename = os.path.basename(result_path)
        return StreamingResponse(
            _iterfile(),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    finally:
        # аккуратно чистим шаблон
        try: os.remove(tpl_path)
        except: pass

# --- 4) Рендер через application/json (если хочешь без multipart) ---
@app.post("/render_json", response_class=StreamingResponse)
async def render_json(body: RenderBody):
    # временно сохраняем JSON шаблон
    fd, tpl_path = tempfile.mkstemp(prefix="okydocky_", suffix=".json")
    os.close(fd)
    try:
        with open(tpl_path, "w", encoding="utf-8") as f:
            json.dump(body.template_json, f, ensure_ascii=False)

        # external_images_b64 → bytes
        external_images: Dict[str, bytes] = {}
        import base64
        for k, b64s in (body.external_images_b64 or {}).items():
            try:
                external_images[k] = base64.b64decode(b64s)
            except Exception:
                raise HTTPException(status_code=400, detail=f"Bad base64 for key '{k}'")

        out_path = os.path.join(tempfile.mkdtemp(prefix="okydocky_out_"), "out.pdf")
        result_path = run_validation_and_render(
            tpl_path, out_path, external_images=external_images, values=body.values or {}
        )
        if not result_path or not os.path.exists(result_path):
            raise HTTPException(status_code=500, detail="Render failed")

        def _iterfile():
            with open(result_path, "rb") as f:
                yield from f

        filename = os.path.basename(result_path)
        return StreamingResponse(
            _iterfile(),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    finally:
        try: os.remove(tpl_path)
        except: pass
# ================== КОНЕЦ ФАЙЛА ==================