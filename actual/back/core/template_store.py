from __future__ import annotations
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Any, Optional, List


@dataclass
class TemplateBundle:
    template_id: str
    base_dir: Path
    engine: str
    pdf_path: Path
    schema: Dict[str, Any]
    mapping: Dict[str, Any]
    meta: Dict[str, Any]


def load_template(templates_root: str | Path, template_id: str) -> TemplateBundle:
    templates_root = Path(templates_root)
    base = templates_root / template_id
    if not base.exists():
        raise FileNotFoundError(f"Template folder not found: {base}")

    meta_path = base / "template.json"
    if not meta_path.exists():
        raise FileNotFoundError(f"template.json not found in {base}")

    meta = json.loads(meta_path.read_text(encoding="utf-8"))

    engine = meta.get("engine", "acroform")
    pdf_rel = meta.get("pdf")
    schema_rel = meta.get("schema", "schema.json")
    mapping_rel = meta.get("mapping", "mapping.json")

    if not pdf_rel:
        raise ValueError("template.json must contain 'pdf'")

    pdf_path = base / pdf_rel
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    schema_path = base / schema_rel
    mapping_path = base / mapping_rel

    schema = json.loads(schema_path.read_text(encoding="utf-8")) if schema_path.exists() else {"fields": []}
    mapping = json.loads(mapping_path.read_text(encoding="utf-8")) if mapping_path.exists() else {}

    return TemplateBundle(
        template_id=template_id,
        base_dir=base,
        engine=engine,
        pdf_path=pdf_path,
        schema=schema,
        mapping=mapping,
        meta=meta,
    )


def load_template_meta(templates_root: str | Path, template_id: str) -> Dict[str, Any]:
    """Load just the template.json metadata (without reading schema/mapping/pdf)."""
    base = Path(templates_root) / template_id
    meta_path = base / "template.json"
    if not meta_path.exists():
        raise FileNotFoundError(f"template.json not found in {base}")
    return json.loads(meta_path.read_text(encoding="utf-8"))


def list_templates(templates_root: str | Path) -> List[str]:
    root = Path(templates_root)
    if not root.exists():
        return []
    return sorted([p.name for p in root.iterdir() if p.is_dir()])
