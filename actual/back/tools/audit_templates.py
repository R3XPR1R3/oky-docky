from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlparse

from pypdf import PdfReader


ALLOWED_TRANSFORMS = {"derive", "compute", "copy", "concat", "auto_date", "set_value"}
OFFICIAL_SOURCE_HOSTS = {"irs.gov", "www.irs.gov", "uscis.gov", "www.uscis.gov"}


def _mapping_targets(rule: Any) -> Iterable[str]:
    if isinstance(rule, str):
        yield rule
        return
    if isinstance(rule, list):
        yield from (value for value in rule if isinstance(value, str))
        return
    if not isinstance(rule, dict):
        return

    field = rule.get("field")
    if isinstance(field, str):
        yield field

    for key in ("fields", "all_fields", "ssn", "ein"):
        value = rule.get(key)
        if isinstance(value, list):
            yield from (item for item in value if isinstance(item, str))
        elif isinstance(value, dict):
            yield from (item for item in value.values() if isinstance(item, str))

    for choice in rule.get("choices", []) or []:
        if isinstance(choice, dict) and isinstance(choice.get("field"), str):
            yield choice["field"]

    for value_map in (rule.get("mapping") or {}).values():
        if isinstance(value_map, dict):
            yield from (item for item in value_map if isinstance(item, str))


def _widget_names(reader: PdfReader) -> set[str]:
    names: set[str] = set()
    for page in reader.pages:
        for annotation_ref in page.get("/Annots", []) or []:
            annotation = annotation_ref.get_object()
            name = annotation.get("/T")
            if name:
                names.add(str(name))
    return names


def _transform_outputs(transforms: list[dict[str, Any]]) -> set[str]:
    outputs: set[str] = set()
    for rule in transforms:
        for key in ("output", "field", "to"):
            value = rule.get(key)
            if isinstance(value, str) and value:
                outputs.add(value)
        if rule.get("type") == "derive":
            outputs.update(str(key) for key in (rule.get("set") or {}))
    return outputs


def _transform_inputs(transforms: list[dict[str, Any]]) -> set[str]:
    inputs: set[str] = set()
    for rule in transforms:
        for key in ("from", "input"):
            value = rule.get(key)
            if isinstance(value, str) and value:
                inputs.add(value)
        for key in ("inputs", "fields"):
            value = rule.get(key)
            if isinstance(value, list):
                inputs.update(str(item) for item in value)
        inputs.update(str(key) for key in (rule.get("when") or {}))
    return inputs


