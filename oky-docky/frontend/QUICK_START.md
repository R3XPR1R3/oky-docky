# 🚀 Quick Start Guide - Oki-Doki Backend Integration

## What Changed?

The entire application is now **100% backend-driven**. The frontend doesn't know about any forms until the backend tells it what to render.

## How It Works

```
User clicks "Fill Out" 
    ↓
Frontend calls: GET /api/forms/{formId}
    ↓
Backend returns JSON with all fields, validations, conditional logic
    ↓
Frontend dynamically renders the form
    ↓
User fills out form
    ↓
Frontend calls: POST /api/forms/{formId}/submit
    ↓
Backend generates PDF and returns URL
```

---

## 📁 File Structure

```
/src/app/
├── api/
│   └── mockApi.ts           ← Replace mock functions with real API calls
├── types/
│   └── form-schema.ts       ← TypeScript types for forms
├── components/
│   ├── DynamicFormWizard.tsx  ← Renders any form from JSON
│   ├── DynamicField.tsx       ← Renders individual fields
│   └── ...
└── App.tsx                   ← Main app with backend integration
```

---

## 🔧 Setup Steps

### 1. Update API Base URL

In `/src/app/api/mockApi.ts`, update line 18:

```typescript
const API_BASE_URL = 'http://localhost:8000/api'; // Change to your FastAPI URL
```

### 2. Replace Mock Functions with Real API Calls

Find these functions in `mockApi.ts` and uncomment the real fetch calls:

```typescript
// Example: fetchDocuments()
export async function fetchDocuments(): Promise<Document[]> {
  const response = await fetch(`${API_BASE_URL}/documents`);
  return response.json();
}

// Example: fetchFormDefinition()
export async function fetchFormDefinition(formId: string): Promise<FormDefinition> {
  const response = await fetch(`${API_BASE_URL}/forms/${formId}`);
  return response.json();
}

// Example: submitForm()
export async function submitForm(formId: string, data: Record<string, any>) {
  const response = await fetch(`${API_BASE_URL}/forms/${formId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return response.json();
}
```

---

## 🎯 Required FastAPI Endpoints

### 1. List Documents
```python
@app.get("/api/documents")
async def get_documents():
    return [
        {
            "id": "w9",
            "title": "IRS W-9 Tax Form",
            "description": "Request for Taxpayer ID",
            "category": ["Tax", "Business"],
            "format": ["PDF", "Online"],
            "status": "available",
            "badge": "popular"
        }
    ]
```

### 2. Get Form Definition
```python
@app.get("/api/forms/{form_id}")
async def get_form(form_id: str):
    # Load from database or JSON file
    form = load_form_definition(form_id)
    return form
```

### 3. Submit Form
```python
@app.post("/api/forms/{form_id}/submit")
async def submit_form(form_id: str, data: dict):
    # Validate, generate PDF, store, return URL
    submission_id = save_submission(form_id, data)
    pdf_url = generate_pdf(form_id, data)
    
    return {
        "success": True,
        "submissionId": submission_id,
        "pdfUrl": pdf_url,
        "message": "Form submitted successfully!"
    }
