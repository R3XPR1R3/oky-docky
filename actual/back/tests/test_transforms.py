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


if __name__ == "__main__":
    unittest.main()
