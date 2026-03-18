from __future__ import annotations

from typing import Any, Dict, List, Tuple


Number = int | float


def _to_number(value: Any) -> Number:
    if value is None:
        return 0
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int, float)):
        return value

    raw = str(value).strip()
    if not raw:
        return 0

    normalized = raw.replace(",", "")
    try:
        return float(normalized)
    except ValueError:
        digits = "".join(ch for ch in normalized if ch.isdigit() or ch in ".-")
        if not digits or digits in {"-", ".", "-."}:
            return 0
        try:
            return float(digits)
        except ValueError:
            return 0


def _number_to_str(value: Number) -> str:
    if float(value).is_integer():
        return str(int(value))
    return str(value)


def _read_input_value(input_name: str, state: Dict[str, Any], variables: Dict[str, Any]) -> Any:
    if input_name.startswith("var:"):
        return variables.get(input_name.split(":", 1)[1])
    return state.get(input_name)


def _evaluate_math_rule(rule: Dict[str, Any], state: Dict[str, Any], variables: Dict[str, Any]) -> str:
    operation = str(rule.get("operation", "add")).lower()
    source_keys = rule.get("inputs") or []
    if not isinstance(source_keys, list):
        source_keys = []

    values = [_to_number(_read_input_value(str(k), state, variables)) for k in source_keys]

    if operation in {"add", "sum"}:
        result: Number = sum(values)
    elif operation == "multiply":
        factor = _to_number(rule.get("factor", 1))
        base = values[0] if values else 0
        result = base * factor
    elif operation == "subtract":
        result = values[0] if values else 0
        for v in values[1:]:
            result -= v
    elif operation == "divide":
        dividend = values[0] if values else 0
        divisor = values[1] if len(values) > 1 else _to_number(rule.get("divisor", 1))
        result = 0 if divisor == 0 else dividend / divisor
    elif operation == "pow":
        base = values[0] if values else 0
        exp = values[1] if len(values) > 1 else _to_number(rule.get("exp", 1))
        result = base ** exp
    elif operation == "mod":
        left = values[0] if values else 0
        right = values[1] if len(values) > 1 else _to_number(rule.get("mod", 1))
        result = 0 if right == 0 else left % right
    elif operation == "min":
        result = min(values) if values else 0
    elif operation == "max":
        result = max(values) if values else 0
    elif operation == "avg":
        result = (sum(values) / len(values)) if values else 0
    elif operation == "round":
        val = values[0] if values else 0
        precision = int(_to_number(rule.get("precision", 0)))
        result = round(val, precision)
    else:
        result = sum(values)

    return _number_to_str(result)


def _evaluate_condition(rule: Dict[str, Any], state: Dict[str, Any], variables: Dict[str, Any]) -> bool:
    left_raw = _read_input_value(str(rule.get("left", "")), state, variables)
    right_raw = _read_input_value(str(rule.get("right", "")), state, variables)
    op = str(rule.get("op", "eq")).lower()

    if op in {"gt", "gte", "lt", "lte"}:
        left = _to_number(left_raw)
        right = _to_number(right_raw)
        if op == "gt":
            return left > right
        if op == "gte":
            return left >= right
        if op == "lt":
            return left < right
        return left <= right

    left = "" if left_raw is None else str(left_raw)
    right = "" if right_raw is None else str(right_raw)
    if op == "neq":
        return left != right
    return left == right


def _apply_logic_rules(form_data: Dict[str, Any], mapping: Dict[str, Any]) -> Dict[str, Any]:
    """
    Apply embedded scenario language rules:

    Rule types:
      - math: compute number/string result and write into output_key
      - set_var: persist current value into internal variable table (usable as var:name)
      - if: conditional assignment to output_key

    Variables are persisted during one evaluation run (across subsequent rules).
    """
    state = dict(form_data)
    variables: Dict[str, Any] = {}

    # deterministic order: iterate mapping in insertion order
    for _, rule in mapping.items():
        if not isinstance(rule, dict):
            continue

        rtype = str(rule.get("type", "")).lower()

        if rtype == "set_var":
            name = rule.get("name")
            source = str(rule.get("from", ""))
            if not name or not source:
                continue
            variables[str(name)] = _read_input_value(source, state, variables)
            continue

        if rtype == "math":
            output_key = rule.get("output_key")
            if not output_key:
                continue
            result = _evaluate_math_rule(rule, state, variables)
            state[str(output_key)] = result
            if rule.get("var_name"):
                variables[str(rule["var_name"])] = result
            continue

        if rtype == "if":
            output_key = rule.get("output_key")
            if not output_key:
                continue
            passed = _evaluate_condition(rule, state, variables)
            true_val = rule.get("true")
            false_val = rule.get("false", "")
            chosen = true_val if passed else false_val
            if isinstance(chosen, str) and chosen.startswith("var:"):
                chosen = variables.get(chosen.split(":", 1)[1], "")
            state[str(output_key)] = chosen

    return state


