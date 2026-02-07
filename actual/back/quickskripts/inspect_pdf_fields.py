from pathlib import Path
from pypdf import PdfReader
from pypdf.generic import IndirectObject

def deref(obj):
    return obj.get_object() if isinstance(obj, IndirectObject) else obj

ROOT = Path(__file__).resolve().parents[2]  # actual/back
PDF = ROOT /"back" / "data" / "templates" / "w9-2026.pdf"

reader = PdfReader(str(PDF))

print("Scanning widgets (/Annots -> /Widget) ...\n")

found = 0
for pi, page in enumerate(reader.pages):
    annots = deref(page.get("/Annots")) or []
    for a in annots:
        annot = deref(a)
        if not isinstance(annot, dict):
            continue
        if annot.get("/Subtype") != "/Widget":
            continue

        # Field name can be /T or via /Parent
        T = annot.get("/T")
        parent = deref(annot.get("/Parent"))
        if T is None and isinstance(parent, dict):
            T = parent.get("/T")

        FT = annot.get("/FT")
        if FT is None and isinstance(parent, dict):
            FT = parent.get("/FT")

        if FT != "/Btn":
            continue

        ap = deref(annot.get("/AP"))
        export = None
        if isinstance(ap, dict):
            n = deref(ap.get("/N"))
            if isinstance(n, dict):
                export = [str(k) for k in n.keys() if str(k) != "/Off"] or None

        V = annot.get("/V")
        AS = annot.get("/AS")

        print(f"p{pi+1} | {T} | FT={FT} | export={export} | V={V} | AS={AS}")
        found += 1

print(f"\n✅ Found Btn widgets: {found}")
