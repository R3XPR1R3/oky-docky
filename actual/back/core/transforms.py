"""
Declarative transform engine.

Replaces hardcoded enrich_form_data() logic with data-driven rules
defined in schema.json under the "transforms" key.

Transform types:
  - derive:    when {field: value}, set {target: value}
  - compute:   math operation (multiply, sum, subtract) → output field
  - copy:      copy value from one field to another (optionally if_empty)
  - auto_date: set a field to today's date
  - set_value: unconditionally set a field to a literal value
"""
from __future__ import annotations

from datetime import date as _date
from typing import Any, Dict, List


def _to_int(v: Any) -> int:
    if v is None:
        return 0
    if isinstance(v, bool):
        return int(v)
    if isinstance(v, int):
        return max(0, v)
    raw = str(v).strip()
    digits = "".join(ch for ch in raw if ch.isdigit())
    return int(digits) if digits else 0


def _match_condition(when: Dict[str, Any], data: Dict[str, Any]) -> bool:
    """Check if all conditions in `when` match against `data`."""
    for key, expected in when.items():
        actual = data.get(key)
        if isinstance(expected, bool):
            if bool(actual) != expected:
                return False
        elif isinstance(expected, list):
            if str(actual) not in [str(v) for v in expected]:
                return False
        else:
            if str(actual) != str(expected):
                return False
    return True


def apply_transforms(data: Dict[str, Any], transforms: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Apply declarative transform rules to form data. Returns enriched copy."""
    result = dict(data)

    for rule in transforms:
        rtype = rule.get("type", "")

        if rtype == "derive":
            when = rule.get("when")
            to_set = rule.get("set", {})
            if when and _match_condition(when, result):
                result.update(to_set)

        elif rtype == "compute":
            op = rule.get("operation", "multiply")
            output_key = rule.get("output")
            if not output_key:
                continue

            if op == "multiply":
                input_key = rule.get("input", "")
                factor = rule.get("factor", 1)
                val = _to_int(result.get(input_key))
                result[output_key] = str(val * factor)

            elif op in ("sum", "add"):
                input_keys = rule.get("inputs", [])
                total = sum(_to_int(result.get(k)) for k in input_keys)
                result[output_key] = str(total)

            elif op == "subtract":
                input_keys = rule.get("inputs", [])
                vals = [_to_int(result.get(k)) for k in input_keys]
                sub = vals[0] if vals else 0
                for v in vals[1:]:
                    sub -= v
                result[output_key] = str(max(0, sub))

        elif rtype == "copy":
            src = rule.get("from", "")
            dst = rule.get("to", "")
            if not src or not dst:
                continue
            when = rule.get("when")
            if when and not _match_condition(when, result):
                continue
            val = result.get(src, "")
            if val:
                if rule.get("if_empty", False):
                    result.setdefault(dst, val)
                else:
                    result[dst] = val

        elif rtype == "auto_date":
            field = rule.get("field", "")
            fmt = rule.get("format", "MM/DD/YYYY")
            if field:
                py_fmt = fmt.replace("MM", "%m").replace("DD", "%d").replace("YYYY", "%Y")
                result.setdefault(field, _date.today().strftime(py_fmt))

        elif rtype == "set_value":
            field = rule.get("field", "")
            value = rule.get("value")
            when = rule.get("when")
            if field:
                if when is None or _match_condition(when, result):
                    result.setdefault(field, value)

    return result
