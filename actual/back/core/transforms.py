"""
Declarative transform engine.

Replaces hardcoded enrich_form_data() logic with data-driven rules
defined in schema.json under the "transforms" key.

Transform types
===============
  derive     – when {field: value}, set {target: value}
  compute    – math operation → output field
  copy       – copy value from one field to another (optionally if_empty)
  auto_date  – set a field to today's date
  set_value  – unconditionally (or conditionally) set a literal value

Supported compute operations
============================
  add / sum      – sum of inputs
  subtract       – first input minus the rest
  multiply       – input × factor  (or product of inputs)
  divide         – input ÷ divisor (safe: 0 → 0)
  percent        – input × percent / 100
  pow            – base ** exp
  mod            – left % right (safe: 0 → 0)
  min / max      – min/max of inputs
  avg            – average of inputs
  round          – round to N decimal places
  abs            – absolute value
  negate         – flip sign
"""
from __future__ import annotations

from datetime import date as _date
from typing import Any, Dict, List


# ---------------------------------------------------------------------------
# Numeric helpers
# ---------------------------------------------------------------------------

def _to_num(v: Any) -> float:
    """Coerce any value to a number.  None / empty / garbage → 0."""
    if v is None:
        return 0.0
    if isinstance(v, bool):
        return float(v)
    if isinstance(v, (int, float)):
        return float(v)
    raw = str(v).strip().replace(",", "")
    if not raw:
        return 0.0
    try:
        return float(raw)
    except ValueError:
        digits = "".join(ch for ch in raw if ch.isdigit() or ch in ".-")
        try:
            return float(digits) if digits and digits not in {"-", ".", "-."} else 0.0
        except ValueError:
            return 0.0


def _fmt(value: float) -> str:
    """Format a number as a clean string (no trailing .0)."""
    return str(int(value)) if value == int(value) else str(value)


# ---------------------------------------------------------------------------
# Condition matching
# ---------------------------------------------------------------------------

def _is_empty(value: Any) -> bool:
    return value is None or value == "" or value == []


def _to_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    return str(value or "").strip().lower() in {"true", "yes", "1", "on"}


def _equal(actual: Any, expected: Any) -> bool:
    if isinstance(expected, bool):
        return _to_bool(actual) == expected
    if expected is None:
        return actual is None
    return str(actual) == str(expected)


def _match_expected(actual: Any, expected: Any) -> bool:
    if isinstance(expected, list):
        return any(_equal(actual, item) for item in expected)
    if not isinstance(expected, dict):
        return _equal(actual, expected)

    if "equals" in expected and not _equal(actual, expected["equals"]):
        return False
    if "not_equals" in expected and _equal(actual, expected["not_equals"]):
        return False
    if "in" in expected and not any(_equal(actual, item) for item in expected["in"]):
        return False
    if "not_in" in expected and any(_equal(actual, item) for item in expected["not_in"]):
        return False
    if "empty" in expected and _is_empty(actual) != bool(expected["empty"]):
        return False
    if "truthy" in expected and _to_bool(actual) != bool(expected["truthy"]):
        return False

    numeric = _to_num(actual)
    if "gt" in expected and not numeric > _to_num(expected["gt"]):
        return False
    if "gte" in expected and not numeric >= _to_num(expected["gte"]):
        return False
    if "lt" in expected and not numeric < _to_num(expected["lt"]):
        return False
    if "lte" in expected and not numeric <= _to_num(expected["lte"]):
        return False
    return True


def _match(when: Dict[str, Any], data: Dict[str, Any]) -> bool:
    """Return True when every field predicate in *when* matches *data*."""
    return all(_match_expected(data.get(key), expected) for key, expected in when.items())


def matches_conditions(conditions: Dict[str, Any] | None, data: Dict[str, Any]) -> bool:
    """Public condition matcher shared by routing and transform evaluation."""
    return conditions is None or _match(conditions, data)


# ---------------------------------------------------------------------------
# Compute dispatcher
# ---------------------------------------------------------------------------

