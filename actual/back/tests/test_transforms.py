import json
import sys
import unittest
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from core.transforms import apply_transforms  # noqa: E402


class TransformEngineTests(unittest.TestCase):
    def test_numeric_conditions_and_conditional_compute(self):
        transforms = [
            {
                "type": "compute",
                "operation": "sum",
                "inputs": ["a", "b"],
                "output": "total",
                "when": {"income": {"lt": 75000}, "status": {"in": ["single", "hoh"]}},
            }
        ]
        self.assertEqual(
            apply_transforms({"a": "10", "b": "5", "income": "74,999", "status": "single"}, transforms)["total"],
            "15",
        )
        self.assertNotIn(
            "total",
            apply_transforms({"a": "10", "b": "5", "income": "75000", "status": "single"}, transforms),
        )

    def test_boolean_and_empty_operators(self):
        transforms = [
            {
                "type": "derive",
                "when": {"accepted": {"truthy": True}, "note": {"empty": True}},
                "set": {"ready": True},
                "else_set": {"ready": False},
            }
        ]
        self.assertTrue(apply_transforms({"accepted": "yes", "note": ""}, transforms)["ready"])
        self.assertFalse(apply_transforms({"accepted": "no", "note": ""}, transforms)["ready"])


class W4SeniorDeductionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        schema_path = BACKEND_ROOT / "data" / "templates" / "w4-2026" / "schema.json"
        cls.transforms = json.loads(schema_path.read_text(encoding="utf-8"))["transforms"]

    def test_single_senior_below_limit_is_automatic(self):
        result = apply_transforms(
            {
                "filing_status": "single_mfs",
                "employee_age_65": "yes",
                "senior_total_income": "65000",
                "has_other_deductions": "no",
            },
            self.transforms,
        )
        self.assertEqual(result["use_deductions_worksheet"], "yes")
        self.assertEqual(result["employee_senior_deduction"], "6000")
        self.assertEqual(result["deductions"], "6000")

    def test_married_two_seniors_below_limit_get_twelve_thousand(self):
        result = apply_transforms(
            {
                "filing_status": "mfj_qss",
                "employee_age_65": "yes",
                "spouse_age_65": "yes",
                "senior_total_income": "120000",
                "has_other_deductions": "no",
            },
            self.transforms,
        )
        self.assertEqual(result["deductions"], "12000")

    def test_above_limit_keeps_manual_worksheet_value(self):
        result = apply_transforms(
            {
                "filing_status": "single_mfs",
                "employee_age_65": "yes",
                "senior_total_income": "90000",
                "has_other_deductions": "yes",
                "deductions": "3456",
            },
            self.transforms,
        )
        self.assertEqual(result["employee_senior_deduction"], "0")
        self.assertEqual(result["deductions"], "3456")


if __name__ == "__main__":
    unittest.main()