```

---

## 📝 Creating a New Form

### Option 1: Store in Database

Create a forms table:
```sql
CREATE TABLE forms (
    id VARCHAR PRIMARY KEY,
    title VARCHAR,
    description VARCHAR,
    version VARCHAR,
    definition JSONB  -- Stores the entire form schema
);
```

### Option 2: Store as JSON Files

Create `forms/w9.json`:
```json
{
  "id": "w9",
  "title": "IRS W-9 Tax Form",
  "version": "1.0.0",
  "steps": [
    {
      "id": "step-1",
      "title": "Personal Info",
      "fields": [
        {
          "id": "name",
          "type": "text",
          "label": "Full Name",
          "validations": [
            { "type": "required", "message": "Name is required" }
          ]
        }
      ]
    }
  ]
}
```

---

## 🧪 Testing

### Test with Mock Data (Current Setup)

The app currently uses mock data. You can test it right now:

1. Click "Fill Out" on W-9 or I-9
2. See dynamic form load from JSON
3. Fill out fields with conditional logic
4. Submit (will show success toast)

### Test with Real Backend

1. Start your FastAPI backend
2. Update `API_BASE_URL` in `mockApi.ts`
3. Uncomment real fetch calls
4. Test end-to-end

---

## 💡 Form Examples in Mock Data

The app includes 2 complete example forms:

1. **IRS W-9** (`id: "w9"`)
   - 4 steps with validation
   - Conditional fields (LLC classification)
   - SSN/EIN toggle with conditional inputs
   - Certification checkboxes

2. **Form I-9** (`id: "i9"`)
   - 3 steps
   - Conditional USCIS fields
   - Date pickers
   - Email validation

Look at `/src/app/api/mockApi.ts` (line 140+) to see full JSON structure.

---

## 🎨 Supported Field Types

| Type | Description | Props |
|------|-------------|-------|
| `text` | Single-line input | placeholder, helpText |
| `email` | Email input | auto email validation |
| `password` | Masked input | for SSN, passwords |
| `number` | Numeric input | min, max validation |
| `textarea` | Multi-line text | rows |
| `select` | Dropdown | options: [{label, value}] |
| `radio` | Radio buttons | options: [{label, value}] |
| `checkbox` | Yes/No toggle | boolean value |
| `date` | Date picker | defaultValue |
| `file` | File upload | file object |

---

## ✅ Validation Types

```json
{
  "validations": [
    { "type": "required", "message": "Field is required" },
    { "type": "minLength", "value": 5, "message": "Min 5 chars" },
    { "type": "maxLength", "value": 50, "message": "Max 50 chars" },
    { "type": "pattern", "value": "^\\d{5}$", "message": "5 digits" },
    { "type": "min", "value": 18, "message": "Must be 18+" },
    { "type": "max", "value": 100, "message": "Max 100" },
    { "type": "email", "message": "Invalid email" }
  ]
}
```

---

## 🔀 Conditional Logic

Show/hide fields based on other field values:

```json
{
  "id": "ein",
  "type": "text",
  "label": "EIN",
  "conditional": {
    "field": "hasBusiness",    // Watch this field
    "operator": "equals",       // equals | notEquals | contains | greaterThan | lessThan
    "value": true               // Expected value
  }
}
```

---

## 📐 Layout Control

Control field width with grid system:

```json
{
  "id": "city",
  "type": "text",
  "label": "City",
  "grid": {
    "colSpan": 2  // 1, 2, or 3 (default 3 = full width)
  }
}
```

---

## 🐛 Debugging

### Check Browser Console

```javascript
console.log('Form data for preview:', formData);
console.log('PDF URL:', result.pdfUrl);
```

### Test API Endpoints

```bash
# List documents
curl http://localhost:8000/api/documents

# Get form
curl http://localhost:8000/api/forms/w9

# Submit form
curl -X POST http://localhost:8000/api/forms/w9/submit \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","ssn":"123-45-6789"}'
```

---

## 📚 Full Documentation

See `/FORM_BUILDER_GUIDE.md` for complete documentation including:
- Detailed JSON schema format
- All validation rules
- Advanced conditional logic
- Python/FastAPI examples
- Security best practices

---

## ❓ FAQ

**Q: Do I need to modify frontend code to add new forms?**  
A: No! Just add the JSON to your backend. Frontend will automatically render it.

**Q: Can I reuse fields across forms?**  
A: Yes! Store common field definitions in your database and compose forms.

**Q: How do I add custom validation?**  
A: Add validation rules to the JSON. Frontend handles standard ones, backend does server-side validation.

**Q: What about file uploads?**  
A: Use `type: "file"`. Handle multipart/form-data on backend.

**Q: Can forms have multiple pages/steps?**  
A: Yes! Add more steps to the `steps` array. Each step is a separate page.

---

## ✨ Next Steps

1. ✅ Test the app with current mock data
2. ✅ Build your FastAPI backend
3. ✅ Create form JSON definitions
4. ✅ Update API_BASE_URL
5. ✅ Replace mock functions with real API calls
6. ✅ Test end-to-end
7. ✅ Add more forms as JSON!

**That's it! Your frontend is ready to accept any form you throw at it. 🎉**
