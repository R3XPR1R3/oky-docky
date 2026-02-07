from pathlib import Path
from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject, BooleanObject

ROOT = Path(__file__).resolve().parents[2]  # actual/back
SRC = ROOT / "back" / "data" / "templates" / "w9-2026.pdf"
OUT = ROOT / "back" / "data" / "output" / "w9-filled.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)

def set_btn(values: dict, field: str, on: bool, export_on: str = "/1"):
    values[field] = export_on if on else "/Off"

values = {
    # text fields (short widget names)
    "f1_01[0]": "IVAN IVANOV",
    "f1_02[0]": "Ivanov Consulting LLC",
    "f1_03[0]": "123 Main St",
    "f1_04[0]": "Apt 5",
    "f1_05[0]": "Wellington, FL 33414",
    "f1_07[0]": "Wellington",
    "f1_08[0]": "FL",
    "f1_09[0]": "33414",
    "f1_10[0]": "123-45-6789",
}

# ✅ Tax classification example: choose ONE checkbox in c1_1[0..6]
set_btn(values, "c1_1[0]", True, "/1")  # first option
# optional: ensure others are off
for i in range(1, 7):
    set_btn(values, f"c1_1[{i}]", False, f"/{i+1}")

# other checkboxes (keep off for now)
set_btn(values, "c1_2[0]", False, "/1")
set_btn(values, "c1_3[0]", False, "/1")

reader = PdfReader(str(SRC))
writer = PdfWriter()
writer.append_pages_from_reader(reader)

# ✅ copy AcroForm into writer, otherwise updates won't stick reliably
root = reader.trailer["/Root"]
if "/AcroForm" in root:
    writer._root_object.update({NameObject("/AcroForm"): root["/AcroForm"]})
    writer._root_object["/AcroForm"].update({NameObject("/NeedAppearances"): BooleanObject(True)})
else:
    raise RuntimeError("No /AcroForm found – not a fillable PDF (AcroForm).")

for page in writer.pages:
    writer.update_page_form_field_values(page, values)

with open(OUT, "wb") as f:
    writer.write(f)

print("✅ saved:", OUT)
