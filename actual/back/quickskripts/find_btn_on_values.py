from pypdf import PdfReader

PDF = "actual/back/data/templates/w9-2026/w9-2026.pdf"
r = PdfReader(PDF)

def resolve(obj):
    try:
        return obj.get_object()
    except Exception:
        return obj

page = r.pages[0]
annots_obj = page.get("/Annots")
annots = resolve(annots_obj) if annots_obj is not None else []
if not isinstance(annots, list):
    annots = []

print("Total annots:", len(annots))

idx = 0
for a in annots:
    ao = resolve(a)
    if ao.get("/Subtype") != "/Widget":
        continue

    idx += 1
    ft = ao.get("/FT")
    parent = resolve(ao.get("/Parent")) if ao.get("/Parent") else None

    t = ao.get("/T")
    if not t and parent:
        t = parent.get("/T")

    print(f"\nWIDGET #{idx}")
    print("  /FT:", ft)
    print("  /T :", t)
    if parent and parent.get("/T"):
        print("  parent /T:", parent.get("/T"))

    ap = ao.get("/AP")
    if ap and "/N" in ap:
        n = resolve(ap["/N"])
        try:
            keys = list(n.keys())
        except Exception:
            keys = []
        print("  /AP /N keys:", keys)
    else:
        print("  /AP: none or no /N")
print("\n✅ Done")