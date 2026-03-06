from pypdf import PdfReader

path = "actual/back/data/templates/w9-2026/w9-2026.pdf"
r = PdfReader(path)
fields = r.get_fields() or {}

# выбери один checkbox из списка, который ты уже видишь:
targets = [
    "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[0]",
    "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[1]",
]

for t in targets:
    info = fields.get(t)
    print("\nFIELD:", t)
    if not info:
        print("  not found")
        continue
    print("  /FT:", info.get("/FT"))
    print("  /V :", info.get("/V"))
    print("  /AS:", info.get("/AS"))
    ap = info.get("/AP")
    print("  has /AP:", bool(ap))
    if ap and "/N" in ap:
        n = ap["/N"]
        try:
            keys = list(n.keys())
            print("  AP /N keys:", keys)   # вот тут обычно видно /Off и /Yes или /On
        except Exception as e:
            print("  cannot list /N keys:", e)
