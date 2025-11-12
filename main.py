"""
Oky Docky - Генератор документов
Main приложение на FastAPI С УЛУЧШЕННОЙ ПОДДЕРЖКОЙ СТАТИЧЕСКИХ ФАЙЛОВ
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, FileResponse
from fastapi.exceptions import HTTPException
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import os
import logging
from datetime import datetime

# Импортируем только роутер
from myroutes import router

# создаем базовую директорию и папку фронтенда
BASE_DIR = Path(__file__).resolve().parent.parent   # /workspaces/oky-docky/oky-docky
FRONTEND_DIR = BASE_DIR / "FRONTEND_UI"            # .../FRONTEND_UI

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
    docs_url="/docs",
    redoc_url="/redoc"
)

# ===========================
# СОЗДАНИЕ И ПРОВЕРКА ПАПОК
# ===========================

def ensure_directories():
    """Создает необходимые папки и проверяет файлы"""
    dirs_to_create = [
        "FRONTEND_UI",
        "FRONTEND_UI/JS",
        "FRONTEND_UI/JS/SCRIPTS", 
        "FRONTEND_UI/CSS",
        "FRONTEND_UI/HTML",
        "FRONTEND_UI/HTML/index",
        "generated_files",
        "templates",
        "logs"
    ]
    
    for dir_path in dirs_to_create:
        Path(dir_path).mkdir(parents=True, exist_ok=True)
        logger.info(f"📁 Папка {dir_path} готова")
    
    # Проверяем ключевые файлы
    important_files = {
        "/workspaces/oky-docky/oky-docky/FRONTEND_UI/HTML/index/mainpage.html": "HTML файл главной страницы",
        FRONTEND_DIR / "HTML/index/mainpage.html": "HTML файл главной страницы",
        FRONTEND_DIR / "JS/SCRIPTS/main.js":      "Главный JavaScript файл"
        }

    
    
    for file_path, description in important_files.items():
        if Path(file_path).exists():
            size = Path(file_path).stat().st_size
            logger.info(f"✅ {description}: {file_path} ({size} байт)")
        else:
            logger.error(f"❌ ОТСУТСТВУЕТ {description}: {file_path}")

# ===========================
# НАСТРОЙКА СТАТИЧЕСКИХ ФАЙЛОВ
# ===========================

def setup_static_files():
    """Настройка монтирования статических файлов"""
    try:
        # Проверяем существование папок
        frontend_path = Path("FRONTEND_UI")
        if not frontend_path.exists():
            logger.error(f"❌ Папка {frontend_path} не найдена!")
            return False
        
        # Основная папка фронтенда - САМОЕ ВАЖНОЕ!
        app.mount("/static", StaticFiles(directory=FRONTEND_DIR),            name="static")
        logger.info("📂 Основная статика: /static -> FRONTEND_UI")
        
        # JS файлы (альтернативный путь)
        js_path = Path("FRONTEND_UI/JS")
        if js_path.exists():
            app.mount("/js",     StaticFiles(directory=FRONTEND_DIR / "JS"),     name="js")
            logger.info("📜 JS файлы: /js -> FRONTEND_UI/JS")
        
        # CSS файлы
        css_path = Path("FRONTEND_UI/CSS")
        if css_path.exists():
            app.mount("/css",    StaticFiles(directory=FRONTEND_DIR / "CSS"),    name="css")
            logger.info("🎨 CSS файлы: /css -> FRONTEND_UI/CSS")
        
        # Сгенерированные файлы для скачивания
        generated_path = Path("generated_files")
        if generated_path.exists():
            app.mount("/files", StaticFiles(directory="generated_files"), name="files")
            logger.info("📄 Файлы для скачивания: /files -> generated_files")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Ошибка монтирования статических файлов: {e}")
        return False

# Инициализируем папки
ensure_directories()

# Монтируем статические файлы
static_setup_success = setup_static_files()

# ===========================
# MIDDLEWARE
# ===========================

# CORS для фронтенда
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Middleware для логирования запросов (с фильтрацией)
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = datetime.now()
    
    # Выполняем запрос
    response = await call_next(request)
    
    # Логируем результат (исключаем статические файлы)
    process_time = (datetime.now() - start_time).total_seconds()
    
    # Не логируем статические файлы и успешные запросы к ним
    should_log = not any(request.url.path.startswith(prefix) for prefix in ["/static", "/css", "/js", "/files"])
    
    if should_log or response.status_code >= 400:
        status_emoji = "✅" if response.status_code < 400 else "❌"
        logger.info(
            f"{status_emoji} {request.method} {request.url.path} - "
            f"Status: {response.status_code} - "
            f"Time: {process_time:.3f}s"
        )
    
    return response

# ===========================
# СПЕЦИАЛЬНЫЕ РОУТЫ ДЛЯ СТАТИКИ (ОТЛАДКА)
# ===========================

@app.get("/debug/static-check")
async def debug_static_check():
    """Отладочная проверка статических файлов"""
    check_result = {
        "directories": {},
        "files": {},
        "mounted_paths": [],
        "recommendations": []
    }
    
    # Проверяем папки
    important_dirs = ["FRONTEND_UI", "FRONTEND_UI/JS", "FRONTEND_UI/JS/SCRIPTS", "FRONTEND_UI/CSS", "FRONTEND_UI/HTML"]
    for dir_path in important_dirs:
        path = Path(dir_path)
        check_result["directories"][dir_path] = {
            "exists": path.exists(),
            "is_dir": path.is_dir() if path.exists() else False,
            "files_count": len(list(path.iterdir())) if path.exists() and path.is_dir() else 0
        }
    
    # Проверяем файлы
    important_files = [
        "/workspaces/oky-docky/oky-docky/FRONTEND_UI/HTML/index/mainpage.html",
        "/workspaces/oky-docky/oky-docky/FRONTEND_UI/JS/SCRIPTS/main.js"
    ]
    for file_path in important_files:
        path = Path(file_path)
        check_result["files"][file_path] = {
            "exists": path.exists(),
            "size": path.stat().st_size if path.exists() else 0,
            "readable": True
        }
        
        # Проверяем содержимое JS файла
        if file_path.endswith("main.js") and path.exists():
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    check_result["files"][file_path]["has_oky_class"] = "OkyDockyApp" in content
                    check_result["files"][file_path]["has_init"] = "init()" in content
            except Exception as e:
                check_result["files"][file_path]["read_error"] = str(e)
    
    # Список смонтированных путей
    check_result["mounted_paths"] = [
        "/static -> FRONTEND_UI",
        "/js -> FRONTEND_UI/JS",
        "/css -> FRONTEND_UI/CSS", 
        "/files -> generated_files"
    ]
    
    # Рекомендации
    if not check_result["files"]["/workspaces/oky-docky/oky-docky/FRONTEND_UI/JS/SCRIPTS/main.js"]["exists"]:
        check_result["recommendations"].append("❌ Создайте файл FRONTEND_UI/JS/SCRIPTS/main.js")

        print("❌ Создайте файл FRONTEND_UI/JS/SCRIPTS/main.js")
        
    if not check_result["files"]["/workspaces/oky-docky/oky-docky/FRONTEND_UI/HTML/index/mainpage.html"]["exists"]:
        check_result["recommendations"].append("❌ Создайте файл FRONTEND_UI/HTML/index/mainpage.html")
    
        print("❌ Создайте файл FRONTEND_UI/HTML/index/mainpage.html")

    if not static_setup_success:
        check_result["recommendations"].append("❌ Проблема с монтированием статических файлов")
    
        print("❌ Проблема с монтированием статических файлов")

    if len(check_result["recommendations"]) == 0:
        check_result["recommendations"].append("✅ Все файлы на месте!")
    
    return check_result

@app.get("/test-js")
async def test_js_loading():
    """Тестовая страница для проверки загрузки JS"""
    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Тест загрузки JS</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 2rem; }
            .test-result { padding: 1rem; margin: 1rem 0; border-radius: 5px; }
            .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
            .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        </style>
    </head>
    <body>
        <h1>🧪 Тест загрузки JavaScript</h1>
        <div id="results"></div>
        
        <h2>Попытки загрузки:</h2>
        <ol id="attempts"></ol>
        
        <script>
            const results = document.getElementById('results');
            const attempts = document.getElementById('attempts');
            
            function addResult(message, success = true) {
                const div = document.createElement('div');
                div.className = `test-result ${success ? 'success' : 'error'}`;
                div.textContent = message;
                results.appendChild(div);
            }
            
            function addAttempt(path, success = false) {
                const li = document.createElement('li');
                li.innerHTML = `<strong>${path}</strong> - ${success ? '✅ Успешно' : '❌ Ошибка'}`;
                attempts.appendChild(li);
            }
            
            // Тестируем пути к JS
            const testPaths = [
                '/static/JS/SCRIPTS/main.js',
                '/js/SCRIPTS/main.js', 
                '/FRONTEND_UI/JS/SCRIPTS/main.js',
                '/static/main.js'
            ];
            
            let pathIndex = 0;
            
            function testNextPath() {
                if (pathIndex >= testPaths.length) {
                    addResult('❌ Ни один путь не сработал!', false);
                    return;
                }
                
                const currentPath = testPaths[pathIndex];
                const script = document.createElement('script');
                script.src = currentPath;
                
                script.onload = () => {
                    addAttempt(currentPath, true);
                    addResult(`✅ JS успешно загружен: ${currentPath}`, true);
                    
                    // Проверяем наличие нашего класса
                    setTimeout(() => {
                        if (typeof OkyDockyApp !== 'undefined') {
                            addResult('✅ Класс OkyDockyApp найден!', true);
                        } else if (typeof app !== 'undefined') {
                            addResult('✅ Переменная app найдена!', true);
                        } else {
                            addResult('⚠️ JS загружен, но класс OkyDockyApp не найден', false);
                        }
                    }, 100);
                };
                
                script.onerror = () => {
                    addAttempt(currentPath, false);
                    pathIndex++;
                    testNextPath();
                };
                
                document.head.appendChild(script);
            }
            
            // Начинаем тестирование
            testNextPath();
        </script>
    </body>
    </html>
    """
    return Response(content=html_content, media_type="text/html")

