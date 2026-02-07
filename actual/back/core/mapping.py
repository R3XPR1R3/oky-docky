from __future__ import annotations
from typing import Dict, Any


def build_pdf_field_values(form_data: Dict[str, Any], mapping: Dict[str, Any]) -> Dict[str, Any]:
    """
    Превращает "человеческие" ключи формы в значения для PDF полей.
    mapping:
      - "key": "PdfFieldName"                  (text)
      - "key": {"type":"checkbox","field":"PdfCheck","checked_value":"/Yes","unchecked_value":"/Off"}
      - "key": {"type":"radio","field":"PdfRadio","value_map":{"A":"/A","B":"/B"}}
    """
    out: Dict[str, Any] = {}

    for key, rule in mapping.items():
        if key not in form_data:
            continue

        value = form_data.get(key)

        # simple text mapping
        if isinstance(rule, str):
            out[rule] = "" if value is None else str(value)
            continue
        # allow list[str] -> write same value into multiple PDF fields
        if isinstance(rule, list):
            v = "" if value is None else str(value)
            for field_name in rule:
                out[field_name] = v
            continue

        if not isinstance(rule, dict):
            continue

        rtype = rule.get("type", "text")

        if rtype == "checkbox":
            field = rule["field"]
            checked = rule.get("checked_value", "/Yes")
            unchecked = rule.get("unchecked_value", "/Off")
            out[field] = checked if bool(value) else unchecked

        elif rtype == "radio":
            field = rule["field"]
            # value_map: input_value -> pdf_value
            value_map = rule.get("value_map", {})
            # если value_map нет — пытаемся напрямую
            out[field] = value_map.get(value, value)

        else:
            # fallback
            field = rule.get("field")
            if field:
                out[field] = value

    return out
