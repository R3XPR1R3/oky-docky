from pypdf import PdfReader

path = "actual/back/data/templates/w9-2026/w9-2026.pdf"
r = PdfReader(path)

root = r.trailer["/Root"]
acro = root.get("/AcroForm")
xfa = None
if acro:
    xfa = acro.get("/XFA")

print("Has /AcroForm:", bool(acro))
print("Has /XFA:", bool(xfa))

fields = r.get_fields() or {}
print("get_fields count:", len(fields))
print("first 10 field names:")
for i, k in enumerate(list(fields.keys())[:10]):
    print(" ", i+1, k)
