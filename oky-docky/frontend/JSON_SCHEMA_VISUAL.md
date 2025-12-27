# 📐 Visual JSON Schema Reference

## Complete Form Structure

```
FormDefinition
├── id: string                    "w9"
├── title: string                 "IRS W-9 Tax Form"
├── description: string           "Request for Taxpayer ID..."
├── version: string               "1.0.0"
├── metadata (optional)
│   ├── category: string[]        ["Tax", "Business"]
│   ├── format: string[]          ["PDF", "Online"]
│   ├── estimatedTime: string     "10 minutes"
│   └── requiredDocuments: string[] ["SSN or EIN"]
│
└── steps: FormStep[]
    └── FormStep
        ├── id: string            "step-1"
        ├── title: string         "Personal Information"
        ├── description: string   "Enter your personal details"
        │
        └── fields: FormField[]
            └── FormField
                ├── id: string                "name"
                ├── type: FieldType           "text"
                ├── label: string             "Full Name"
                ├── placeholder?: string      "John Doe"
                ├── helpText?: string         "Enter legal name"
                ├── defaultValue?: any        "Default Value"
                │
                ├── options?: FieldOption[]   (for select/radio)
                │   └── FieldOption
                │       ├── label: string     "Option 1"
                │       └── value: string     "option1"
                │
                ├── validations?: ValidationRule[]
                │   └── ValidationRule
                │       ├── type: string      "required"
                │       ├── value?: any       5
                │       └── message: string   "This is required"
                │
                ├── conditional?: ConditionalRule
                │   ├── field: string         "otherFieldId"
                │   ├── operator: string      "equals"
                │   └── value: any            true
                │
                └── grid?: GridConfig
                    └── colSpan?: 1|2|3       2
```

---

## Field Type Options

```
┌─────────────┬──────────────────────────────────────┐
│  FieldType  │  Description                         │
├─────────────┼──────────────────────────────────────┤
│  text       │  Single-line text input              │
│  email      │  Email with validation               │
│  password   │  Masked text input                   │
│  number     │  Numeric input                       │
│  textarea   │  Multi-line text                     │
│  select     │  Dropdown menu (requires options)    │
│  radio      │  Radio buttons (requires options)    │
│  checkbox   │  Boolean yes/no                      │
│  date       │  Date picker                         │
│  file       │  File upload                         │
└─────────────┴──────────────────────────────────────┘
```

---

## Validation Rules

```
┌──────────────┬─────────────┬───────────────────────────────┐
│  Type        │  Value Type │  Example                      │
├──────────────┼─────────────┼───────────────────────────────┤
│  required    │  -          │  { type: "required" }         │
│  minLength   │  number     │  { type: "minLength", value: 5 }│
│  maxLength   │  number     │  { type: "maxLength", value: 50 }│
│  pattern     │  regex      │  { type: "pattern", value: "^\\d{5}$" }│
│  min         │  number     │  { type: "min", value: 18 }   │
│  max         │  number     │  { type: "max", value: 100 }  │
│  email       │  -          │  { type: "email" }            │
└──────────────┴─────────────┴───────────────────────────────┘
```

---

## Conditional Operators

```
┌──────────────┬──────────────────────────────────────────┐
│  Operator    │  When Field is Shown                     │
├──────────────┼──────────────────────────────────────────┤
│  equals      │  watchedField === value                  │
│  notEquals   │  watchedField !== value                  │
│  contains    │  watchedField.includes(value)            │
│  greaterThan │  Number(watchedField) > Number(value)    │
│  lessThan    │  Number(watchedField) < Number(value)    │
└──────────────┴──────────────────────────────────────────┘
```

---

## Complete Minimal Example

```json
{
  "id": "simple-form",
  "title": "Simple Form",
  "description": "A basic form example",
  "version": "1.0.0",
  "steps": [
    {
      "id": "step-1",
      "title": "Information",
      "description": "Please fill out",
      "fields": [
        {
          "id": "name",
          "type": "text",
          "label": "Name",
          "validations": [
            {
              "type": "required",
              "message": "Name is required"
            }
          ]
        }
      ]
    }
  ]
}
```

