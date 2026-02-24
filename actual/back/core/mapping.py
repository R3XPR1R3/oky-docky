from __future__ import annotations
from typing import Dict, Any


def build_pdf_field_values(form_data: Dict[str, Any], mapping: Dict[str, Any]) -> Dict[str, Any]:
    """
    Mapping types supported:
      - "key": "PdfFieldName"  (text)
      - "key": ["FieldA","FieldB"] (write same text to many)
      - checkbox:
          {"type":"checkbox","field":"PdfCheck","checked_value":"/Yes","unchecked_value":"/Off"}
      - radio (single field):
          {"type":"radio","field":"PdfRadio","value_map":{"A":"/A","B":"/B"}}
      - radio_group (multi widgets like c1_1[0..6]):
          {"type":"radio_group","choices":[{"value":"individual","field":"c1_1[0]","export_on":"/1"}, ...], "off_value":"/Off"}
      - tin_split:
          {"type":"tin_split","ssn":[...3 fields...],"ein":[...2 fields...],"prefer":"auto|ssn|ein"}
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

        # list[str] -> write same text into multiple PDF fields
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
            value_map = rule.get("value_map", {})
            out[field] = value_map.get(value, value)

        elif rtype == "radio_group":
            choices = rule.get("choices") or []
            off_value = rule.get("off_value", "/Off")

            # turn all off first
            for ch in choices:
                fld = ch.get("field")
                if fld:
                    out[fld] = off_value

            selected = "" if value is None else str(value)
            for ch in choices:
                if ch.get("value") == selected:
                    fld = ch.get("field")
                    onv = ch.get("export_on", "/1")
                    if fld:
                        out[fld] = onv
                    break

        elif rtype == "tin_split":
            raw = "" if value is None else str(value)
            digits = "".join(ch for ch in raw if ch.isdigit())

            ssn = rule.get("ssn") or []
            ein = rule.get("ein") or []
            prefer = rule.get("prefer", "auto")  # auto|ssn|ein

            if len(digits) != 9:
                # fallback: dump digits into first field we have
                if len(ssn) >= 1:
                    out[ssn[0]] = digits
                elif len(ein) >= 1:
                    out[ein[0]] = digits
                continue

            if prefer in ("auto", "ssn") and len(ssn) >= 3:
                out[ssn[0]] = digits[0:3]
                out[ssn[1]] = digits[3:5]
                out[ssn[2]] = digits[5:9]

            if prefer in ("auto", "ein") and len(ein) >= 2:
                out[ein[0]] = digits[0:2]
                out[ein[1]] = digits[2:9]

        else:
            # fallback
            field = rule.get("field")
            if field:
                out[field] = value

    return out
