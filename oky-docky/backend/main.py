"""
Oky Docky - Генератор документов
Main приложение на FastAPI С ПОДДЕРЖКОЙ СТАТИЧЕСКИХ ФАЙЛОВ
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import HTTPException
from fastapi.staticfiles import StaticFiles
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
# НАСТРОЙКА СТАТИЧЕСКИХ ФАЙЛОВ
# ===========================

# Создаем необходимые папки
static_dirs = [
    "FRONTEND_UI",
    "FRONTEND_UI/JS",
    "FRONTEND_UI/JS/SCRIPTS",
    "FRONTEND_UI/CSS",
    "FRONTEND_UI/HTML",
    "generated_files",
    "templates"
]

for dir_path in static_dirs:
    Path(dir_path).mkdir(parents=True, exist_ok=True)
    logger.info(f"📁 Папка {dir_path} готова")

# Монтируем статические файлы
try:
    # Основная папка фронтенда
    app.mount("/static", StaticFiles(directory="FRONTEND_UI"), name="static")
    logger.info("📂 Статические файлы смонтированы: /static -> FRONTEND_UI")
    
    # JS файлы (для прямого доступа)
    if Path("FRONTEND_UI/JS").exists():
        app.mount("/js", StaticFiles(directory="FRONTEND_UI/JS"), name="js")
        logger.info("📜 JS файлы смонтированы: /js -> FRONTEND_UI/JS")
    
    # CSS файлы
    if Path("FRONTEND_UI/CSS").exists():
        app.mount("/css", StaticFiles(directory="FRONTEND_UI/CSS"), name="css")
        logger.info("🎨 CSS файлы смонтированы: /css -> FRONTEND_UI/CSS")
    
    # Сгенерированные файлы для скачивания
    if Path("generated_files").exists():
        app.mount("/files", StaticFiles(directory="generated_files"), name="files")
        logger.info("📄 Файлы для скачивания: /files -> generated_files")
        
except Exception as e:
    logger.error(f"❌ Ошибка монтирования статических файлов: {e}")

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
    
    # Не логируем статические файлы чтобы не засорять лог
    if not any(request.url.path.startswith(prefix) for prefix in ["/static", "/css", "/js", "/files"]):
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
        Path("logs"),
        Path("FRONTEND_UI/JS/SCRIPTS"),
        Path("FRONTEND_UI/CSS"),
        Path("FRONTEND_UI/HTML")
    ]
    
    for folder in folders_to_create:
        folder.mkdir(parents=True, exist_ok=True)
        logger.info(f"📁 Папка {folder} готова")
    
    # Проверяем наличие шаблонов
    templates_count = len(list(Path("templates").glob("*.json")))
    logger.info(f"📄 Найдено шаблонов: {templates_count}")
    
    # Проверяем статические файлы
    js_files = list(Path("FRONTEND_UI/JS").rglob("*.js"))
    css_files = list(Path("FRONTEND_UI/CSS").rglob("*.css"))
    html_files = list(Path("FRONTEND_UI/HTML").rglob("*.html"))
    
    logger.info(f"📜 JS файлов: {len(js_files)}")
    logger.info(f"🎨 CSS файлов: {len(css_files)}")  
    logger.info(f"📰 HTML файлов: {len(html_files)}")
    
    # Показываем доступные пути
    logger.info("🌐 Доступные пути:")
    logger.info("   📍 Главная страница: http://localhost:8000/")
    logger.info("   📍 API документация: http://localhost:8000/docs")
    logger.info("   📍 Статические файлы: http://localhost:8000/static/")
    logger.info("   📍 JS файлы: http://localhost:8000/js/")
    logger.info("   📍 CSS файлы: http://localhost:8000/css/")
    
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
# ДОПОЛНИТЕЛЬНЫЕ РОУТЫ ДЛЯ СТАТИКИ
# ===========================

@app.get("/favicon.ico")
async def favicon():
    """Фавикон"""
    return {"message": "No favicon"}

# Альтернативные пути для статических файлов
@app.get("/workspaces/oky-docky/oky-docky/FRONTEND_UI/JS/SCRIPTS/main.js")
async def main_js_alt():
    """Альтернативный путь для main.js"""
    try:
        js_file = Path("FRONTEND_UI/JS/SCRIPTS/main.js")
        if js_file.exists():
            with open(js_file, 'r', encoding='utf-8') as f:
                content = f.read()
            return Response(content=content, media_type="application/javascript")
        else:
            logger.error(f"❌ Файл не найден: {js_file}")
            raise HTTPException(status_code=404, detail="main.js не найден")
    except Exception as e:
        logger.error(f"❌ Ошибка чтения main.js: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Дополнительный роут для проверки статических файлов
@app.get("/debug/static-files")
async def debug_static_files():
    """Отладочная информация о статических файлах"""
    try:
        static_info = {
            "frontend_ui_exists": Path("FRONTEND_UI").exists(),
            "js_dir_exists": Path("FRONTEND_UI/JS").exists(),
            "main_js_exists": Path("FRONTEND_UI/JS/SCRIPTS/main.js").exists(),
            "files": {
                "js": [str(f) for f in Path("FRONTEND_UI/JS").rglob("*.js")] if Path("FRONTEND_UI/JS").exists() else [],
                "css": [str(f) for f in Path("FRONTEND_UI/CSS").rglob("*.css")] if Path("FRONTEND_UI/CSS").exists() else [],
                "html": [str(f) for f in Path("FRONTEND_UI/HTML").rglob("*.html")] if Path("FRONTEND_UI/HTML").exists() else []
            },
            "mounted_paths": {
                "/static": "FRONTEND_UI",
                "/js": "FRONTEND_UI/JS", 
                "/css": "FRONTEND_UI/CSS",
                "/files": "generated_files"
            }
        }
        
        return static_info
        
    except Exception as e:
        return {"error": str(e)}

# ===========================
# ПОДКЛЮЧЕНИЕ МАРШРУТОВ
# ===========================

# ВСЕ API ПУТИ ТОЛЬКО В РОУТЕРЕ!
app.include_router(router)

# Импорт Response для main.js роута
from fastapi.responses import Response

logger.info("✅ main.py загружен успешно!")