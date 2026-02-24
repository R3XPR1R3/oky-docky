from __future__ import annotations

from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Tuple

from pypdf import PdfReader, PdfWriter
from pypdf.generic import IndirectObject
from reportlab.pdfgen import canvas


PDF = "actual/back/data/templates/w4-2026/w4-2026.pdf"
OUT = "actual/back/data/output/w4_labels_overlay.pdf"


def deref(obj: Any) -> Any:
    return obj.get_object() if isinstance(obj, IndirectObject) else obj


def get_widget_info(annot: Dict[str, Any]) -> Tuple[str | None, str | None, List[float] | None]:
    """
    Returns (T, FT, Rect) for a Widget, checking parent if needed.
    """
    parent = deref(annot.get("/Parent"))
    t = annot.get("/T")
    if t is None and isinstance(parent, dict):
        t = parent.get("/T")

    ft = annot.get("/FT")
    if ft is None and isinstance(parent, dict):
        ft = parent.get("/FT")

    rect = annot.get("/Rect")
    rect = deref(rect) if rect is not None else None

    # rect is usually [x0,y0,x1,y1]
    if rect and isinstance(rect, list) and len(rect) == 4:
        try:
            rect = [float(rect[0]), float(rect[1]), float(rect[2]), float(rect[3])]
        except Exception:
            rect = None
    else:
        rect = None

    return (str(t) if t else None, str(ft) if ft else None, rect)


def draw_labels_overlay(page, widgets: List[Tuple[str, str, List[float]]]) -> BytesIO:
    """
    Create a single-page PDF overlay with labels for widgets.
    """
    # Page size in PDF points
    mb = page.mediabox
    w = float(mb.width)
    h = float(mb.height)

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=(w, h))

    # basic styles
    font = "Helvetica"
    font_size = 6  # small, so it doesn't ruin layout
    pad = 1.5

    c.setFont(font, font_size)

    for (name, ft, rect) in widgets:
        x0, y0, x1, y1 = rect
        # label text
        short = name.split(".")[-1]  # show short id even if full path
        label = f"{short} ({ft})"

        # place ABOVE the field box
        lx = x0
        ly = y1 + pad

        # keep inside page bounds a bit
        if ly > h - 8:
            ly = y0 - 8  # if too high, put under
        if lx < 2:
            lx = 2
        if lx > w - 2:
            lx = w - 2

        # draw white background for readability (tiny)
        text_w = c.stringWidth(label, font, font_size)
        bg_h = font_size + 2
        bg_w = text_w + 2
        c.setFillGray(1.0)  # white
        c.rect(lx - 1, ly - 1, bg_w, bg_h, stroke=0, fill=1)

        # draw text
        c.setFillGray(0.0)  # black
        c.drawString(lx, ly, label)

    c.showPage()
    c.save()
    buf.seek(0)
    return buf


def main():
    in_path = Path(PDF)
    out_path = Path(OUT)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    reader = PdfReader(str(in_path))
    writer = PdfWriter()

    for pi, page in enumerate(reader.pages, start=1):
        annots = deref(page.get("/Annots")) or []
        widgets: List[Tuple[str, str, List[float]]] = []

        if isinstance(annots, list):
            for a in annots:
                annot = deref(a)
                if not isinstance(annot, dict):
                    continue
                if annot.get("/Subtype") != "/Widget":
                    continue

                name, ft, rect = get_widget_info(annot)
                if not name or not ft or not rect:
                    continue
                if ft not in ("/Tx", "/Btn"):
                    continue

                widgets.append((name, ft, rect))

        # create overlay and merge
        overlay_pdf = PdfReader(draw_labels_overlay(page, widgets))
        overlay_page = overlay_pdf.pages[0]

        # clone original page into writer then merge overlay
        new_page = page
        new_page.merge_page(overlay_page)

        writer.add_page(new_page)
        print(f"p{pi}: widgets labeled = {len(widgets)}")

    with open(out_path, "wb") as f:
        writer.write(f)

    print("✅ saved:", out_path)


if __name__ == "__main__":
    main()
