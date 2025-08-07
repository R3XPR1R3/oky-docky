"""
Oky Docky - Генератор документов
Main приложение на FastAPI (БЕЗ дублирования маршрутов!)

Здесь только настройки приложения, все пути в myroutes.py
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import HTTPException
from pathlib import Path
import os
import logging
from datetime import datetime

# Импортируем только роутер
from myroutes import router

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Создаем приложение FastAPI
app = FastAPI(
    title="Oky Docky API",
    description="🚀 Генератор документов с автозаполнением переменных",
    version="2.0",
    docs_url="/docs",  # Swagger UI
    redoc_url="/redoc"  # ReDoc
)

# ===========================
# MIDDLEWARE
# ===========================



# CORS для фронтенда
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В продакшене заменить на конкретные домены
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Middleware для логирования запросов
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = datetime.now()
    
    # Выполняем запрос
    response = await call_next(request)
    
    # Логируем результат
    process_time = (datetime.now() - start_time).total_seconds()
    logger.info(
        f"{request.method} {request.url.path} - "
        f"Status: {response.status_code} - "
        f"Time: {process_time:.3f}s"
    )
    
    return response

# ===========================
# STARTUP/SHUTDOWN
# ===========================

@app.on_event("startup")
async def startup_event():
    """Инициализация при запуске приложения"""
    logger.info("🚀 Запуск Oky Docky...")
    
    # Создаём необходимые папки
    folders_to_create = [
        Path("templates"),
        Path("generated_files"),
        Path("logs")
    ]
    
    for folder in folders_to_create:
        folder.mkdir(exist_ok=True)
        logger.info(f"📁 Папка {folder} готова")
    
    # Проверяем наличие шаблонов
    templates_count = len(list(Path("templates").glob("*.json")))
    logger.info(f"📄 Найдено шаблонов: {templates_count}")
    
    logger.info("🎉 Oky Docky готов к работе!")

@app.on_event("shutdown")
async def shutdown_event():
    """Очистка при завершении работы"""
    logger.info("👋 Завершение работы Oky Docky...")

# ===========================
# ОБРАБОТЧИКИ ОШИБОК
# ===========================

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Красивая обработка HTTP ошибок"""
    logger.warning(f"HTTP {exc.status_code}: {exc.detail} - {request.url}")
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": exc.detail,
            "status_code": exc.status_code,
            "timestamp": datetime.now().isoformat()
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Обработка общих ошибок"""
    logger.error(f"Неожиданная ошибка: {exc} - {request.url}")
    
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Внутренняя ошибка сервера",
            "status_code": 500,
            "timestamp": datetime.now().isoformat()
        }
    )

# ===========================
# ПОДКЛЮЧЕНИЕ МАРШРУТОВ
# ===========================

# ВСЕ ПУТИ ТОЛЬКО В РОУТЕРЕ!
app.include_router(router)

# Готово! Больше ничего не нужно!