def audit_template(directory: Path) -> tuple[list[str], list[str], dict[str, Any]]:
    errors: list[str] = []
    warnings: list[str] = []

    try:
        meta = json.loads((directory / "template.json").read_text(encoding="utf-8"))
        schema = json.loads((directory / meta.get("schema", "schema.json")).read_text(encoding="utf-8"))
        mapping = json.loads((directory / meta.get("mapping", "mapping.json")).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return [f"invalid template bundle: {exc}"], warnings, {}

    published = meta.get("published", True) is not False
    pdf_path = directory / str(meta.get("pdf", ""))
    if not pdf_path.is_file():
        return [f"missing PDF: {pdf_path.name}"], warnings, {"published": published}

    try:
        reader = PdfReader(str(pdf_path))
        if reader.is_encrypted:
            errors.append("PDF is encrypted")
        page_count = len(reader.pages)
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
        pdf_fields = set((reader.get_fields() or {}).keys())
        widget_names = _widget_names(reader)
    except Exception as exc:
        return [f"unreadable PDF: {exc}"], warnings, {"published": published}

    quality_messages = []
    if page_count < 1:
        quality_messages.append("PDF has no pages")
    if len(text.strip()) < 1000:
        quality_messages.append(f"PDF has only {len(text.strip())} extractable text characters")
    if re.search(r"DRAFT.{0,80}NOT FOR FILING", text, re.IGNORECASE | re.DOTALL):
        quality_messages.append("PDF is marked DRAFT - NOT FOR FILING")
    (errors if published else warnings).extend(quality_messages)

    fields = schema.get("fields", []) if isinstance(schema, dict) else []
    transforms = schema.get("transforms", []) if isinstance(schema, dict) else []
    question_keys = {str(field.get("key")) for field in fields if isinstance(field, dict) and field.get("key")}
    option_values = {
        str(field["key"]): {
            str(option["value"])
            for option in field.get("options", [])
            if isinstance(option, dict) and "value" in option
        }
        for field in fields
        if isinstance(field, dict) and field.get("key") and field.get("options")
    }

    def validate_conditions(field_key: str, conditions: dict[str, Any]) -> None:
        for dependency, allowed_values in conditions.items():
            if dependency not in question_keys:
                errors.append(f"{field_key}: visibility references unknown question {dependency}")
                continue

            values = allowed_values if isinstance(allowed_values, list) else [allowed_values]
            declared_values = option_values.get(dependency)
            if declared_values is None:
                continue
            unknown_values = sorted({str(value) for value in values} - declared_values)
            if unknown_values:
                errors.append(
                    f"{field_key}: visibility uses unknown {dependency} values: "
                    f"{', '.join(unknown_values)}"
                )

    for field in fields:
        if not isinstance(field, dict):
            errors.append("schema contains a non-object field")
            continue
        field_key = str(field.get("key", "<unknown>"))
        conditions = field.get("visible_when") or {}
        if not isinstance(conditions, dict):
            errors.append(f"{field_key}: visible_when must be an object")
        else:
            validate_conditions(field_key, conditions)
        for group in field.get("visible_when_any", []) or []:
            if not isinstance(group, dict):
                errors.append(f"{field_key}: visible_when_any groups must be objects")
            else:
                validate_conditions(field_key, group)

    unknown_transforms = sorted(
        {str(rule.get("type")) for rule in transforms if rule.get("type") not in ALLOWED_TRANSFORMS}
    )
    if unknown_transforms:
        errors.append(f"unknown transform types: {', '.join(unknown_transforms)}")

    for index, rule in enumerate(transforms, start=1):
        transform_type = rule.get("type")
        if transform_type in {"auto_date", "set_value"} and not rule.get("field"):
            errors.append(f"transform {index} ({transform_type}) is missing field")
        if transform_type in {"compute", "concat"} and not rule.get("output"):
            errors.append(f"transform {index} ({transform_type}) is missing output")
        if transform_type == "copy" and (not rule.get("from") or not rule.get("to")):
            errors.append(f"transform {index} (copy) is missing from/to")

    missing_targets = []
    for key, rule in mapping.items():
        if key.startswith("_"):
            continue
        for target in _mapping_targets(rule):
            if target not in pdf_fields and target not in widget_names:
                missing_targets.append(target)
    if missing_targets:
        errors.append(f"mapping targets missing from PDF: {', '.join(sorted(set(missing_targets)))}")

    transform_outputs = _transform_outputs(transforms)
    transform_inputs = _transform_inputs(transforms)
    mapped_questions = set(mapping) & question_keys
    uncovered = []
    for field in fields:
        key = str(field.get("key", ""))
        if not key or key in mapped_questions or field.get("routing") or field.get("hidden"):
            continue
        if key in transform_outputs or key in transform_inputs:
            continue
        uncovered.append(key)
    if uncovered:
        warnings.append(f"questions do not directly map to PDF fields: {', '.join(sorted(uncovered))}")

    if published:
        source_url = str(meta.get("source_url", ""))
        source_host = urlparse(source_url).hostname or ""
        if source_host not in OFFICIAL_SOURCE_HOSTS:
            errors.append("published template does not declare an approved official source_url")

    summary = {
        "published": published,
        "pages": page_count,
        "pdf_fields": len(pdf_fields),
        "widgets": len(widget_names),
        "questions": len(fields),
        "mapping_keys": len(mapping),
        "text_characters": len(text.strip()),
    }
    return errors, warnings, summary


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit Oky-Docky PDF template bundles.")
    parser.add_argument(
        "templates_root",
        nargs="?",
        type=Path,
        default=Path("actual/back/data/templates"),
    )
    args = parser.parse_args()

    failed = False
    for directory in sorted(path for path in args.templates_root.iterdir() if path.is_dir()):
        errors, warnings, summary = audit_template(directory)
        status = "FAIL" if errors else "OK"
        print(f"[{status}] {directory.name}: {json.dumps(summary, sort_keys=True)}")
        for warning in warnings:
            print(f"  WARN: {warning}")
        for error in errors:
            print(f"  ERROR: {error}")
        failed = failed or bool(errors)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
