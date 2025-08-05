# ===========================
# run.py - Скрипт для запуска0
# ===========================
from pathlib import Path
import uvicorn

if __name__ == "__main__":
    # Создаём папки, если их нет
    Path("templates").mkdir(exist_ok=True)
    Path("generated_files").mkdir(exist_ok=True)

    # Запускаем FastAPI сервер
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )



