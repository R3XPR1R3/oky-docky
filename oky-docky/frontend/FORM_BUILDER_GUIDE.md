# 📋 Dynamic Form Builder Guide - Oki-Doki

## Overview

Oki-Doki uses a **100% backend-driven form system**. The frontend doesn't know anything about forms until the backend tells it what to render. This guide explains how to create and manage dynamic forms using JSON.

---

## 🏗️ Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Frontend  │ ──GET──▶│   FastAPI    │◀────────│  Database   │
│   (React)   │         │   Backend    │         │  (Forms)    │
└─────────────┘         └──────────────┘         └─────────────┘
      │                        │
      │   JSON Form Schema     │
      │◀───────────────────────│
      │                        │
      │   User Input Data      │
      │────────────────────────▶
      │                        │
      │   Generated PDF        │
      │◀───────────────────────│
```

---

## 📡 Required FastAPI Endpoints

### 1. **GET /api/documents**
List all available document templates.

**Response:**
```json
[
  {
    "id": "w9",
    "title": "IRS W-9 Tax Form",
    "description": "Request for Taxpayer Identification Number",
    "category": ["Tax", "Business"],
    "format": ["PDF", "Online"],
    "status": "available",
    "badge": "popular"
  }
]
```

### 2. **GET /api/forms/{form_id}**
Get the complete form definition with all fields and validation rules.

**Response:** See JSON Schema Format below

### 3. **POST /api/forms/{form_id}/submit**
Submit completed form data and generate document.

**Request:**
```json
{
  "formId": "w9",
  "formVersion": "1.0.0",
  "data": {
    "name": "John Doe",
    "address": "123 Main St",
    "ssn": "123-45-6789"
  }
}
```

**Response:**
```json
{
  "success": true,
  "submissionId": "SUB-123456789",
  "pdfUrl": "https://your-server.com/generated/SUB-123456789.pdf",
  "message": "Form submitted successfully!"
}
```

---

## 📝 JSON Form Schema Format

### Complete Example

```json
{
  "id": "w9",
  "title": "IRS W-9 Tax Form",
  "description": "Request for Taxpayer Identification Number and Certification",
  "version": "1.0.0",
  "metadata": {
    "category": ["Tax", "Business"],
    "format": ["PDF", "Online"],
    "estimatedTime": "10 minutes",
    "requiredDocuments": ["Social Security Number or EIN"]
  },
  "steps": [
    {
      "id": "step-1",
      "title": "Personal Information",
      "description": "Enter your personal details",
      "fields": [
        {
          "id": "name",
          "type": "text",
          "label": "Full Name",
          "placeholder": "John Doe",
          "helpText": "Enter your legal name",
          "validations": [
            {
              "type": "required",
              "message": "Name is required"
            },
            {
              "type": "minLength",
              "value": 2,
              "message": "Name must be at least 2 characters"
            }
          ]
        }
      ]
    }
  ]
}
```

---

## 🔧 Field Types

### Available Field Types

| Type | Description | Example Use Case |
|------|-------------|------------------|
| `text` | Single-line text input | Name, Address |
| `email` | Email input with validation | Email Address |
| `password` | Masked text input | SSN, Passwords |
| `number` | Numeric input | Age, Income |
| `textarea` | Multi-line text | Comments, Description |
| `select` | Dropdown selection | State, Country |
| `radio` | Single choice from options | Gender, Tax Status |
| `checkbox` | Boolean yes/no | Agreements, Certifications |
| `date` | Date picker | Birth Date, Signature Date |
| `file` | File upload | ID Documents, Attachments |

---

## 🎯 Field Configuration

### Basic Field Structure

```json
{
  "id": "fieldName",
  "type": "text",
  "label": "Display Label",
  "placeholder": "Hint text",
  "helpText": "Additional guidance",
  "defaultValue": "Optional default",
  "validations": [],
  "conditional": {},
  "grid": {}
}
```

### Field Properties Explained

#### **id** (required)
- Unique identifier for the field
- Used as the key in submitted data
- Example: `"id": "firstName"`

#### **type** (required)
- Field type from the list above
- Example: `"type": "email"`

#### **label** (required)
- Display text shown to user
- Example: `"label": "Email Address"`

#### **placeholder** (optional)
- Hint text inside empty field
- Example: `"placeholder": "john@example.com"`

#### **helpText** (optional)
- Additional guidance below field
- Example: `"helpText": "We'll never share your email"`

#### **defaultValue** (optional)
- Pre-filled value
- Example: `"defaultValue": "United States"`

---

## ✅ Validation Rules

### Available Validation Types

#### **required**
```json
{
  "type": "required",
  "message": "This field is required"
}
```

#### **minLength / maxLength**
```json
{
  "type": "minLength",
  "value": 5,
  "message": "Must be at least 5 characters"
}
```

#### **min / max** (for numbers)
```json
{
  "type": "min",
  "value": 18,
  "message": "Must be at least 18"
}
```

#### **pattern** (regex)
```json
{
  "type": "pattern",
  "value": "^\\d{5}$",
  "message": "ZIP code must be 5 digits"
}
```

#### **email**
```json
{
  "type": "email",
  "message": "Invalid email format"
}
```

### Example: Complex Validation

```json
{
  "id": "zipCode",
  "type": "text",
  "label": "ZIP Code",
  "validations": [
    {
      "type": "required",
      "message": "ZIP code is required"
    },
    {
      "type": "pattern",
      "value": "^\\d{5}(-\\d{4})?$",
      "message": "Must be 5 digits or 5+4 format (12345 or 12345-6789)"
    }
  ]
}
```

---

## 🔀 Conditional Logic

Show/hide fields based on other field values.

### Conditional Structure

```json
{
  "conditional": {
    "field": "fieldIdToWatch",
    "operator": "equals",
    "value": "expectedValue"
  }
}
```

### Available Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `equals` | Exact match | Show if status = "approved" |
| `notEquals` | Not equal | Show if type != "other" |
| `contains` | String contains | Show if name contains "LLC" |
| `greaterThan` | Number > value | Show if age > 18 |
| `lessThan` | Number < value | Show if income < 50000 |

### Example: Conditional Field

```json
{
  "id": "ein",
  "type": "text",
  "label": "Employer Identification Number",
  "conditional": {
    "field": "hasBusiness",
    "operator": "equals",
    "value": true
  },
  "validations": [
    {
      "type": "required",
      "message": "EIN is required for businesses"
    }
  ]
}
```

---

## 📐 Layout & Grid System

Control field layout with grid properties.

```json
{
  "id": "city",
  "type": "text",
  "label": "City",
  "grid": {
    "colSpan": 2
  }
}
```

**Grid System:**
- Default: 3 columns on desktop, 1 on mobile
- `colSpan: 1` - Takes 1/3 width
- `colSpan: 2` - Takes 2/3 width
- `colSpan: 3` - Takes full width

---

## 📊 Select, Radio, and Checkbox Options

### Select Dropdown

```json
{
  "id": "state",
  "type": "select",
  "label": "State",
  "options": [
    { "label": "California", "value": "CA" },
    { "label": "New York", "value": "NY" },
    { "label": "Texas", "value": "TX" }
  ]
}
```

### Radio Buttons

```json
{
  "id": "taxStatus",
  "type": "radio",
  "label": "Tax Filing Status",
  "options": [
    { "label": "Single", "value": "single" },
    { "label": "Married Filing Jointly", "value": "married-joint" },
    { "label": "Head of Household", "value": "head" }
  ]
}
```

### Checkbox (Boolean)

```json
{
  "id": "agreeToTerms",
  "type": "checkbox",
  "label": "I agree to the terms and conditions"
}
```

---

## 🚶 Multi-Step Forms

Forms are divided into steps for better UX.

### Step Structure

```json
{
  "steps": [
    {
      "id": "step-1",
      "title": "Personal Info",
      "description": "Tell us about yourself",
      "fields": [...]
    },
    {
      "id": "step-2",
      "title": "Business Info",
      "description": "Your business details",
      "fields": [...]
    },
    {
      "id": "step-3",
      "title": "Review",
      "description": "Confirm your information",
      "fields": [...]
    }
  ]
}
```

**Best Practices:**
- Keep each step to 5-8 fields max
- Group related fields together
- Always have a review/confirmation step
- Use clear, descriptive titles

---

## 💾 Complete Working Example

### Full W-9 Form Definition

```json
{
  "id": "w9",
  "title": "IRS W-9 Tax Form",
  "description": "Request for Taxpayer Identification Number and Certification",
  "version": "1.0.0",
  "metadata": {
    "category": ["Tax", "Business"],
    "format": ["PDF", "Online"],
    "estimatedTime": "10 minutes"
  },
  "steps": [
    {
      "id": "step-1",
      "title": "Personal Information",
      "description": "Enter your personal details",
      "fields": [
        {
          "id": "name",
          "type": "text",
          "label": "Full Name",
          "placeholder": "John Doe",
          "validations": [
            { "type": "required", "message": "Name is required" }
          ]
        },
        {
          "id": "businessName",
          "type": "text",
          "label": "Business Name (if different)",
          "placeholder": "Acme Corporation"
        },
        {
          "id": "address",
          "type": "text",
          "label": "Street Address",
          "validations": [
            { "type": "required", "message": "Address is required" }
          ]
        },
        {
          "id": "city",
          "type": "text",
          "label": "City",
          "grid": { "colSpan": 2 },
          "validations": [
            { "type": "required", "message": "City is required" }
          ]
        },
        {
          "id": "state",
          "type": "text",
          "label": "State",
          "grid": { "colSpan": 1 },
          "validations": [
            { "type": "required", "message": "State is required" },
            { "type": "maxLength", "value": 2, "message": "Use 2-letter code" }
          ]
        }
      ]
    },
    {
      "id": "step-2",
      "title": "Tax Information",
      "description": "Your tax classification",
      "fields": [
        {
          "id": "taxClassification",
          "type": "radio",
          "label": "Federal Tax Classification",
          "options": [
            { "label": "Individual / Sole Proprietor", "value": "individual" },
            { "label": "C Corporation", "value": "c-corp" },
            { "label": "S Corporation", "value": "s-corp" },
            { "label": "Partnership", "value": "partnership" },
            { "label": "LLC", "value": "llc" }
          ],
          "validations": [
            { "type": "required", "message": "Tax classification is required" }
          ]
        },
        {
          "id": "llcType",
          "type": "select",
          "label": "LLC Classification",
          "options": [
            { "label": "C Corporation", "value": "c" },
            { "label": "S Corporation", "value": "s" },
            { "label": "Partnership", "value": "p" }
          ],
          "conditional": {
            "field": "taxClassification",
            "operator": "equals",
            "value": "llc"
          },
          "validations": [
            { "type": "required", "message": "LLC type is required" }
          ]
        }
      ]
    },
    {
      "id": "step-3",
      "title": "Identification",
      "description": "Enter your taxpayer identification",
      "fields": [
        {
          "id": "tinType",
          "type": "radio",
          "label": "TIN Type",
          "options": [
            { "label": "Social Security Number", "value": "ssn" },
            { "label": "Employer Identification Number", "value": "ein" }
          ],
          "validations": [
            { "type": "required", "message": "TIN type is required" }
          ]
        },
        {
          "id": "ssn",
          "type": "password",
          "label": "Social Security Number",
          "placeholder": "XXX-XX-XXXX",
          "conditional": {
            "field": "tinType",
            "operator": "equals",
            "value": "ssn"
          },
          "validations": [
            { "type": "required", "message": "SSN is required" },
            { "type": "pattern", "value": "^\\d{3}-?\\d{2}-?\\d{4}$", "message": "Invalid SSN" }
          ]
        },
        {
          "id": "ein",
          "type": "text",
          "label": "Employer Identification Number",
          "placeholder": "XX-XXXXXXX",
          "conditional": {
            "field": "tinType",
            "operator": "equals",
            "value": "ein"
          },
          "validations": [
            { "type": "required", "message": "EIN is required" },
            { "type": "pattern", "value": "^\\d{2}-?\\d{7}$", "message": "Invalid EIN" }
          ]
        }
      ]
    },
    {
      "id": "step-4",
      "title": "Certification",
      "description": "Review and certify",
      "fields": [
        {
          "id": "certify",
          "type": "checkbox",
          "label": "I certify that the information provided is true and correct",
          "validations": [
            { "type": "required", "message": "You must certify to continue" }
          ]
        },
        {
          "id": "signatureDate",
          "type": "date",
          "label": "Date",
          "defaultValue": "2025-12-18",
          "validations": [
            { "type": "required", "message": "Date is required" }
          ]
        }
      ]
    }
  ]
}
```

---

## 🔌 FastAPI Implementation Example

### Python Backend Example

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json

app = FastAPI()

class FormDefinition(BaseModel):
    id: str
    title: str
    description: str
    version: str
    steps: List[Dict[str, Any]]
    metadata: Optional[Dict[str, Any]] = None

class FormSubmission(BaseModel):
    formId: str
    formVersion: str
    data: Dict[str, Any]

@app.get("/api/forms/{form_id}")
async def get_form_definition(form_id: str) -> FormDefinition:
    """
    Load form definition from database or JSON file
    """
    # In production: load from database
    # form = db.query(Form).filter(Form.id == form_id).first()
    
    # For now: load from JSON file
    try:
        with open(f"forms/{form_id}.json", "r") as f:
            form_data = json.load(f)
        return FormDefinition(**form_data)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Form not found")

@app.post("/api/forms/{form_id}/submit")
async def submit_form(form_id: str, submission: FormSubmission):
    """
    Process form submission and generate PDF
    """
    # 1. Validate data against form schema
    # 2. Store submission in database
    # 3. Generate PDF using template engine (ReportLab, WeasyPrint, etc.)
    # 4. Store PDF in cloud storage (S3, GCS, etc.)
    # 5. Return submission ID and PDF URL
    
    submission_id = f"SUB-{int(time.time())}"
    pdf_url = f"https://your-cdn.com/{submission_id}.pdf"
    
    return {
        "success": True,
        "submissionId": submission_id,
        "pdfUrl": pdf_url,
        "message": "Form submitted successfully!"
    }
```

