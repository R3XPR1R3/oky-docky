from __future__ import annotations
import base64
import io
import tempfile
from pathlib import Path
from typing import Dict, Any, List, Optional, Union
from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject, BooleanObject


def _with_name_fallbacks(reader: PdfReader, field_values: Dict[str, Any]) -> Dict[str, Any]:
    """
    Makes filling resilient:
    - if given a long name like form1[0].Page1[0].field[0], also adds the short name field[0]
    - if given a short name but PDF only has the long one — leaves as-is
    """
    fields = reader.get_fields() or {}
    available = set(fields.keys())

    out = dict(field_values)

    for k, v in list(field_values.items()):
        if k in available:
            continue
        if "." in k:
            short = k.split(".")[-1]
            if short not in out:
                out[short] = v

    return out


def _apply_signature_overlays(writer: PdfWriter, overlays: List[Dict[str, Any]]) -> None:
    """Overlay drawn signature images onto PDF pages."""
    if not overlays:
        return

    try:
        from PIL import Image
    except ImportError:
        return

    for overlay in overlays:
        data_url = overlay.get("value", "")
        page_idx = overlay.get("page", 0)
        rect = overlay.get("rect", [0, 0, 200, 50])

        if not data_url.startswith("data:image"):
            continue

        try:
            header, b64_data = data_url.split(",", 1)
            img_bytes = base64.b64decode(b64_data)
        except Exception:
            continue

        if page_idx >= len(writer.pages):
            continue

        x1, y1, x2, y2 = rect
        w = x2 - x1
        h = y2 - y1

        try:
            img = Image.open(io.BytesIO(img_bytes)).convert("RGBA")
            _stamp_with_fpdf2(writer, page_idx, img, x1, y1, w, h)
        except Exception:
            # fpdf2 not available or error — skip image overlay silently
            pass


def _stamp_with_fpdf2(writer: PdfWriter, page_idx: int, img, x: float, y: float, w: float, h: float) -> None:
    """Use fpdf2 to create a stamp PDF and merge onto the target page."""
    from fpdf import FPDF

    page = writer.pages[page_idx]
    media_box = page.mediabox
    page_w = float(media_box.width)
    page_h = float(media_box.height)

    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp_img:
        img.save(tmp_img, "PNG")
        tmp_img_path = tmp_img.name

    # fpdf2 uses top-left origin; PDF uses bottom-left
    fpdf_y = page_h - y - h

    pdf = FPDF(unit="pt", format=(page_w, page_h))
    pdf.add_page()
    pdf.set_auto_page_break(False)
    pdf.image(tmp_img_path, x=x, y=fpdf_y, w=w, h=h)

    stamp_bytes = pdf.output()

    stamp_reader = PdfReader(io.BytesIO(stamp_bytes))
    page.merge_page(stamp_reader.pages[0])

    try:
        Path(tmp_img_path).unlink()
    except Exception:
        pass


def fill_acroform_pdf(
    src_pdf: Union[str, Path],
    field_values: Dict[str, Any],
    out_pdf: Union[str, Path],
    signature_overlays: Optional[List[Dict[str, Any]]] = None,
) -> Path:
    src_pdf = Path(src_pdf)
    out_pdf = Path(out_pdf)
    out_pdf.parent.mkdir(parents=True, exist_ok=True)

    reader = PdfReader(str(src_pdf))

    writer = PdfWriter()
    writer.append_pages_from_reader(reader)

    # copy AcroForm so /Fields and Btn fields update correctly
    root = reader.trailer["/Root"]
    if "/AcroForm" in root:
        writer._root_object.update({NameObject("/AcroForm"): root["/AcroForm"]})
        try:
            writer._root_object["/AcroForm"].update({NameObject("/NeedAppearances"): BooleanObject(True)})
        except Exception:
            pass
    else:
        with out_pdf.open("wb") as f:
            writer.write(f)
        return out_pdf

    # name fallbacks (long -> short)
    safe_values = _with_name_fallbacks(reader, field_values)

    # update form fields on all pages
    for page in writer.pages:
        try:
            writer.update_page_form_field_values(page, safe_values)
        except Exception:
            pass

    # apply drawn signature image overlays
    if signature_overlays:
        _apply_signature_overlays(writer, signature_overlays)

    with out_pdf.open("wb") as f:
        writer.write(f)

    return out_pdf
