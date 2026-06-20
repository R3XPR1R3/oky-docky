"""Versioned IRS standard-deduction calculations."""
from __future__ import annotations

from decimal import Decimal
from typing import Any


SOURCE_URL = "https://www.irs.gov/pub/irs-drop/rp-25-32.pdf"

RULES: dict[int, dict[str, Any]] = {
    2026: {
        "base": {
            "single": Decimal("16100"),
            "married_filing_jointly": Decimal("32200"),
            "married_filing_separately": Decimal("16100"),
            "head_of_household": Decimal("24150"),
            "qualifying_surviving_spouse": Decimal("32200"),
        },
        "additional": Decimal("1650"),
        "additional_unmarried": Decimal("2050"),
        "dependent_minimum": Decimal("1350"),
        "dependent_earned_income_addition": Decimal("450"),
    }
}


def calculate_standard_deduction(
    *,
    year: int,
    filing_status: str,
    taxpayer_age_65: bool = False,
    taxpayer_blind: bool = False,
    spouse_age_65: bool = False,
    spouse_blind: bool = False,
    can_be_claimed_as_dependent: bool = False,
    earned_income: Decimal | None = None,
) -> dict[str, Any]:
    """Return a transparent standard-deduction breakdown for a known tax year."""
    if year not in RULES:
        raise ValueError(f"IRS standard-deduction rules are not configured for {year}")

    rules = RULES[year]
    if filing_status not in rules["base"]:
        raise ValueError("Unsupported filing status")
    if (spouse_age_65 or spouse_blind) and filing_status != "married_filing_jointly":
        raise ValueError("Spouse age/blind additions require married filing jointly")
    if can_be_claimed_as_dependent and earned_income is None:
        raise ValueError("Earned income is required for a dependent's standard deduction")

    regular_base = rules["base"][filing_status]
    base = regular_base
    if can_be_claimed_as_dependent:
        dependent_base = max(
            rules["dependent_minimum"],
            max(Decimal("0"), earned_income or Decimal("0"))
            + rules["dependent_earned_income_addition"],
        )
        base = min(regular_base, dependent_base)

    unmarried = filing_status in {"single", "head_of_household"}
    per_condition = rules["additional_unmarried"] if unmarried else rules["additional"]
    conditions = sum(
        int(value)
        for value in (taxpayer_age_65, taxpayer_blind, spouse_age_65, spouse_blind)
    )
    additional = per_condition * conditions

    return {
        "tax_year": year,
        "filing_status": filing_status,
        "base_standard_deduction": int(base),
        "age_or_blind_conditions": conditions,
        "additional_per_condition": int(per_condition),
        "additional_standard_deduction": int(additional),
        "total_standard_deduction": int(base + additional),
        "source": SOURCE_URL,
    }
