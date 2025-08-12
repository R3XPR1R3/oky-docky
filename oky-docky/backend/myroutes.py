from fastapi import APIRouter, Request, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from typing import Dict, Optional, List
import os
from pydantic import BaseModel
from typing import Dict
import uuid


import traceback

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
# В начале файла добавь:
try:
    import fitz
    print("✅ Используем PyMuPDF")
except ImportError:
    print("⚠️ PyMuPDF недоступен, используем fallback")
    # Переключаемся на fallback процессор
    from pdf_processor_fallback import FallbackPDFProcessor
    pdf_processor = FallbackPDFProcessor()
# ===========================
# ГЛАВНАЯ СТРАНИЦА (ФРОНТЕНД)
# ===========================

@router.get("/", response_class=HTMLResponse)
async def home(request: Request):
    """Главная страница с нашим красивым фронтендом"""
    
    # Читаем HTML файл
    html_file_path = Path("/workspaces/oky-docky/oky-docky/FRONTEND_UI/HTML/index/mainpage.html")
    
    try:
        with open(html_file_path, "r", encoding="utf-8") as f:
            html_content = f.read()
        return HTMLResponse(content=html_content)
    except FileNotFoundError:
        return HTMLResponse(content="""
        <h1>🚀 Oky Docky API</h1>
        <p>Frontend файл не найден. API работает на:</p>
        <ul>
            <li><a href="/docs">/docs - Swagger UI</a></li>
            <li><a href="/api/templates">/api/templates - Список шаблонов</a></li>
            <li><a href="/health">/health - Статус сервера</a></li>
        </ul>
        """)

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
# НОВЫЕ API ДЛЯ УЛУЧШЕННОГО ПАРСИНГА
# ===========================

