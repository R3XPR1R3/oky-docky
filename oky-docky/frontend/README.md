# Oki-Doki Smart Document Builder

A beautiful, backend-driven document catalog and form builder that makes legal and tax forms feel less intimidating.

## 🎯 Key Features

✅ **100% Backend-Driven** - Add new forms without touching frontend code  
✅ **Dynamic Forms** - All forms loaded from JSON/API responses  
✅ **Conditional Logic** - Show/hide fields based on user input  
✅ **Smart Validation** - Client-side and server-side validation  
✅ **Multi-step Wizards** - Automatic progress tracking  
✅ **Skeuomorphic Design** - Paper-like textures and realistic elements  
✅ **Responsive Layout** - Works on desktop and mobile  
✅ **Real-time Search & Filters** - Find documents quickly  
✅ **Favorites System** - Save frequently used forms  

## 📸 What You Get

- **Document Catalog** - Browse all available forms with search and filters
- **Dynamic Form Wizard** - Multi-step forms that adapt based on user input
- **Conditional Fields** - Fields appear/disappear based on answers
- **Validation** - Real-time field validation with helpful error messages
- **Progress Tracking** - Visual progress indicator shows completion status
- **Review Step** - Always includes a final review before submission

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Development Server

```bash
npm run dev
```

### 3. Test with Mock Data

The app runs with mock data out of the box. You can:
- Browse 6 sample documents
- Fill out the W-9 or I-9 forms
- See conditional logic in action
- Test all field types and validation

### 4. Connect to Your Backend

See [QUICK_START.md](./QUICK_START.md) for backend integration steps.

## 📚 Documentation

- **[QUICK_START.md](./QUICK_START.md)** - Fast setup and integration guide
- **[FORM_BUILDER_GUIDE.md](./FORM_BUILDER_GUIDE.md)** - Complete JSON schema documentation
- **[form-template.json](./form-template.json)** - Template for creating new forms

## 🏗️ Architecture

```
Frontend (React + TypeScript)
    ↓ GET /api/documents
Backend (FastAPI)
    ↓ Returns list of forms
Frontend displays catalog
    ↓ User clicks "Fill Out"
    ↓ GET /api/forms/{id}
Backend returns form JSON
    ↓ Complete field definitions
Frontend renders form dynamically
    ↓ User fills out form
    ↓ POST /api/forms/{id}/submit
Backend processes & generates PDF
    ↓ Returns PDF URL
Frontend shows success + download link
```

## 📋 Form JSON Structure

