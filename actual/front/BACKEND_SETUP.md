# Backend Setup (FastAPI)

## One-command run (recommended)

```bash
./start-dev.sh
```

## Manual backend setup

```bash
pip install -r actual/requirements.txt
uvicorn actual.back.fillable_processor:app --reload --host 0.0.0.0 --port 8000
```

Проверка:
- Swagger: `http://localhost:8000/docs`
- Templates API: `http://localhost:8000/api/templates`

## API overview

- `GET /api/templates` — список доступных форм и метаданных.
- `GET /api/templates/{template_id}/schema` — схема вопросов для фронта.
- `POST /api/render/{template_id}` — генерация заполненного PDF.
- `POST /api/feedback` — обратная связь (email/sms).

## W-4: client-oriented логика

Для `w4-2026` фронт спрашивает **количество**:
- `qualifying_children_count`
- `other_dependents_count`

Backend автоматически вычисляет суммы для PDF:
- `qualifying_children_amount = count * 2000`
- `other_dependents_amount = count * 500`
- `total_dependents_amount = children_amount + other_dependents_amount`

То есть клиенту не нужно вручную считать значения для Step 3.

## Feedback handler config

### Email channel

Установите переменные окружения:

```bash
export FEEDBACK_SMTP_HOST="smtp.gmail.com"
export FEEDBACK_SMTP_PORT="587"
export FEEDBACK_SMTP_USERNAME="bot@your-domain.com"
export FEEDBACK_SMTP_PASSWORD="app-password"
export FEEDBACK_TO_EMAIL="support@your-domain.com"
export FEEDBACK_FROM_EMAIL="oky-docky@your-domain.com"   # optional
```

### SMS channel

Установите webhook URL вашего SMS-провайдера (Twilio/MessageBird/внутренний шлюз):

```bash
export FEEDBACK_SMS_WEBHOOK_URL="https://your-gateway/send-sms"
```

Backend отправит туда JSON:

```json
{
  "to": "+15551234567",
  "message": "...",
  "name": "Client Name",
  "source": "oky-docky-feedback"
}
```
