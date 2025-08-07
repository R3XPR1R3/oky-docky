from fastapi import APIRouter, Request, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from typing import Dict, Optional, List
import os
import uuid
import json
from datetime import datetime
from pathlib import Path

# Импортируем наши модули
from pdf_processor import PDFProcessor
from storage import Storage
from models import FormData

# Роутер - ВСЕ ПУТИ ЗДЕСЬ!
router = APIRouter()

# Инициализация компонентов
pdf_processor = PDFProcessor()
storage = Storage()

# ===========================
# ГЛАВНАЯ СТРАНИЦА (ФРОНТЕНД)
# ===========================

@router.get("/", response_class=HTMLResponse)
async def home(request: Request):
    """Главная страница с нашим красивым фронтендом"""
    
    # Читаем HTML из артефакта (в продакшне лучше из файла)
    html_content = open("/workspaces/oky-docky/oky-docky/FRONTEND_UI/HTML/index/mainpage.html", "r", encoding="utf-8").read()
    
    return HTMLResponse(content=html_content)

# ===========================
# СЛУЖЕБНЫЕ ЭНДПОИНТЫ
# ===========================

@router.get("/health")
async def health_check():
    """Проверка состояния сервера"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "2.0",
        "service": "oky-docky"
    }

@router.get("/info")
async def app_info():
    """Информация о приложении"""
    templates_count = len(list(Path("templates").glob("*.json")))
    files_count = len(list(Path("generated_files").glob("*"))) if Path("generated_files").exists() else 0
    
    return {
        "name": "Oky Docky",
        "version": "2.0",
        "description": "Генератор документов с автозаполнением",
        "author": "Claude + Human",
        "stats": {
            "templates": templates_count,
            "generated_files": files_count
        },
        "endpoints": {
            "docs": "/docs",
            "redoc": "/redoc",
            "health": "/health",
            "api": "/api/"
        }
    }

@router.get("/api/stats")
async def get_stats():
    """Получить статистику использования"""
    try:
        templates_count = len(list(pdf_processor.templates_dir.glob("*.json")))
        generated_files_count = len(list(storage.local_storage.glob("*"))) if storage.local_storage.exists() else 0
        
        # Считаем общее количество переменных во всех шаблонах
        total_variables = 0
        for json_file in pdf_processor.templates_dir.glob("*.json"):
            with open(json_file, encoding='utf-8') as f:
                metadata = json.load(f)
                total_variables += len(metadata.get('variables', []))
        
        return {
            "templates_count": templates_count,
            "generated_files_count": generated_files_count,
            "total_variables": total_variables,
            "uptime": "Сервер работает"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения статистики: {str(e)}")

# ===========================
# API ДЛЯ ШАБЛОНОВ
# ===========================

@router.post("/api/upload-template")
async def upload_template(
    file: UploadFile = File(...),
    form_id: str = None,
    name: str = None
):
    """Загрузка нового PDF шаблона"""
    
    # Проверяем тип файла
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Поддерживаются только PDF файлы")
    
    # Генерируем ID если не указан
    if not form_id:
        form_id = str(uuid.uuid4())[:8]
    
    # Сохраняем шаблон
    template_path = pdf_processor.templates_dir / f"{form_id}.pdf"
    
    try:
        content = await file.read()
        with open(template_path, "wb") as f:
            f.write(content)
        
        # Извлекаем переменные из шаблона
        variables = pdf_processor.extract_variables_from_template(str(template_path))
        
        # Сохраняем метаданные
        metadata = {
            "id": form_id,
            "name": name or file.filename,
            "variables": variables,
            "uploaded_at": datetime.now().isoformat(),
            "file_size": len(content),
            "original_filename": file.filename
        }
        
        with open(pdf_processor.templates_dir / f"{form_id}.json", "w", encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
        
        return {
            "success": True,
            "form_id": form_id,
            "name": metadata["name"],
            "variables": variables,
            "message": f"Шаблон загружен! Найдено {len(variables)} переменных"
        }
        
    except Exception as e:
        # Удаляем файл если что-то пошло не так
        if template_path.exists():
            template_path.unlink()
        raise HTTPException(status_code=500, detail=f"Ошибка обработки файла: {str(e)}")

@router.get("/api/templates")
async def get_templates():
    """Получить список всех загруженных шаблонов"""
    templates = []
    
    try:
        for json_file in pdf_processor.templates_dir.glob("*.json"):
            with open(json_file, encoding='utf-8') as f:
                metadata = json.load(f)
                templates.append(metadata)
        
        # Сортируем по дате загрузки (новые первыми)
        templates.sort(key=lambda x: x.get('uploaded_at', ''), reverse=True)
        
        return templates
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения шаблонов: {str(e)}")

@router.get("/api/template/{form_id}")
async def get_template_info(form_id: str):
    """Получить информацию о конкретном шаблоне"""
    metadata_path = pdf_processor.templates_dir / f"{form_id}.json"
    
    if not metadata_path.exists():
        raise HTTPException(status_code=404, detail="Шаблон не найден")
    
    try:
        with open(metadata_path, encoding='utf-8') as f:
            metadata = json.load(f)
        return metadata
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка чтения метаданных: {str(e)}")

@router.get("/api/template/{form_id}/variables")
async def get_template_variables(form_id: str):
    """Получить список переменных в шаблоне"""
    template_path = pdf_processor.templates_dir / f"{form_id}.pdf"
    
    if not template_path.exists():
        raise HTTPException(status_code=404, detail="Шаблон не найден")
    
    try:
        variables = pdf_processor.extract_variables_from_template(str(template_path))
        
        return {
            "form_id": form_id,
            "variables": variables,
            "count": len(variables)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка извлечения переменных: {str(e)}")

@router.delete("/api/template/{form_id}")
async def delete_template(form_id: str):
    """Удаление шаблона"""
    template_path = pdf_processor.templates_dir / f"{form_id}.pdf"
    metadata_path = pdf_processor.templates_dir / f"{form_id}.json"
    
    if not template_path.exists():
        raise HTTPException(status_code=404, detail="Шаблон не найден")
    
    try:
        # Удаляем файлы
        template_path.unlink()
        if metadata_path.exists():
            metadata_path.unlink()
        
        return {
            "success": True,
            "message": f"Шаблон {form_id} удален"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка удаления: {str(e)}")

# ===========================
# API ДЛЯ ГЕНЕРАЦИИ
# ===========================

@router.post("/api/generate")
async def generate_document(request: FormData, background_tasks: BackgroundTasks):
    """Генерация документа с заполненными данными"""
    
    # Проверяем существование шаблона
    template_path = pdf_processor.templates_dir / f"{request.form_id}.pdf"
    if not template_path.exists():
        raise HTTPException(status_code=404, detail="Шаблон не найден")
    
    try:
        # Обрабатываем PDF
        result_bytes = pdf_processor.process_pdf_with_variables(
            str(template_path),
            request.variables,
            request.output_format
        )
        
        # Определяем расширение и content-type
        if request.output_format == "png":
            extension = "png"
            content_type = "image/png"
        else:
            extension = "pdf"
            content_type = "application/pdf"
        
        # Генерируем имя файла
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{request.form_id}_{timestamp}_{uuid.uuid4().hex[:6]}.{extension}"
        
        # Сохраняем файл
        file_url = await storage.save_file(
            result_bytes,
            filename,
            content_type
        )
        
        return {
            "success": True,
            "file_url": file_url,
            "filename": filename,
            "format": request.output_format,
            "generated_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка генерации: {str(e)}")

@router.post("/api/generate-batch")
async def generate_batch(
    form_id: str, 
    users_data: List[Dict[str, str]], 
    format: str = "pdf"
):
    """Массовая генерация документов для нескольких пользователей"""
    results = []
    
    for i, user_data in enumerate(users_data):
        try:
            request = FormData(
                form_id=form_id,
                variables=user_data,
                output_format=format
            )
            result = await generate_document(request, BackgroundTasks())
            results.append({
                "index": i,
                "success": True,
                "data": result
            })
        except Exception as e:
            results.append({
                "index": i,
                "success": False,
                "error": str(e),
                "user_data": user_data
            })
    
    success_count = sum(1 for r in results if r["success"])
    
    return {
        "results": results,
        "total": len(results),
        "successful": success_count,
        "failed": len(results) - success_count
    }

@router.post("/api/validate-variables")
async def validate_variables(form_id: str, variables: Dict[str, str]):
    """Валидация переменных перед генерацией"""
    try:
        # Получаем список переменных из шаблона
        template_variables = pdf_processor.extract_variables_from_template(
            str(pdf_processor.templates_dir / f"{form_id}.pdf")
        )
        
        missing_variables = []
        empty_variables = []
        
        for var in template_variables:
            if var not in variables:
                missing_variables.append(var)
            elif not variables[var].strip():
                empty_variables.append(var)
        
        is_valid = len(missing_variables) == 0 and len(empty_variables) == 0
        
        return {
            "valid": is_valid,
            "missing_variables": missing_variables,
            "empty_variables": empty_variables,
            "provided_variables": list(variables.keys()),
            "required_variables": template_variables
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка валидации: {str(e)}")

# ===========================
# ОБСЛУЖИВАНИЕ ФАЙЛОВ
# ===========================

@router.get("/files/{filename}")
async def get_file(filename: str):
    """Получить сгенерированный файл (для локальной разработки)"""
    file_path = storage.local_storage / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Файл не найден")
    
    # Определяем content-type по расширению
    if filename.endswith('.png'):
        media_type = "image/png"
    elif filename.endswith('.pdf'):
        media_type = "application/pdf"
    else:
        media_type = "application/octet-stream"
    
    return FileResponse(
        file_path, 
        media_type=media_type,
        filename=filename
    )