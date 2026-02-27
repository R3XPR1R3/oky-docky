from __future__ import annotations
from typing import Dict, Any, List, Tuple


def build_pdf_field_values(form_data: Dict[str, Any], mapping: Dict[str, Any]) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """
    Returns (field_values, signature_overlays).

    signature_overlays is a list of dicts:
      {"value": str_or_dataurl, "page": int, "rect": [x1,y1,x2,y2], "field": str}

    Mapping types supported:
      - "key": "PdfFieldName"  (text)
      - "key": ["FieldA","FieldB"] (write same text to many)
      - checkbox
      - radio / radio_group
      - split / tin_split
      - spread: split a delimited string across multiple fields
      - value_to_checkboxes: map one answer to multiple checkbox states
      - signature: text field + optional image overlay
    """
    out: Dict[str, Any] = {}
    sig_overlays: List[Dict[str, Any]] = []

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

        elif rtype == "split":
            raw = "" if value is None else str(value)
            digits = "".join(ch for ch in raw if ch.isdigit())
            fields = rule.get("fields") or []
            pattern = rule.get("pattern") or []

            if fields and pattern and len(fields) == len(pattern):
                pos = 0
                for field_name, length in zip(fields, pattern):
                    out[field_name] = digits[pos:pos + length]
                    pos += length

        elif rtype == "spread":
            raw = "" if value is None else str(value)
            separator = rule.get("separator", ",")
            fields = rule.get("fields") or []
            parts = [p.strip() for p in raw.split(separator) if p.strip()]
            for i, field_name in enumerate(fields):
                if i < len(parts):
                    out[field_name] = parts[i]

        elif rtype == "value_to_checkboxes":
            all_fields = rule.get("all_fields") or []
            off_value = rule.get("off_value", "/Off")
            value_mapping = rule.get("mapping") or {}

            # turn all off first
            for fld in all_fields:
                out[fld] = off_value

            selected = "" if value is None else str(value)
            field_states = value_mapping.get(selected, {})
            for fld, val in field_states.items():
                out[fld] = val

        elif rtype == "signature":
            field = rule.get("field")
            raw = "" if value is None else str(value)

            is_image = raw.startswith("data:image")

            if is_image:
                # image signature: fill text field with empty, add overlay
                if field:
                    out[field] = ""
                sig_overlays.append({
                    "value": raw,
                    "page": rule.get("page", 0),
                    "rect": rule.get("rect", [0, 0, 200, 50]),
                    "field": field or "",
                })
            else:
                # typed signature: just fill the text field
                if field:
                    out[field] = raw

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

    return out, sig_overlays
