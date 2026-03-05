# Oky-Docky Backend (Fillable PDF Processor)

Backend-сервис для заполнения PDF (AcroForm) по шаблонам.

## Запуск

Из корня репозитория:

```bash
pip install -r actual/requirements.txt
uvicorn actual.back.fillable_processor:app --reload --host 0.0.0.0 --port 8000
```

Или одной командой вместе с фронтом:

```bash
./start-dev.sh
```

## Основные endpoint'ы

- `GET /api/templates`
- `GET /api/templates/{template_id}`
- `GET /api/templates/{template_id}/schema`
- `GET /api/templates/{template_id}/pdf-fields`
- `POST /api/render/{template_id}`
- `POST /api/feedback`

## Где лежат сценарии форм

Формы лежат в `actual/back/data/templates/<template_id>/`.

Каждая форма содержит:
- `template.json` — мета и ссылки на файлы,
- `schema.json` — UX-сценарий вопросов,
- `mapping.json` — маппинг ответов в PDF-поля,
- PDF-файл шаблона.

Текущие формы:
- `w9-2026`
- `w4-2026`
- `f14039-2026`

## W-4: автоматический расчёт Step 3

Backend получает клиентские поля:
- `qualifying_children_count`
- `other_dependents_count`

И автоматически вычисляет суммы для PDF:
- `qualifying_children_amount`
- `other_dependents_amount`
- `total_dependents_amount`

## Обратная связь (email / sms)

`POST /api/feedback` принимает:

```json
{
  "channel": "email",
  "name": "John",
  "contact": "john@example.com",
  "message": "Need help"
}
```

### Email config

- `FEEDBACK_SMTP_HOST`
- `FEEDBACK_SMTP_PORT`
- `FEEDBACK_SMTP_USERNAME`
- `FEEDBACK_SMTP_PASSWORD`
- `FEEDBACK_TO_EMAIL`
- `FEEDBACK_FROM_EMAIL` (optional)

### SMS config

- `FEEDBACK_SMS_WEBHOOK_URL`


## Scenario Builder (admin)

- Open `http://localhost:8000/admin/scenario-builder`
- Edit `template.json`, `schema.json`, `mapping.json` directly in browser
- Save writes back to `actual/back/data/templates/<template_id>/`

### Scenario language in mapping

`mapping.json` now supports programmable rules:
- `math` with operations: `add`, `sum`, `subtract`, `multiply`, `divide`, `pow`, `mod`, `min`, `max`, `avg`, `round`
- `set_var` to persist values in variables during scenario execution
- `if` for conditional assignments

Variables can be referenced as `var:<name>` inside rule inputs/conditions.


## Backend-driven question resolver

- `POST /api/templates/{template_id}/resolve-questions`
- Payload: `{ "answers": { ... } }`
- Returns server-resolved visible `fields` based on schema `visible_when` rules.
