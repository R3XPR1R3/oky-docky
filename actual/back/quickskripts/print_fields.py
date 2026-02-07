from pypdf import PdfReader

path = "actual/back/data/templates/w9-2026/w9-2026.pdf"
r = PdfReader(path)
fields = r.get_fields() or {}

for i, name in enumerate(fields.keys(), 1):
    print(f"{i:02d}. {name}")
