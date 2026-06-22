import sys
import unittest
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from core.transforms import apply_transforms  # noqa: E402
from core.formula import FormulaError, evaluate_formula, formula_dependencies  # noqa: E402


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

    def test_formula_outputs_are_ordered_and_can_fill_multiple_lines(self):
        transforms = [{
            "type": "formula",
            "outputs": {
                "half": "amount / 2",
                "twenty_percent": "percent(amount, 20)",
                "remainder": "amount - twenty_percent",
                "after_b": "amount - B",
            },
        }]
        result = apply_transforms({"amount": "1,000", "B": "125"}, transforms)
        self.assertEqual(result["half"], "500")
        self.assertEqual(result["twenty_percent"], "200")
        self.assertEqual(result["remainder"], "800")
        self.assertEqual(result["after_b"], "875")

    def test_formula_supports_conditions_and_rejects_unsafe_syntax(self):
        self.assertEqual(evaluate_formula("ifelse(age >= 65 and eligible == 'yes', base + extra, base)", {
            "age": 70, "eligible": "yes", "base": 100, "extra": 25,
        }), "125")
        self.assertEqual(formula_dependencies("amount - percent(amount, 20)"), {"amount"})
        with self.assertRaises(FormulaError):
            evaluate_formula("__import__('os').system('echo nope')", {})


if __name__ == "__main__":
    unittest.main()
