# pdf_registry.py
PDF_FORMS = {
    "w4_2026": {
        "path": "storage/pdf/fw42026.pdf",
        "title": "IRS W-4 (2026)"
    }
}

def get_pdf_form(form_id: str) -> dict:
    if form_id not in PDF_FORMS:
        raise KeyError("PDF form not found")
    return PDF_FORMS[form_id]