# ===========================
# ОБРАБОТЧИКИ ОШИБОК
# ===========================

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Улучшенная обработка HTTP ошибок"""
    
    # Специальная обработка для статических файлов
    if any(request.url.path.startswith(prefix) for prefix in ["/static", "/js", "/css"]):
        logger.warning(f"📂 Статический файл не найден: {request.url.path}")
        
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error": f"Статический файл не найден: {request.url.path}",
                "suggestions": [
                    "Проверьте существование файла",
                    "Убедитесь, что файл находится в правильной папке",
                    "Проверьте настройки StaticFiles в main.py"
                ],
                "available_paths": ["/static/", "/js/", "/css/", "/files/"],
                "timestamp": datetime.now().isoformat()
            }
        )
    
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
    logger.error(f"💥 Неожиданная ошибка: {exc} - {request.url}")
    
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
# STARTUP/SHUTDOWN
# ===========================

@app.on_event("startup")
async def startup_event():
    """Улучшенная инициализация при запуске"""
    logger.info("🚀 Запуск Oky Docky...")
    
    # Проверяем файловую систему еще раз
    ensure_directories()
    
    # Статистика файлов
    js_files = list(Path("/workspaces/oky-docky/oky-docky/FRONTEND_UI/JS").rglob("*.js")) if Path("FRONTEND_UI").exists() else []
    css_files = list(Path("/workspaces/oky-docky/oky-docky/FRONTEND_UI/CSS").rglob("*.css")) if Path("FRONTEND_UI").exists() else []
    html_files = list(Path("/workspaces/oky-docky/oky-docky/FRONTEND_UI/HTML").rglob("*.html")) if Path("FRONTEND_UI").exists() else []
    templates_count = len(list(Path("templates").glob("*.json")))
    
    logger.info(f"📊 Статистика файлов:")
    logger.info(f"   📜 JS файлов: {len(js_files)}")
    logger.info(f"   🎨 CSS файлов: {len(css_files)}")
    logger.info(f"   📰 HTML файлов: {len(html_files)}")
    logger.info(f"   📄 Шаблонов: {templates_count}")
    
    # Показываем найденные файлы
    if js_files:
        logger.info("📜 JS файлы:")
        for js_file in js_files:
            logger.info(f"   - {js_file}")
    
    # Проверяем основной JS файл
    main_js_path = Path("FRONTEND_UI/JS/SCRIPTS/main.js")
    if main_js_path.exists():
        size = main_js_path.stat().st_size
        logger.info(f"✅ main.js найден: {size} байт")
        
        # Проверяем содержимое
        try:
            with open(main_js_path, 'r', encoding='utf-8') as f:
                content = f.read()
                if 'class OkyDockyApp' in content:
                    logger.info("✅ Класс OkyDockyApp найден в main.js")
                else:
                    logger.warning("⚠️ Класс OkyDockyApp НЕ найден в main.js")
        except Exception as e:
            logger.error(f"❌ Ошибка чтения main.js: {e}")
    else:
        logger.error("❌ main.js НЕ НАЙДЕН!")
    
    # Показываем доступные URL
    logger.info("🌐 Доступные пути:")
    logger.info("   📍 Главная страница: http://localhost:8000/")
    logger.info("   📍 API документация: http://localhost:8000/docs")
    logger.info("   📍 Тест JS: http://localhost:8000/test-js")
    logger.info("   📍 Проверка статики: http://localhost:8000/debug/static-check")
    logger.info("   📍 Статические файлы: http://localhost:8000/static/")
    logger.info("   📍 JS файлы: http://localhost:8000/js/")
    
    if static_setup_success:
        logger.info("🎉 Статические файлы настроены успешно!")
    else:
        logger.error("❌ Проблемы с настройкой статических файлов!")
    
    logger.info("🎉 Oky Docky готов к работе!")

@app.on_event("shutdown")
async def shutdown_event():
    """Очистка при завершении работы"""
    logger.info("👋 Завершение работы Oky Docky...")

# ===========================
# ДОПОЛНИТЕЛЬНЫЕ СЛУЖЕБНЫЕ РОУТЫ
# ===========================

@app.get("/favicon.ico")
async def favicon():
    """Фавикон"""
    return Response(status_code=204)

# Прямой роут для main.js (если StaticFiles не работает)
@app.get("/main.js")
async def serve_main_js():
    """Прямая отдача main.js"""
    main_js_path = Path("FRONTEND_UI/JS/SCRIPTS/main.js")
    
    if main_js_path.exists():
        logger.info(f"📜 Отдаем main.js напрямую: {main_js_path}")
        return FileResponse(
            main_js_path,
            media_type="application/javascript",
            filename="main.js"
        )
    else:
        logger.error("❌ main.js не найден для прямой отдачи")
        raise HTTPException(status_code=404, detail="main.js не найден")

# Альтернативный путь для main.js 
@app.get("/static/main.js")
async def serve_main_js_alt():
    """Альтернативный путь для main.js"""
    return await serve_main_js()

# ===========================
# ПОДКЛЮЧЕНИЕ МАРШРУТОВ
# ===========================

# Подключаем все API маршруты
app.include_router(router)

logger.info("✅ main.py загружен успешно!")