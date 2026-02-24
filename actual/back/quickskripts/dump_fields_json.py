import json
from pathlib import Path
from pypdf import PdfReader
from pypdf.generic import IndirectObject

PDF = "actual/back/data/templates/w9-2026/w9-2026.pdf"
OUT = "actual/back/data/templates/w9-2026/fields_dump.json"

def deref(obj):
    return obj.get_object() if isinstance(obj, IndirectObject) else obj

r = PdfReader(PDF)

items = []
seen = set()

for pi, page in enumerate(r.pages, start=1):
    annots = deref(page.get("/Annots")) or []
    for a in annots:
        annot = deref(a)
        if not isinstance(annot, dict) or annot.get("/Subtype") != "/Widget":
            continue

        parent = deref(annot.get("/Parent"))
        ft = annot.get("/FT") or (parent.get("/FT") if isinstance(parent, dict) else None)
        if ft not in ("/Tx", "/Btn"):
            continue

        t = annot.get("/T")
        if t is None and isinstance(parent, dict):
            t = parent.get("/T")
        if not t:
            continue

        name = str(t)
        if name in seen:
            continue
        seen.add(name)

        entry = {"page": pi, "name": name, "ft": ft}

        if ft == "/Btn":
            ap = deref(annot.get("/AP"))
            export = []
            if isinstance(ap, dict):
                n = deref(ap.get("/N"))
                if isinstance(n, dict):
                    export = [str(k) for k in n.keys() if str(k) != "/Off"]
            entry["export_values"] = export

        items.append(entry)

Path(OUT).write_text(json.dumps({"pdf": PDF, "fields": items}, indent=2), encoding="utf-8")
print("✅ wrote:", OUT, "| fields:", len(items))