---

## Complete Complex Example

```json
{
  "id": "complex-form",
  "title": "Complex Form Example",
  "description": "Shows all features",
  "version": "1.0.0",
  "metadata": {
    "category": ["Business"],
    "format": ["PDF"],
    "estimatedTime": "15 minutes"
  },
  "steps": [
    {
      "id": "step-1",
      "title": "Personal Info",
      "description": "Your information",
      "fields": [
        {
          "id": "fullName",
          "type": "text",
          "label": "Full Name",
          "placeholder": "John Doe",
          "helpText": "Enter your legal name",
          "validations": [
            { "type": "required", "message": "Name is required" },
            { "type": "minLength", "value": 2, "message": "Min 2 chars" }
          ]
        },
        {
          "id": "email",
          "type": "email",
          "label": "Email Address",
          "placeholder": "you@example.com",
          "validations": [
            { "type": "required", "message": "Email required" },
            { "type": "email", "message": "Invalid email" }
          ]
        },
        {
          "id": "age",
          "type": "number",
          "label": "Age",
          "grid": { "colSpan": 1 },
          "validations": [
            { "type": "required", "message": "Age required" },
            { "type": "min", "value": 18, "message": "Must be 18+" }
          ]
        },
        {
          "id": "city",
          "type": "text",
          "label": "City",
          "grid": { "colSpan": 2 }
        }
      ]
    },
    {
      "id": "step-2",
      "title": "Additional Info",
      "description": "Optional details",
      "fields": [
        {
          "id": "country",
          "type": "select",
          "label": "Country",
          "options": [
            { "label": "United States", "value": "us" },
            { "label": "Canada", "value": "ca" },
            { "label": "United Kingdom", "value": "uk" }
          ],
          "validations": [
            { "type": "required", "message": "Select a country" }
          ]
        },
        {
          "id": "hasPassport",
          "type": "checkbox",
          "label": "I have a valid passport"
        },
        {
          "id": "passportNumber",
          "type": "text",
          "label": "Passport Number",
          "conditional": {
            "field": "hasPassport",
            "operator": "equals",
            "value": true
          },
          "validations": [
            { "type": "required", "message": "Passport number required" }
          ]
        },
        {
          "id": "travelPurpose",
          "type": "radio",
          "label": "Purpose of Travel",
          "options": [
            { "label": "Business", "value": "business" },
            { "label": "Tourism", "value": "tourism" },
            { "label": "Education", "value": "education" }
          ],
          "conditional": {
            "field": "hasPassport",
            "operator": "equals",
            "value": true
          }
        }
      ]
    },
    {
      "id": "step-3",
      "title": "Review & Submit",
      "description": "Confirm your information",
      "fields": [
        {
          "id": "comments",
          "type": "textarea",
          "label": "Additional Comments",
          "placeholder": "Optional comments...",
          "helpText": "Max 500 characters",
          "validations": [
            { "type": "maxLength", "value": 500, "message": "Max 500 chars" }
          ]
        },
        {
          "id": "certify",
          "type": "checkbox",
          "label": "I certify that all information is accurate",
          "validations": [
            { "type": "required", "message": "You must certify" }
          ]
        },
        {
          "id": "signatureDate",
          "type": "date",
          "label": "Date",
          "defaultValue": "2025-12-18",
          "validations": [
            { "type": "required", "message": "Date required" }
          ]
        }
      ]
    }
  ]
}
```

---

## Grid Layout Examples

