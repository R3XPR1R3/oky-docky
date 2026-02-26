# Backend Setup Instructions

## Quick Start (Demo Mode - No Backend Required)

The app is currently running in **DEMO MODE** which means you can use it immediately without setting up the backend. A mock PDF will be generated for testing purposes.

To use demo mode, the `DEMO_MODE` constant in `/src/app/App.tsx` is set to `true`.

## Production Mode (With Real Backend)

To connect to the actual FastAPI backend and generate real PDFs:

### 1. Set Demo Mode to False

In `/src/app/App.tsx`, change:
```typescript
const DEMO_MODE = false;
```

### 2. Install Python Dependencies

```bash
pip install -r actual/requirements.txt
```

### 3. Add CORS Support to Backend

Edit `actual/back/fillable_processor.py` and add CORS middleware at the top:

```python
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware  # Add this import
from fastapi.responses import FileResponse
from pypdf import PdfReader

# ... existing imports ...

app = FastAPI()

# Add CORS middleware (add this right after app = FastAPI())
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ... rest of the code ...
```

### 4. Start the Backend Server

From the root directory of your project:

```bash
uvicorn actual.back.fillable_processor:app --reload --host 0.0.0.0 --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

### 5. Verify Backend is Running

Open http://localhost:8000/docs in your browser. You should see the FastAPI Swagger documentation with the following endpoints:
- `GET /api/templates` - List available templates
- `GET /api/templates/{template_id}/pdf-fields` - Get PDF fields
- `POST /api/render/{template_id}` - Render filled PDF

### 6. Test the Application

Now you can use the frontend to fill forms and generate real PDFs!

## Troubleshooting

### Error: "Cannot connect to the backend server"

1. Make sure the backend is running on port 8000
2. Check that CORS middleware is added to FastAPI
3. Verify the API_URL in App.tsx matches your backend URL

### Error: "ModuleNotFoundError"

Make sure all Python dependencies are installed:
```bash
pip install -r actual/requirements.txt
```

### CORS Issues

If you still see CORS errors, double-check that the CORS middleware is added correctly in `fillable_processor.py` before any route definitions.

## API Endpoints

### GET /api/templates
Returns a list of available form templates.

**Response:**
```json
{
  "templates": ["w9-2026", "w4-2026"]
}
```

### POST /api/render/{template_id}
Generates a filled PDF from the template.

**Request Body:**
```json
{
  "data": {
    "legal_name": "John Smith",
    "address": "123 Main St",
    "tin": "123-45-6789",
    ...
  }
}
```

**Response:**
Returns a PDF file (application/pdf)
