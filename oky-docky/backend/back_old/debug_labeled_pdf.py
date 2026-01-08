from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Dict, List, Tuple, Optional
from pathlib import Path
import io

from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas

Rect = Tuple[float, float, float, float]  # [x1, y1, x2, y2]

def short_id(full_id: str) -> str:
    # topmostSubform[0].Page1[0].Step1a[0].f1_01[0] -> f1_01[0]
    return full_id.split(".")[-1] if "." in full_id else full_id

def overlay_for_page(page_w: float, page_h: float, items: List[Tuple[Rect, str, str]]) -> bytes:
    """
    items: [(rect, short_label, full_label), ...]
    """
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(page_w, page_h))

    # тонкая сетка-ориентир (можешь убрать)
    # c.setLineWidth(0.2)

    for (x1, y1, x2, y2), s_id, f_id in items:
        # рамка
        c.setLineWidth(1)
        c.rect(x1, y1, max(0, x2-x1), max(0, y2-y1), stroke=1, fill=0)

        # подпись
        tx = x1 + 2
        ty = y2 + 2
        c.setFont("Helvetica", 7)
        c.drawString(tx, ty, s_id)

        c.setFont("Helvetica", 5)
        c.drawString(tx, ty + 8, f_id[:120])

    c.showPage()
    c.save()
    return buf.getvalue()

def build_labeled_pdf(template_pdf_path: str | Path, schema: Dict[str, Any]) -> bytes:
    reader = PdfReader(str(template_pdf_path))
    writer = PdfWriter()

    # соберём по страницам
    per_page: Dict[int, List[Tuple[Rect, str, str]]] = {}
    for f in schema.get("fields", []):
        fid = f.get("id")
        rects = f.get("rects") or []
        if not fid or not rects:
            continue
        for r in rects:
            p = int(r["page_index"])
            x1, y1, x2, y2 = r["rect"]
            per_page.setdefault(p, []).append(((x1, y1, x2, y2), short_id(fid), fid))

    for i, page in enumerate(reader.pages):
        mb = page.mediabox
        w = float(mb.width)
        h = float(mb.height)

        items = per_page.get(i, [])
        if items:
            overlay_pdf = PdfReader(io.BytesIO(overlay_for_page(w, h, items)))
            page.merge_page(overlay_pdf.pages[0])

        writer.add_page(page)

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()