def _compute(rule: Dict[str, Any], data: Dict[str, Any]) -> str:
    """Execute a single compute rule and return the string result."""
    op = rule.get("operation", "add")
    inputs = rule.get("inputs") or ([rule["input"]] if rule.get("input") else [])
    vals = [_to_num(data.get(k)) for k in inputs]

    # --- basic arithmetic ---
    if op in ("add", "sum"):
        return _fmt(sum(vals))

    if op == "subtract":
        result = vals[0] if vals else 0.0
        for v in vals[1:]:
            result -= v
        return _fmt(result)

    if op == "multiply":
        # Two modes: input × factor, or product of all inputs
        factor = rule.get("factor")
        if factor is not None:
            base = vals[0] if vals else 0.0
            return _fmt(base * _to_num(factor))
        result = 1.0
        for v in vals:
            result *= v
        return _fmt(result)

    if op == "divide":
        dividend = vals[0] if vals else 0.0
        divisor = vals[1] if len(vals) > 1 else _to_num(rule.get("divisor", 1))
        return _fmt(0.0 if divisor == 0 else dividend / divisor)

    if op == "percent":
        # input × percent / 100   (e.g. percent=15 → 15%)
        base = vals[0] if vals else 0.0
        pct = vals[1] if len(vals) > 1 else _to_num(rule.get("percent", 0))
        return _fmt(base * pct / 100)

    # --- power / modulo ---
    if op == "pow":
        base = vals[0] if vals else 0.0
        exp = vals[1] if len(vals) > 1 else _to_num(rule.get("exp", 1))
        return _fmt(base ** exp)

    if op == "mod":
        left = vals[0] if vals else 0.0
        right = vals[1] if len(vals) > 1 else _to_num(rule.get("mod", 1))
        return _fmt(0.0 if right == 0 else left % right)

    # --- aggregates ---
    if op == "min":
        return _fmt(min(vals)) if vals else "0"

    if op == "max":
        return _fmt(max(vals)) if vals else "0"

    if op == "avg":
        return _fmt(sum(vals) / len(vals)) if vals else "0"

    # --- rounding / sign ---
    if op == "round":
        val = vals[0] if vals else 0.0
        precision = int(_to_num(rule.get("precision", 0)))
        return _fmt(round(val, precision))

    if op == "abs":
        val = vals[0] if vals else 0.0
        return _fmt(abs(val))

    if op == "negate":
        val = vals[0] if vals else 0.0
        return _fmt(-val)

    # fallback: treat unknown op as sum
    return _fmt(sum(vals))


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def apply_transforms(
    data: Dict[str, Any],
    transforms: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Apply declarative transform rules to form data.  Returns enriched copy."""
    result = dict(data)

    for rule in transforms:
        rtype = rule.get("type", "")
        when = rule.get("when")
        unless = rule.get("unless")
        active = matches_conditions(when, result) and not (
            unless is not None and matches_conditions(unless, result)
        )

        # --- derive: conditional bulk-set ---
        if rtype == "derive":
            result.update(rule.get("set", {}) if active else rule.get("else_set", {}))

        # --- compute: math → output ---
        elif rtype == "compute":
            output_key = rule.get("output")
            if not active or not output_key:
                continue
            result[output_key] = _compute(rule, result)

        # --- copy: field → field ---
        elif rtype == "copy":
            src, dst = rule.get("from", ""), rule.get("to", "")
            if not src or not dst:
                continue
            if not active:
                continue
            val = result.get(src, "")
            if not _is_empty(val):
                if rule.get("if_empty", False):
                    if result.get(dst) in (None, ""):
                        result[dst] = val
                else:
                    result[dst] = val

        # --- concat: fields -> joined output ---
        elif rtype == "concat":
            source_keys = rule.get("fields") or rule.get("inputs") or []
            output_key = rule.get("output", "")
            if not active or not isinstance(source_keys, list) or not output_key:
                continue
            values = [str(result.get(key, "")).strip() for key in source_keys]
            if rule.get("skip_empty", True):
                values = [value for value in values if value]
            result[output_key] = str(rule.get("separator", " ")).join(values)

        # --- auto_date: today's date ---
        elif rtype == "auto_date":
            field = rule.get("field", "")
            fmt = rule.get("format", "MM/DD/YYYY")
            if active and field:
                py_fmt = (
                    fmt.replace("MM", "%m")
                    .replace("DD", "%d")
                    .replace("YYYY", "%Y")
                )
                if result.get(field) in (None, ""):
                    result[field] = _date.today().strftime(py_fmt)

        # --- set_value: literal value ---
        elif rtype == "set_value":
            field = rule.get("field", "")
            value = rule.get("value")
            if field:
                if active:
                    result[field] = value
                elif "else_value" in rule:
                    result[field] = rule.get("else_value")

    return result
