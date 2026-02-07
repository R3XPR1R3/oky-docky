from pathlib import Path
from pypdf import PdfReader
from pypdf.generic import IndirectObject

def deref(obj):
    return obj.get_object() if isinstance(obj, IndirectObject) else obj

PDF = "actual/back/data/templates/w9-2026/w9-2026.pdf"
r = PdfReader(PDF)

# найдём ВСЕ текстовые виджеты (/Tx) и посмотрим, какие похожи на TIN
tx = []
for pi, page in enumerate(r.pages):
    annots = deref(page.get("/Annots")) or []
    for a in annots:
        annot = deref(a)
        if not isinstance(annot, dict) or annot.get("/Subtype") != "/Widget":
            continue

        parent = deref(annot.get("/Parent"))
        FT = annot.get("/FT") or (parent.get("/FT") if isinstance(parent, dict) else None)
        if FT != "/Tx":
            continue

        T = annot.get("/T")
        if T is None and isinstance(parent, dict):
            T = parent.get("/T")

        if not T:
            continue

        name = str(T)
        tx.append((pi + 1, name))

print("TX widgets:", len(tx))
for p, name in tx:
    if "tin" in name.lower() or "ssn" in name.lower() or "ein" in name.lower() or "f1_" in name:
        print(f"p{p}  {name}")