@router.get("/api/templates")
async def get_templates():
    """
    ОБНОВЛЕНО: Получить список шаблонов с улучшенной информацией о плейсхолдерах
    """
    templates = []
    
    try:
        for json_file in pdf_processor.templates_dir.glob("*.json"):
            with open(json_file, encoding='utf-8') as f:
                metadata = json.load(f)
                
                # Получаем PDF файл
                pdf_file = pdf_processor.templates_dir / f"{metadata['id']}.pdf"
                
                if pdf_file.exists():
                    # НОВОЕ! Получаем расширенную информацию о плейсхолдерах
                    try:
                        placeholders = pdf_processor.advanced_parser.analyze_template_file(pdf_file)
                        form_fields = pdf_processor.advanced_parser.generate_form_fields(placeholders)
                        
                        # Добавляем новую информацию к метаданным
                        metadata['placeholders'] = {
                            name: {
                                'name': info.name,
                                'count': info.count,
                                'positions': info.positions,
                                'file_type': info.file_type
                            } for name, info in placeholders.items()
                        }
                        metadata['form_fields'] = form_fields
                        metadata['stats'] = {
                            'total_placeholders': len(placeholders),
                            'total_occurrences': sum(p.count for p in placeholders.values())
                        }
                        
                    except Exception as e:
                        print(f"⚠️ Ошибка анализа шаблона {metadata['id']}: {e}")
                        # Fallback на старые данные
                        metadata['placeholders'] = {}
                        metadata['form_fields'] = []
                        metadata['stats'] = {
                            'total_placeholders': len(metadata.get('variables', [])),
                            'total_occurrences': 0
                        }
                
                templates.append(metadata)
        
        # Сортируем по дате загрузки (новые первыми)
        templates.sort(key=lambda x: x.get('uploaded_at', ''), reverse=True)
        
        return {
            "success": True,
            "templates": {t['name']: t for t in templates},  # Формат как в frontend
            "total": len(templates),
            "last_scan": datetime.now().isoformat()
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения шаблонов: {str(e)}")

@router.get("/api/template/{template_name}")
async def get_template_info(template_name: str):
    """
    НОВОЕ: Получить подробную информацию о конкретном шаблоне
    """
    try:
        # Ищем шаблон по имени файла
        template_found = None
        
        for json_file in pdf_processor.templates_dir.glob("*.json"):
            with open(json_file, encoding='utf-8') as f:
                metadata = json.load(f)
                if metadata.get('name') == template_name or f"{metadata.get('id')}.pdf" == template_name:
                    template_found = metadata
                    break
        
        if not template_found:
            raise HTTPException(status_code=404, detail=f"Шаблон {template_name} не найден")
        
        # Получаем расширенную информацию
        pdf_file = pdf_processor.templates_dir / f"{template_found['id']}.pdf"
        if pdf_file.exists():
            placeholders = pdf_processor.advanced_parser.analyze_template_file(pdf_file)
            form_fields = pdf_processor.advanced_parser.generate_form_fields(placeholders)
            
            template_found['placeholders'] = {
                name: {
                    'name': info.name,
                    'count': info.count,
                    'positions': info.positions,
                    'file_type': info.file_type
                } for name, info in placeholders.items()
            }
            template_found['form_fields'] = form_fields
            template_found['stats'] = {
                'total_placeholders': len(placeholders),
                'total_occurrences': sum(p.count for p in placeholders.values())
            }
        
        return {
            "success": True,
            "template": template_found
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения информации о шаблоне: {str(e)}")

@router.get("/api/debug/placeholder_test/{template_name}")
async def debug_placeholder_test(template_name: str):
    """
    НОВОЕ: Отладочный эндпоинт для тестирования парсинга плейсхолдеров
    """
    try:
        # Ищем файл
        template_path = None
        
        # Сначала ищем по прямому имени файла
        direct_path = pdf_processor.templates_dir / template_name
        if direct_path.exists():
            template_path = direct_path
        else:
            # Ищем по ID в JSON файлах
            for json_file in pdf_processor.templates_dir.glob("*.json"):
                with open(json_file, encoding='utf-8') as f:
                    metadata = json.load(f)
                    if metadata.get('name') == template_name:
                        template_path = pdf_processor.templates_dir / f"{metadata['id']}.pdf"
                        break
        
        if not template_path or not template_path.exists():
            raise HTTPException(status_code=404, detail=f"Файл {template_name} не найден")
        
        # Получаем отладочную информацию
        debug_info = pdf_processor.debug_template(str(template_path))
        
        return {
            "success": True,
            "debug_info": debug_info
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка отладки: {str(e)}")

@router.post("/api/rescan_templates")
async def rescan_templates():
    """
    НОВОЕ: Принудительное пересканирование шаблонов
    """
    try:
        # Очищаем кэш
        pdf_processor.template_cache.clear()
        
        # Пересканируем все шаблоны
        rescanned_count = 0
        for json_file in pdf_processor.templates_dir.glob("*.json"):
            try:
                with open(json_file, encoding='utf-8') as f:
                    metadata = json.load(f)
                
                pdf_file = pdf_processor.templates_dir / f"{metadata['id']}.pdf"
                if pdf_file.exists():
                    # Повторно анализируем плейсхолдеры
                    variables = pdf_processor.extract_variables_from_template(str(pdf_file))
                    metadata['variables'] = variables
                    
                    # Сохраняем обновленные метаданные
                    with open(json_file, 'w', encoding='utf-8') as f:
                        json.dump(metadata, f, indent=2, ensure_ascii=False)
                    
                    rescanned_count += 1
                    
            except Exception as e:
                print(f"⚠️ Ошибка пересканирования {json_file}: {e}")
        
        return {
            "success": True,
            "message": "Шаблоны пересканированы",
            "total_templates": rescanned_count,
            "scan_time": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка пересканирования: {str(e)}")

# ===========================
# ОСТАЛЬНЫЕ ОРИГИНАЛЬНЫЕ ЭНДПОИНТЫ (БЕЗ ИЗМЕНЕНИЙ)
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
        
        # ОБНОВЛЕНО: Используем новый парсер для извлечения переменных
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
            "placeholders_found": len(variables),
            "message": f"Шаблон загружен! Найдено {len(variables)} переменных"
        }
        
    except Exception as e:
        # Удаляем файл если что-то пошло не так
        if template_path.exists():
            template_path.unlink()
        raise HTTPException(status_code=500, detail=f"Ошибка обработки файла: {str(e)}")

@router.get("/api/template/{form_id}")
async def get_template_info_by_id(form_id: str):
    """Получить информацию о конкретном шаблоне по ID"""
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

# Замени в myroutes.py функцию generate_document_by_name на эту:

@router.post("/api/generate/{template_name}")
async def generate_document_by_name(
    template_name: str,
    request: Request
):
    """
    ИСПРАВЛЕНО: Генерация документа по имени шаблона (для совместимости с frontend)
    Принимает данные как FormData
    """
    try:
        # Получаем данные из FormData
        form_data = await request.form()
        
        format_type = form_data.get('format_type', 'pdf')
        field_data_str = form_data.get('field_data', '{}')
        
        print(f"🔍 Получены данные: format_type={format_type}, field_data={field_data_str}")
        
        # Парсим данные полей
        try:
            import json
            fields = json.loads(field_data_str)
            print(f"📝 Распарсенные поля: {fields}")
        except json.JSONDecodeError as e:
            print(f"❌ Ошибка парсинга JSON: {e}")
            raise HTTPException(status_code=400, detail=f"Некорректный JSON в field_data: {e}")
        
        # Ищем шаблон по имени
        template_found = None
        for json_file in pdf_processor.templates_dir.glob("*.json"):
            with open(json_file, encoding='utf-8') as f:
                metadata = json.load(f)
                if metadata.get('name') == template_name or metadata.get('original_filename') == template_name:
                    template_found = metadata
                    print(f"✅ Найден шаблон: {metadata['name']} (ID: {metadata['id']})")
                    break
        
        if not template_found:
            print(f"❌ Шаблон {template_name} не найден")
            # Покажем доступные шаблоны для отладки
            available_templates = []
            for json_file in pdf_processor.templates_dir.glob("*.json"):
                with open(json_file, encoding='utf-8') as f:
                    metadata = json.load(f)
                    available_templates.append(metadata.get('name', 'Unknown'))
            
            raise HTTPException(
                status_code=404, 
                detail=f"Шаблон '{template_name}' не найден. Доступные: {available_templates}"
            )
        
        # Проверяем существование PDF файла
        pdf_path = pdf_processor.templates_dir / f"{template_found['id']}.pdf"
        if not pdf_path.exists():
            raise HTTPException(
                status_code=404, 
                detail=f"PDF файл для шаблона {template_name} не найден"
            )
        
        print(f"📄 Обрабатываем PDF: {pdf_path}")
        
        # Обрабатываем PDF с новым процессором
        try:
            result_bytes = pdf_processor.process_pdf_with_variables(
                str(pdf_path),
                fields,
                format_type
            )
            print(f"✅ PDF обработан, размер: {len(result_bytes)} байт")
        except Exception as e:
            print(f"❌ Ошибка обработки PDF: {e}")
            raise HTTPException(status_code=500, detail=f"Ошибка обработки PDF: {e}")
        
        # Определяем расширение и content-type
        if format_type == "png":
            extension = "png"
            content_type = "image/png"
        else:
            extension = "pdf"
            content_type = "application/pdf"
        
        # Генерируем имя файла
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{template_found['id']}_{timestamp}_{uuid.uuid4().hex[:6]}.{extension}"
        
        print(f"💾 Сохраняем файл: {filename}")
        
        # Сохраняем файл
        try:
            file_url = await storage.save_file(
                result_bytes,
                filename,
                content_type
            )
            print(f"✅ Файл сохранен: {file_url}")
        except Exception as e:
            print(f"❌ Ошибка сохранения файла: {e}")
            raise HTTPException(status_code=500, detail=f"Ошибка сохранения файла: {e}")
        
        return {
            "success": True,
            "message": "Документ успешно сгенерирован",
            "output_file": filename,
            "format": format_type,
            "download_url": file_url,
            "generated_at": datetime.now().isoformat()
        }
        
    except HTTPException:
        # Перебрасываем HTTP исключения как есть
        raise
    except Exception as e:
        print(f"💥 Неожиданная ошибка: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Внутренняя ошибка сервера: {str(e)}")


# ТАКЖЕ добавь вспомогательный endpoint для отладки:

@router.get("/api/debug/form_data_test")
async def debug_form_data_test():
    """Отладочный endpoint для проверки данных"""
    templates = []
    for json_file in pdf_processor.templates_dir.glob("*.json"):
        with open(json_file, encoding='utf-8') as f:
            metadata = json.load(f)
            templates.append({
                "id": metadata.get('id'),
                "name": metadata.get('name'),
                "original_filename": metadata.get('original_filename'),
                "variables": metadata.get('variables', []),
                "pdf_exists": (pdf_processor.templates_dir / f"{metadata['id']}.pdf").exists()
            })
    
    return {
        "available_templates": templates,
        "templates_dir": str(pdf_processor.templates_dir),
        "storage_dir": str(storage.local_storage)
    }
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

# НОВОЕ! Эндпоинт для генерации с новым форматом (совместимость с frontend)
@router.post("/api/generate/{template_name}")
async def generate_document_by_name(
    template_name: str,
    format_type: str,
    field_data: str
):
    """
    НОВОЕ: Генерация документа по имени шаблона (для совместимости с frontend)
    """
    try:
        import json
        
        # Парсим данные полей
        try:
            fields = json.loads(field_data)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Некорректный JSON в field_data")
        
        # Ищем шаблон по имени
        template_found = None
        for json_file in pdf_processor.templates_dir.glob("*.json"):
            with open(json_file, encoding='utf-8') as f:
                metadata = json.load(f)
                if metadata.get('name') == template_name:
                    template_found = metadata
                    break
        
        if not template_found:
            raise HTTPException(status_code=404, detail=f"Шаблон {template_name} не найден")
        
        # Создаем запрос в старом формате
        from models import FormData, OutputFormat
        
        # Преобразуем формат
        format_mapping = {
            'png': OutputFormat.PNG_FREE,
            'pdf': OutputFormat.PDF_LOCKED,
            'pdf_editable': OutputFormat.PDF_EDITABLE
        }
        
        output_format = format_mapping.get(format_type, OutputFormat.PDF_LOCKED)
        
        request = FormData(
            form_id=template_found['id'],
            variables=fields,
            output_format=output_format
        )
        
        # Используем существующую функцию генерации
        from fastapi import BackgroundTasks
        result = await generate_document(request, BackgroundTasks())
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка генерации документа: {str(e)}")

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

class ValidateRequest(BaseModel):
    form_id: str
    variables: Dict[str, str]

@router.post("/api/validate-variables")
async def validate_variables(payload: ValidateRequest):
    try:
        template_variables = pdf_processor.extract_variables_from_template(
            str(pdf_processor.templates_dir / f"{payload.form_id}.pdf")
        )

        missing_variables = []
        empty_variables = []

        for var in template_variables:
            if var not in payload.variables:
                missing_variables.append(var)
            elif not (payload.variables[var] or "").strip():
                empty_variables.append(var)

        is_valid = not missing_variables and not empty_variables

        return {
            "valid": is_valid,
            "missing_variables": missing_variables,
            "empty_variables": empty_variables,
            "provided_variables": list(payload.variables.keys()),
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

@router.get("/api/download/{filename}")
async def download_file(filename: str):
    """
    НОВОЕ: Скачивание сгенерированного файла (совместимость с frontend)
    """
    return await get_file(filename)
# ДОБАВЬ ЭТИ ЭНДПОИНТЫ В КОНЕЦ backend/myroutes.py (перед последней строкой):

@router.post("/api/generate/{template_name}")
async def generate_document_by_name(
    template_name: str,
    request: Request
):
    """Генерация документа по имени шаблона (для совместимости с frontend)"""
    try:
        # Получаем данные из FormData
        form_data = await request.form()
        
        format_type = form_data.get('format_type', 'pdf')
        field_data_str = form_data.get('field_data', '{}')
        
        print(f"🔍 Получены данные: format_type={format_type}, field_data={field_data_str}")
        
        # Парсим данные полей
        try:
            fields = json.loads(field_data_str)
            print(f"📝 Распарсенные поля: {fields}")
        except json.JSONDecodeError as e:
            print(f"❌ Ошибка парсинга JSON: {e}")
            raise HTTPException(status_code=400, detail=f"Некорректный JSON в field_data: {e}")
        
        # Ищем шаблон по имени
        template_found = None
        for json_file in pdf_processor.templates_dir.glob("*.json"):
            with open(json_file, encoding='utf-8') as f:
                metadata = json.load(f)
                if metadata.get('name') == template_name or metadata.get('original_filename') == template_name:
                    template_found = metadata
                    print(f"✅ Найден шаблон: {metadata['name']} (ID: {metadata['id']})")
                    break
        
        if not template_found:
            print(f"❌ Шаблон {template_name} не найден")
            # Покажем доступные шаблоны для отладки
            available_templates = []
            for json_file in pdf_processor.templates_dir.glob("*.json"):
                with open(json_file, encoding='utf-8') as f:
                    metadata = json.load(f)
                    available_templates.append(metadata.get('name', 'Unknown'))
            
            raise HTTPException(
                status_code=404, 
                detail=f"Шаблон '{template_name}' не найден. Доступные: {available_templates}"
            )
        
        # Проверяем существование PDF файла
        pdf_path = pdf_processor.templates_dir / f"{template_found['id']}.pdf"
        if not pdf_path.exists():
            raise HTTPException(
                status_code=404, 
                detail=f"PDF файл для шаблона {template_name} не найден"
            )
        
        print(f"📄 Обрабатываем PDF: {pdf_path}")
        
        # Обрабатываем PDF с новым процессором
        try:
            result_bytes = pdf_processor.process_pdf_with_variables(
                str(pdf_path),
                fields,
                format_type
            )
            print(f"✅ PDF обработан, размер: {len(result_bytes)} байт")
        except Exception as e:
            print(f"❌ Ошибка обработки PDF: {e}")
            raise HTTPException(status_code=500, detail=f"Ошибка обработки PDF: {e}")
        
        # Определяем расширение и content-type
        if format_type == "png":
            extension = "png"
            content_type = "image/png"
        else:
            extension = "pdf"
            content_type = "application/pdf"
        
        # Генерируем имя файла
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{template_found['id']}_{timestamp}_{uuid.uuid4().hex[:6]}.{extension}"
        
        print(f"💾 Сохраняем файл: {filename}")
        
        # Сохраняем файл
        try:
            file_url = await storage.save_file(
                result_bytes,
                filename,
                content_type
            )
            print(f"✅ Файл сохранен: {file_url}")
        except Exception as e:
            print(f"❌ Ошибка сохранения файла: {e}")
            raise HTTPException(status_code=500, detail=f"Ошибка сохранения файла: {e}")
        
        return {
            "success": True,
            "message": "Документ успешно сгенерирован",
            "output_file": filename,
            "format": format_type,
            "download_url": file_url,
            "generated_at": datetime.now().isoformat()
        }
        
    except HTTPException:
        # Перебрасываем HTTP исключения как есть
        raise
    except Exception as e:
        print(f"💥 Неожиданная ошибка: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Внутренняя ошибка сервера: {str(e)}")


@router.get("/api/debug/form_data_test")
async def debug_form_data_test():
    """Отладочный endpoint для проверки данных"""
    templates = []
    for json_file in pdf_processor.templates_dir.glob("*.json"):
        with open(json_file, encoding='utf-8') as f:
            metadata = json.load(f)
            templates.append({
                "id": metadata.get('id'),
                "name": metadata.get('name'),
                "original_filename": metadata.get('original_filename'),
                "variables": metadata.get('variables', []),
                "pdf_exists": (pdf_processor.templates_dir / f"{metadata['id']}.pdf").exists()
            })
    
    return {
        "available_templates": templates,
        "templates_dir": str(pdf_processor.templates_dir),
        "storage_dir": str(storage.local_storage)
    }