```
┌─────────────────────────────────────────────────┐
│  colSpan: 3 (default - full width)             │
├─────────────────────────────────────────────────┤
│  Field takes entire row                         │
└─────────────────────────────────────────────────┘

┌───────────────────┬─────────────────────────────┐
│  colSpan: 1       │  colSpan: 2                 │
├───────────────────┼─────────────────────────────┤
│  1/3 width        │  2/3 width                  │
└───────────────────┴─────────────────────────────┘

┌─────────────┬─────────────┬───────────────────┐
│  colSpan: 1 │  colSpan: 1 │  colSpan: 1       │
├─────────────┼─────────────┼───────────────────┤
│  1/3 width  │  1/3 width  │  1/3 width        │
└─────────────┴─────────────┴───────────────────┘
```

---

## Conditional Logic Flow

```
User fills "hasPassport" checkbox
         ↓
  hasPassport = true
         ↓
Frontend checks all fields with conditional:
  {
    "conditional": {
      "field": "hasPassport",
      "operator": "equals",
      "value": true
    }
  }
         ↓
  Condition matches!
         ↓
  Field becomes visible
         ↓
User can now fill passport fields
```

---

## Validation Flow

```
User types in field
         ↓
Frontend checks validations array:
  [
    { "type": "required" },
    { "type": "minLength", "value": 5 }
  ]
         ↓
  1. Check required: ✅ Has value
  2. Check minLength: ❌ Only 3 chars
         ↓
Show error: "Min 5 characters"
         ↓
User types more...
         ↓
  Length now 5+ ✅
         ↓
Error disappears
```

---

## API Response Flow

```
GET /api/forms/w9

Response:
{
  "id": "w9",
  "title": "IRS W-9 Tax Form",
  "steps": [ ... ]
}
         ↓
Frontend receives JSON
         ↓
DynamicFormWizard renders:
  - Progress bar (from steps array)
  - Current step fields
  - Navigation buttons
         ↓
User fills form
         ↓
POST /api/forms/w9/submit
Body: { formId: "w9", data: {...} }
         ↓
Backend validates & generates PDF
         ↓
Response: { success: true, pdfUrl: "..." }
```

---

## Field Rendering Logic

```
For each field in current step:

1. Check if conditional exists
   ├─ YES → Evaluate condition
   │   ├─ TRUE → Show field
   │   └─ FALSE → Hide field
   └─ NO → Always show field

2. Render based on type:
   ├─ text → <Input type="text" />
   ├─ email → <Input type="email" />
   ├─ select → <Select><SelectItem /></Select>
   ├─ radio → <RadioGroup><RadioItem /></RadioGroup>
   └─ ... etc

3. Apply grid layout:
   └─ colSpan → CSS class

4. Add validation:
   └─ Show error if validation fails

5. Connect to form state:
   ├─ value={formData[field.id]}
   └─ onChange={(v) => setFormData(...)}
```

---

## Quick Reference Card

```
┌────────────────────────────────────────────────────┐
│  FIELD DEFINITION                                  │
├────────────────────────────────────────────────────┤
│  {                                                 │
│    "id": "fieldName",           ← Unique ID        │
│    "type": "text",              ← Field type       │
│    "label": "Display Label",    ← Shown to user    │
│    "placeholder": "hint",       ← Optional hint    │
│    "helpText": "help",          ← Optional help    │
│    "defaultValue": "default",   ← Pre-filled       │
│    "validations": [...],        ← Rules            │
│    "conditional": {...},        ← Show/hide        │
│    "grid": { "colSpan": 2 }    ← Width            │
│  }                                                 │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│  VALIDATION RULE                                   │
├────────────────────────────────────────────────────┤
│  {                                                 │
│    "type": "required",          ← Rule type        │
│    "value": 5,                  ← Optional value   │
│    "message": "Error text"      ← Error message    │
│  }                                                 │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│  CONDITIONAL RULE                                  │
├────────────────────────────────────────────────────┤
│  {                                                 │
│    "field": "otherFieldId",     ← Field to watch   │
│    "operator": "equals",        ← Comparison       │
│    "value": true                ← Expected value   │
│  }                                                 │
└────────────────────────────────────────────────────┘
```

---

**Use this as a quick reference when building forms!** 📋
