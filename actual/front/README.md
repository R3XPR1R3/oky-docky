# Oky-Docky Frontend

React + Vite интерфейс для пошагового заполнения налоговых PDF-форм.

## Быстрый старт (одной командой)

Из корня репозитория:

```bash
./start-dev.sh
```

Скрипт автоматически:
1. ставит Python зависимости (`actual/requirements.txt`),
2. ставит npm зависимости (`actual/front/package.json`),
3. поднимает backend на `http://localhost:8000`,
4. поднимает frontend на `http://localhost:5173`.

## Ручной запуск

```bash
# terminal 1
uvicorn actual.back.fillable_processor:app --reload --host 0.0.0.0 --port 8000

# terminal 2
cd actual/front
npm install
npm run dev
```

## Production build

```bash
cd actual/front
npm run build
```

## Где лежат сценарии форм

Сценарий каждой формы живёт в backend-шаблоне:
- `actual/back/data/templates/w9-2026/`
- `actual/back/data/templates/w4-2026/`
- `actual/back/data/templates/f14039-2026/`

Внутри каждой папки:
- `template.json` — мета/идентификатор формы,
- `schema.json` — какие вопросы задаём клиенту,
- `mapping.json` — как ответы маппятся в PDF поля,
- `*.pdf` — оригинальный шаблон документа.


## Backend-driven question flow

Frontend now asks backend to resolve visible questions for a template via:
- `POST /api/templates/{template_id}/resolve-questions`

This keeps scenario logic on backend and makes frontend thinner.

## SEO basics

`index.html` includes description, canonical, OpenGraph/Twitter tags, and JSON-LD (`SoftwareApplication`).