```json
{
  "id": "w9",
  "title": "IRS W-9 Tax Form",
  "version": "1.0.0",
  "steps": [
    {
      "id": "step-1",
      "title": "Personal Information",
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

## 🎨 Supported Field Types

- `text` - Single-line text input
- `email` - Email with validation
- `password` - Masked input (SSN, passwords)
- `number` - Numeric input with min/max
- `textarea` - Multi-line text
- `select` - Dropdown menu
- `radio` - Radio button group
- `checkbox` - Boolean toggle
- `date` - Date picker
- `file` - File upload

## ✅ Validation Types

- `required` - Field must have value
- `minLength` / `maxLength` - String length
- `min` / `max` - Numeric range
- `pattern` - Regex validation
- `email` - Email format validation

## 🔀 Conditional Logic

Fields can appear/disappear based on other field values:

```json
{
  "id": "ein",
  "type": "text",
  "label": "EIN",
  "conditional": {
    "field": "hasBusiness",
    "operator": "equals",
    "value": true
  }
}
```

**Operators:** `equals`, `notEquals`, `contains`, `greaterThan`, `lessThan`

## 🛠️ Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Radix UI** - Accessible components
- **Lucide React** - Icons
- **Vite** - Build tool

## 📁 Project Structure

```
/src/app/
├── api/
│   └── mockApi.ts              ← API integration (update this!)
├── types/
│   └── form-schema.ts          ← TypeScript types
├── data/
│   └── documents.ts            ← Mock document list (removed in prod)
├── components/
│   ├── Header.tsx              ← App header with search
│   ├── FilterSidebar.tsx       ← Category/format filters
│   ├── DocumentCatalog.tsx     ← Document grid display
│   ├── DocumentCard.tsx        ← Individual document card
│   ├── DynamicFormWizard.tsx   ← Multi-step form renderer
│   ├── DynamicField.tsx        ← Field renderer (text, select, etc)
│   └── ui/                     ← Reusable UI components
└── App.tsx                     ← Main app component
```

## 🔧 Backend Requirements

Your FastAPI backend needs these endpoints:

### 1. List Documents
```
GET /api/documents
Returns: Array of document metadata
```

### 2. Get Form Definition
```
GET /api/forms/{form_id}
Returns: Complete form JSON with all fields
```

### 3. Submit Form
```
POST /api/forms/{form_id}/submit
Body: { formId, formVersion, data }
Returns: { success, submissionId, pdfUrl }
```

See [FORM_BUILDER_GUIDE.md](./FORM_BUILDER_GUIDE.md) for Python examples.

## 🎓 Creating Your First Form

1. **Define the form in JSON** (use `form-template.json` as starter)
2. **Store in your backend** (database or JSON file)
3. **Add to document list** (return from `/api/documents`)
4. **Test!** Frontend will automatically render it

**That's it!** No frontend code changes needed.

## 🧪 Example Forms Included

The app includes 2 complete working examples:

### IRS W-9 Tax Form
- 4 steps: Personal Info → Tax Classification → Identification → Certification
- Conditional fields (LLC type, SSN vs EIN)
- Pattern validation (ZIP, SSN, EIN)
- Checkboxes for certification

### Form I-9 (Employment Eligibility)
- 3 steps: Employee Info → Citizenship Status → Attestation
- Conditional USCIS fields
- Email validation
- Date fields

Both are fully functional with the mock API!

## 💡 Tips for Success

### Form Design
- Keep forms under 30 fields total
- Break into 3-5 logical steps
- Use conditional logic to hide irrelevant fields
- Always end with a review/certification step

### Validation
- Validate on frontend (UX) and backend (security)
- Provide clear, helpful error messages
- Use regex patterns for formats (ZIP, SSN, etc)

### Performance
- Cache form definitions
- Lazy load large option lists
- Use CDN for generated PDFs

### Security
- Encrypt sensitive data (SSN, etc)
- Validate file uploads thoroughly
- Use HTTPS only
- Implement rate limiting

## 🤝 Integration Checklist

- [ ] Set up FastAPI backend
- [ ] Create database/storage for forms
- [ ] Implement `/api/documents` endpoint
- [ ] Implement `/api/forms/{id}` endpoint
- [ ] Implement `/api/forms/{id}/submit` endpoint
- [ ] Set up PDF generation (ReportLab, WeasyPrint)
- [ ] Configure cloud storage for PDFs
- [ ] Update `API_BASE_URL` in `mockApi.ts`
- [ ] Replace mock functions with real fetch calls
- [ ] Test end-to-end
- [ ] Add your first custom form!

## 🐛 Troubleshooting

**Forms not loading?**
- Check `API_BASE_URL` in `/src/app/api/mockApi.ts`
- Verify backend is running
- Check browser console for errors

**Validation not working?**
- Check field `validations` array in JSON
- Verify `type` matches available validators
- Check conditional logic (`conditional` object)

**Fields not showing?**
- Check `conditional` rules
- Verify watched field has correct value
- Check operator type (`equals`, `notEquals`, etc)

## 📄 License

MIT License - Feel free to use this in your projects!

## 🙋 Need Help?

1. Check the [FORM_BUILDER_GUIDE.md](./FORM_BUILDER_GUIDE.md)
2. Look at example forms in `/src/app/api/mockApi.ts`
3. Use the [form-template.json](./form-template.json) as starter

---

**Built with ❤️ for making legal forms less scary**