def build_pdf_field_values(form_data: Dict[str, Any], mapping: Dict[str, Any]) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """
    Returns (field_values, signature_overlays).

    Mapping types supported:
      - string/list direct mapping
      - checkbox, radio, radio_group, split, spread, value_to_checkboxes, signature, tin_split
      - scenario-language rules: math, set_var, if
    """
    state = _apply_logic_rules(form_data, mapping)
    out: Dict[str, Any] = {}
    sig_overlays: List[Dict[str, Any]] = []

    for key, rule in mapping.items():
        if key not in state:
            continue

        value = state.get(key)

        if isinstance(rule, str):
            out[rule] = "" if value is None else str(value)
            continue

        if isinstance(rule, list):
            v = "" if value is None else str(value)
            for field_name in rule:
                out[field_name] = v
            continue

        if not isinstance(rule, dict):
            continue

        rtype = rule.get("type", "text")

        if rtype in {"math", "set_var", "if"}:
            continue

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

        elif rtype == "date_split":
            # Parse MM/DD/YYYY or M/D/YYYY and split into separate fields
            import re
            raw = "" if value is None else str(value).strip()
            fields_map = rule.get("fields") or {}
            m = re.match(r"(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})", raw)
            if m:
                if "mm" in fields_map:
                    out[fields_map["mm"]] = m.group(1)
                if "dd" in fields_map:
                    out[fields_map["dd"]] = m.group(2)
                if "yyyy" in fields_map:
                    out[fields_map["yyyy"]] = m.group(3)

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
                if field:
                    out[field] = ""
                sig_overlays.append({
                    "value": raw,
                    "page": rule.get("page", 0),
                    "rect": rule.get("rect", [0, 0, 200, 50]),
                    "field": field or "",
                })
            else:
                if field:
                    out[field] = raw
                elif raw.strip():
                    # No PDF form field — render typed name as text overlay
                    sig_overlays.append({
                        "value": raw.strip(),
                        "page": rule.get("page", 0),
                        "rect": rule.get("rect", [0, 0, 200, 50]),
                        "field": "",
                        "text_mode": True,
                    })

        elif rtype == "text_overlay":
            # Overlay text at specific coordinates on a PDF page (no AcroForm field needed)
            raw = "" if value is None else str(value).strip()
            if raw:
                sig_overlays.append({
                    "value": raw,
                    "page": rule.get("page", 0),
                    "rect": rule.get("rect", [0, 0, 200, 20]),
                    "field": "",
                    "text_mode": True,
                    "font_size": rule.get("font_size"),
                    "font": rule.get("font", "Helvetica"),
                    "align": rule.get("align", "L"),
                })

        elif rtype == "tin_split":
            raw = "" if value is None else str(value)
            digits = "".join(ch for ch in raw if ch.isdigit())

            ssn = rule.get("ssn") or []
            ein = rule.get("ein") or []
            prefer = rule.get("prefer", "auto")

            if len(digits) != 9:
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
            field = rule.get("field")
            if field:
                raw = "" if value is None else str(value)
                # Never write data URIs as text — auto-detect as signature overlay
                if raw.startswith("data:image"):
                    out[field] = ""
                    sig_overlays.append({
                        "value": raw,
                        "page": rule.get("page", 0),
                        "rect": rule.get("rect", [0, 0, 200, 50]),
                        "field": field,
                    })
                else:
                    out[field] = value

    return out, sig_overlays
