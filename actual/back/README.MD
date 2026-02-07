Сохрани как actual/back/README.md:

# Oky-Docky Backend (Fillable PDF Processor)

Backend-сервис для заполнения **fillable PDF (AcroForm)** по шаблонам.
Каждый документ — это папка с PDF + schema + mapping.

## Требования
- Python 3.12+
- pip

## Установка зависимостей
Из корня репозитория:

```bash
pip install -r actual/requirements.txt

Запуск сервера
uvicorn actual.back.fillable_processor:app --reload --host 0.0.0.0 --port 8000


После запуска:

API будет доступен на http://localhost:8000

Документация Swagger: http://localhost:8000/docs

Структура шаблонов документов

Шаблоны лежат в:

actual/back/data/templates/<template_id>/


Минимальный набор файлов в папке шаблона:

template.json — мета (engine/pdf/schema/mapping)

schema.json — список “человеческих” полей (ключи формы)

mapping.json — привязка ключей формы к PDF-полям

<pdf> — сам PDF (путь указан в template.json)