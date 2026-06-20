import sys
import unittest
from decimal import Decimal
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from core.tax_rules import calculate_standard_deduction  # noqa: E402


class StandardDeductionTests(unittest.TestCase):
    def test_single_age_and_blind_gets_two_unmarried_additions(self):
        result = calculate_standard_deduction(
            year=2026,
            filing_status="single",
            taxpayer_age_65=True,
            taxpayer_blind=True,
        )
        self.assertEqual(result["base_standard_deduction"], 16100)
        self.assertEqual(result["additional_standard_deduction"], 4100)
        self.assertEqual(result["total_standard_deduction"], 20200)

    def test_joint_return_counts_each_spouse_condition(self):
        result = calculate_standard_deduction(
            year=2026,
            filing_status="married_filing_jointly",
            taxpayer_age_65=True,
            spouse_blind=True,
        )
        self.assertEqual(result["additional_standard_deduction"], 3300)
        self.assertEqual(result["total_standard_deduction"], 35500)

    def test_dependent_rule_requires_and_caps_earned_income(self):
        with self.assertRaises(ValueError):
            calculate_standard_deduction(
                year=2026,
                filing_status="single",
                can_be_claimed_as_dependent=True,
            )
        result = calculate_standard_deduction(
            year=2026,
            filing_status="single",
            can_be_claimed_as_dependent=True,
            earned_income=Decimal("20000"),
        )
        self.assertEqual(result["base_standard_deduction"], 16100)

    def test_unknown_year_is_not_guessed(self):
        with self.assertRaises(ValueError):
            calculate_standard_deduction(year=2027, filing_status="single")


if __name__ == "__main__":
    unittest.main()
