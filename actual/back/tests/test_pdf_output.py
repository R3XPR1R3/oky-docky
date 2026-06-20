import json
import sys
import tempfile
import unittest
from pathlib import Path

from pypdf import PdfReader


BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from core.mapping import build_pdf_field_values  # noqa: E402
from core.transforms import apply_transforms  # noqa: E402
from engines.acroform import fill_acroform_pdf  # noqa: E402


class CompletedPdfTests(unittest.TestCase):
    def test_w4_has_one_rendering_layer_and_no_implicit_zeroes(self):
        bundle = BACKEND_ROOT / "data" / "templates" / "w4-2026"
        schema = json.loads((bundle / "schema.json").read_text(encoding="utf-8"))
        mapping = json.loads((bundle / "mapping.json").read_text(encoding="utf-8"))
        data = apply_transforms(
            {
                "first_middle_names": "Test",
                "last_name": "User",
                "filing_status": "single_mfs",
                "deductions": "3456",
            },
            schema["transforms"],
        )
        values, overlays = build_pdf_field_values(data, mapping)
        self.assertNotIn("f1_06[0]", values)
        self.assertNotIn("f1_07[0]", values)
        self.assertNotIn("f1_08[0]", values)

        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "filled.pdf"
            fill_acroform_pdf(bundle / "w4-2026.pdf", values, output, overlays)
            reader = PdfReader(output)
            acroform = reader.trailer["/Root"]["/AcroForm"].get_object()
            text = "\n".join(page.extract_text() or "" for page in reader.pages)

        self.assertNotIn("/XFA", acroform)
        self.assertEqual(len(acroform.get("/Fields", [])), 0)
        for page in reader.pages:
            for annotation_ref in page.get("/Annots", []):
                self.assertNotEqual(annotation_ref.get_object().get("/Subtype"), "/Widget")
        self.assertEqual(text.count("3456"), 1)

    def test_w9_disregarded_llc_uses_owner_classification(self):
        bundle = BACKEND_ROOT / "data" / "templates" / "w9-2026"
        schema = json.loads((bundle / "schema.json").read_text(encoding="utf-8"))
        mapping = json.loads((bundle / "mapping.json").read_text(encoding="utf-8"))
        data = apply_transforms(
            {
                "tax_class": "llc",
                "taxpayer_classification": "disregarded_individual",
                "person_name": "Test Owner",
                "llc_name": "Test LLC",
            },
            schema["transforms"],
        )
        values, _ = build_pdf_field_values(data, mapping)

        self.assertEqual(data["pdf_tax_class"], "individual")
        self.assertEqual(data["llc_classification_letter"], "")
        self.assertEqual(values["c1_1[0]"], "/1")
        self.assertEqual(values["c1_1[5]"], "/Off")
        self.assertEqual(values["f1_03[0]"], "")

        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "w9.pdf"
            fill_acroform_pdf(bundle / "w9-2026.pdf", values, output)
            reader = PdfReader(output)
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
            widgets = [
                annotation_ref
                for page in reader.pages
                for annotation_ref in page.get("/Annots", [])
                if annotation_ref.get_object().get("/Subtype") == "/Widget"
            ]

        self.assertEqual(widgets, [])
        self.assertIn("X", text)


if __name__ == "__main__":
    unittest.main()
