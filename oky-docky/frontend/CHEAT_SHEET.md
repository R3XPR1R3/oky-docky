# ⚡ Oki-Doki Cheat Sheet

## 🚀 Quick Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

---

## 📡 Required API Endpoints

```
GET  /api/documents          # List all documents
GET  /api/forms/{id}          # Get form definition
POST /api/forms/{id}/submit  # Submit completed form
```

---

## 📝 Minimal Form JSON

```json
{
  "id": "form-id",
  "title": "Form Title",
  "version": "1.0.0",
  "steps": [
    {
      "id": "step-1",
      "title": "Step Title",
      "fields": [
        {
          "id": "fieldId",
          "type": "text",
          "label": "Label",
          "validations": [
            { "type": "required", "message": "Required" }
          ]
        }
      ]
    }
  ]
}
```

---

## 🎨 Field Types

```
text      password    number     textarea
email     select      radio      checkbox
date      file
```

---

## ✅ Validation Types

```javascript
{ type: "required", message: "..." }
{ type: "minLength", value: 5, message: "..." }
{ type: "maxLength", value: 50, message: "..." }
{ type: "pattern", value: "^\\d{5}$", message: "..." }
{ type: "min", value: 18, message: "..." }
{ type: "max", value: 100, message: "..." }
{ type: "email", message: "..." }
```

---

## 🔀 Conditional Logic

```javascript
{
  "conditional": {
    "field": "otherFieldId",
    "operator": "equals",      // equals | notEquals | contains | greaterThan | lessThan
    "value": true
  }
}
```

---

## 📐 Grid Layout

```javascript
{ "grid": { "colSpan": 1 } }  // 1/3 width
{ "grid": { "colSpan": 2 } }  // 2/3 width
{ "grid": { "colSpan": 3 } }  // Full width (default)
```

---

## 🔧 Update API URL

```typescript
// /src/app/api/mockApi.ts (line 18)
const API_BASE_URL = 'http://localhost:8000/api';
```

---

## 📦 Example Select Field

```json
{
  "id": "country",
  "type": "select",
  "label": "Country",
  "options": [
    { "label": "USA", "value": "us" },
    { "label": "Canada", "value": "ca" }
  ],
  "validations": [
    { "type": "required", "message": "Required" }
  ]
}
```

---

## 📦 Example Radio Field

```json
{
  "id": "status",
  "type": "radio",
  "label": "Choose one",
  "options": [
    { "label": "Option A", "value": "a" },
    { "label": "Option B", "value": "b" }
  ]
}
```

---

## 📦 Example Conditional Field

```json
{
  "id": "hasLicense",
  "type": "checkbox",
  "label": "I have a license"
},
{
  "id": "licenseNumber",
  "type": "text",
  "label": "License Number",
  "conditional": {
    "field": "hasLicense",
    "operator": "equals",
    "value": true
  }
}
```

---

## 🐍 FastAPI Example

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

@app.get("/api/documents")
async def get_documents():
    return [{
        "id": "w9",
        "title": "W-9 Form",
        "category": ["Tax"],
        "format": ["PDF"],
        "status": "available"
    }]

@app.get("/api/forms/{form_id}")
async def get_form(form_id: str):
    # Load from DB or file
    return load_form_json(form_id)

@app.post("/api/forms/{form_id}/submit")
async def submit_form(form_id: str, data: dict):
    # Process and generate PDF
    pdf_url = generate_pdf(form_id, data)
    return {
        "success": True,
        "pdfUrl": pdf_url,
        "message": "Form submitted!"
    }
```

---

## 📁 Key Files

```
/src/app/api/mockApi.ts          ← UPDATE THIS!
/src/app/types/form-schema.ts    ← TypeScript types
/form-template.json               ← Blank template
/FORM_BUILDER_GUIDE.md           ← Full docs
/QUICK_START.md                   ← Setup guide
```

---

## 🧪 Test Forms

```
W-9  (id: "w9")   - 4 steps, conditional logic
I-9  (id: "i9")   - 3 steps, employment form
```

---

## 🎯 Adding New Form (3 Steps)

1. Create JSON (use template)
2. Add to backend (DB or file)
3. Add to document list

**Done!** Frontend auto-renders.

---

## 🔍 Debugging

```javascript
// Check form data
console.log('Form data:', formData);

// Check field visibility
console.log('Condition result:', evaluateConditional(field.conditional));

// Check validation
console.log('Validation error:', validateField(field, value));
```

---

## 📊 Form Submission Data

```json
POST /api/forms/w9/submit
{
  "formId": "w9",
  "formVersion": "1.0.0",
  "data": {
    "name": "John Doe",
    "email": "john@example.com",
    "ssn": "123-45-6789"
  }
}
```

---

## ✨ Quick Tips

- Keep forms under 30 fields
- Break into 3-5 steps max
- Use conditional logic liberally
- Always end with review step
- Validate client + server side
- Use clear error messages
- Test on mobile
- Cache form definitions

---

## 🐛 Common Issues

**Forms not loading?**
→ Check API_BASE_URL

**Validation not working?**
→ Check validations array

**Field not showing?**
→ Check conditional rule

**Can't submit?**
→ Check required fields

---

## 📚 Full Docs

- README.md - Overview
- QUICK_START.md - Setup
- FORM_BUILDER_GUIDE.md - Complete reference
- JSON_SCHEMA_VISUAL.md - Visual guide
- IMPLEMENTATION_SUMMARY.md - What was built

---

## 💡 Remember

✅ Frontend doesn't know about forms  
✅ Everything loaded from backend  
✅ Add forms without code changes  
✅ JSON defines everything  

---

**That's all you need to get started! 🎉**