---

## 🎨 Frontend Implementation

The frontend is already built! It:

1. **Fetches documents** from `GET /api/documents`
2. **Loads form definitions** from `GET /api/forms/{id}`
3. **Dynamically renders** all fields based on JSON
4. **Handles validation** using rules from JSON
5. **Shows/hides fields** based on conditional logic
6. **Submits data** to `POST /api/forms/{id}/submit`

**No frontend code changes needed when you add new forms!**

---

## ✨ Key Features

✅ **Dynamic Rendering** - Add forms without touching frontend code  
✅ **Conditional Logic** - Show/hide fields based on user input  
✅ **Validation** - Client-side validation from backend rules  
✅ **Multi-step Wizard** - Automatic progress tracking  
✅ **Responsive Layout** - Grid system for different screen sizes  
✅ **Type Safety** - TypeScript types for all schemas  

---

## 🚀 Quick Start Checklist

1. ✅ Set up FastAPI backend
2. ✅ Create `/api/forms/{id}` endpoint
3. ✅ Store form definitions in database or JSON files
4. ✅ Implement form submission endpoint
5. ✅ Set up PDF generation (ReportLab, WeasyPrint)
6. ✅ Configure cloud storage for PDFs
7. ✅ Update `API_BASE_URL` in `/src/app/api/mockApi.ts`
8. ✅ Test with one form
9. ✅ Add more forms by creating new JSON definitions

---

## 📚 Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [ReportLab (PDF Generation)](https://www.reportlab.com/)
- [Pydantic (Validation)](https://docs.pydantic.dev/)
- JSON Schema validation libraries

---

## 💡 Tips & Best Practices

### Form Design
- Keep forms short (max 20-30 fields)
- Break long forms into logical steps
- Use conditional logic to hide irrelevant fields
- Provide helpful text and examples

### Validation
- Always validate on backend (don't trust client)
- Use specific error messages
- Validate as user types (frontend) and on submit (backend)

### Performance
- Cache form definitions
- Lazy load large option lists
- Compress JSON responses
- Use CDN for generated PDFs

### Security
- Never store sensitive data in plain text
- Encrypt SSN/TIN fields in database
- Use HTTPS only
- Implement rate limiting on submissions
- Validate file uploads thoroughly

---

**Need help? Check `/src/app/types/form-schema.ts` for TypeScript types and `/src/app/api/mockApi.ts` for working examples!**
