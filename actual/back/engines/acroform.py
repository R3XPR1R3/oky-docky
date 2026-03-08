from __future__ import annotations
import base64
import io
import re
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, Any, List, Optional, Union
from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ArrayObject,
    DecodedStreamObject,
    EncodedStreamObject,
    NameObject,
    BooleanObject,
)


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


# ---------------------------------------------------------------------------
# XFA (LiveCycle) form filling
# ---------------------------------------------------------------------------

def _acroform_path_to_xfa_segments(path: str) -> List[str]:
    """Convert 'form1[0].Page1[0].field[0]' → ['form1', 'Page1', 'field']."""
    return [re.sub(r"\[\d+\]$", "", seg) for seg in path.split(".")]


def _build_xfa_leaf_index(root: ET.Element) -> Dict[str, ET.Element]:
    """
    Walk XFA datasets XML and build a flat lookup of all leaf elements.
    Returns {path: element} where path is like 'form1/Page1/section_c/first_name'.
    """
    index: Dict[str, ET.Element] = {}

    def _strip_ns(tag: str) -> str:
        return tag.split("}")[-1] if "}" in tag else tag

    def _walk(el: ET.Element, parts: List[str]) -> None:
        tag = _strip_ns(el.tag)
        current = parts + [tag]
        children = list(el)
        if not children:
            # Leaf element
            index["/".join(current)] = el
        else:
            for child in children:
                _walk(child, current)

    for child in root:
        _walk(child, [])

    return index


def _xfa_value(raw_value: Any) -> str:
    """Convert AcroForm field value to XFA-compatible value."""
    s = "" if raw_value is None else str(raw_value)
    # Checkbox: /1 → 1, /Off → 0, /Yes → 1
    if s == "/1" or s == "/Yes":
        return "1"
    if s == "/Off" or s == "/No":
        return "0"
    if s.startswith("/"):
        return s[1:]
    return s


def _fill_xfa_datasets(writer: PdfWriter, field_values: Dict[str, Any]) -> None:
    """
    Fill XFA datasets XML embedded in the PDF.
    Reads and writes XFA directly in the writer (objects already cloned via clone_from).
    """
    try:
        acroform = writer._root_object["/AcroForm"]
        acro_obj = acroform.get_object() if hasattr(acroform, "get_object") else acroform
    except Exception:
        return
    xfa_array = acro_obj.get("/XFA")
    if not xfa_array:
        return

    # Find the 'datasets' stream in the XFA array
    datasets_idx = None
    for i in range(0, len(xfa_array), 2):
        if str(xfa_array[i]) == "datasets":
            datasets_idx = i + 1
            break
    if datasets_idx is None:
        return

    stream_ref = xfa_array[datasets_idx]
    stream_obj = stream_ref.get_object() if hasattr(stream_ref, "get_object") else stream_ref
    xml_bytes = stream_obj.get_data() if hasattr(stream_obj, "get_data") else b""
    if not xml_bytes:
        return

    # Parse XML
    try:
        xml_text = xml_bytes.decode("utf-8")
        tree_root = ET.fromstring(xml_text)
    except Exception:
        return

    # Find the <xfa:data> element (child of xfa:datasets)
    data_el = None
    for child in tree_root:
        tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
        if tag == "data":
            data_el = child
            break
    if data_el is None:
        return

    # Build index of all leaf elements
    leaf_index = _build_xfa_leaf_index(data_el)

    # Also build a reverse lookup by short name (last segment)
    short_lookup: Dict[str, List[str]] = {}
    for path in leaf_index:
        short_name = path.rsplit("/", 1)[-1]
        short_lookup.setdefault(short_name, []).append(path)

    # Fill values
    filled = 0
    for acro_path, value in field_values.items():
        xfa_val = _xfa_value(value)

        # Strategy 1: exact path match (strip [0] from acroform path)
        segments = _acroform_path_to_xfa_segments(acro_path)
        xfa_path = "/".join(segments)
        if xfa_path in leaf_index:
            leaf_index[xfa_path].text = xfa_val
            filled += 1
            continue

        # Strategy 2: try without the top-level form container
        if len(segments) > 1:
            alt_path = "/".join(segments[1:])
            for lp in leaf_index:
                if lp.endswith("/" + alt_path) or lp == alt_path:
                    leaf_index[lp].text = xfa_val
                    filled += 1
                    break
            else:
                # Strategy 3: match by last 2 segments
                if len(segments) >= 2:
                    tail2 = "/".join(segments[-2:])
                    for lp in leaf_index:
                        if lp.endswith(tail2):
                            leaf_index[lp].text = xfa_val
                            filled += 1
                            break
                    else:
                        # Strategy 4: match by leaf name with parent context
                        leaf_name = segments[-1]
                        candidates = short_lookup.get(leaf_name, [])
                        if len(candidates) == 1:
                            leaf_index[candidates[0]].text = xfa_val
                            filled += 1
                        elif len(candidates) > 1 and len(segments) >= 3:
                            parent_seg = segments[-3] if len(segments) >= 3 else ""
                            for c in candidates:
                                if parent_seg and ("/" + parent_seg + "/") in c:
                                    leaf_index[c].text = xfa_val
                                    filled += 1
                                    break

    if filled == 0:
        return

    # Serialize updated XML back
    new_xml = ET.tostring(tree_root, encoding="unicode", xml_declaration=False)
    new_xml_bytes = new_xml.encode("utf-8")

    # Replace the datasets stream with a new DecodedStreamObject.
    # Even with clone_from, set_data() on EncodedStreamObject may not persist,
    # so create a fresh object and register it.
    try:
        w_xfa = acro_obj.get("/XFA")
        if w_xfa is None:
            return

        new_stream = DecodedStreamObject()
        new_stream.set_data(new_xml_bytes)

        new_ref = writer._add_object(new_stream)
        w_xfa[datasets_idx] = new_ref

    except Exception:
        pass


# ---------------------------------------------------------------------------
# Signature overlays
# ---------------------------------------------------------------------------

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
        text_mode = overlay.get("text_mode", False)

        if page_idx >= len(writer.pages):
            continue

        x1, y1, x2, y2 = rect
        w = x2 - x1
        h = y2 - y1

        if text_mode and data_url.strip():
            # Render typed text directly onto the PDF page
            try:
                _stamp_text_with_fpdf2(writer, page_idx, data_url.strip(), x1, y1, w, h)
            except Exception:
                pass
            continue

        if not data_url.startswith("data:image"):
            continue

        try:
            header, b64_data = data_url.split(",", 1)
            img_bytes = base64.b64decode(b64_data)
        except Exception:
            continue

        try:
            img = Image.open(io.BytesIO(img_bytes)).convert("RGBA")
            _stamp_with_fpdf2(writer, page_idx, img, x1, y1, w, h)
        except Exception:
            # fpdf2 not available or error — skip image overlay silently
            pass


def _stamp_text_with_fpdf2(writer: PdfWriter, page_idx: int, text: str, x: float, y: float, w: float, h: float) -> None:
    """Use fpdf2 to stamp typed signature text onto the target page."""
    from fpdf import FPDF

    page = writer.pages[page_idx]
    media_box = page.mediabox
    page_w = float(media_box.width)
    page_h = float(media_box.height)

    # fpdf2 uses top-left origin; PDF uses bottom-left
    fpdf_y = page_h - y - h

    pdf = FPDF(unit="pt", format=(page_w, page_h))
    pdf.add_page()
    pdf.set_auto_page_break(False)
    pdf.set_font("Courier", "I", size=min(h * 0.8, 12))
    pdf.set_xy(x, fpdf_y)
    pdf.cell(w=w, h=h, text=text, align="L")

    stamp_bytes = pdf.output()
    stamp_reader = PdfReader(io.BytesIO(stamp_bytes))
    page.merge_page(stamp_reader.pages[0])


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


# ---------------------------------------------------------------------------
# Main fill function
# ---------------------------------------------------------------------------

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

    # clone_from properly deep-copies all objects (AcroForm, Fields, XFA)
    # so indirect references stay valid in the writer.
    writer = PdfWriter(clone_from=reader)

    # Ensure viewers regenerate field appearances
    acroform = writer._root_object.get("/AcroForm")
    if acroform is None:
        with out_pdf.open("wb") as f:
            writer.write(f)
        return out_pdf

    try:
        acro_obj = acroform.get_object() if hasattr(acroform, "get_object") else acroform
        acro_obj[NameObject("/NeedAppearances")] = BooleanObject(True)
    except Exception:
        pass

    # name fallbacks (long -> short)
    safe_values = _with_name_fallbacks(reader, field_values)

    # update AcroForm fields on all pages
    for page in writer.pages:
        try:
            writer.update_page_form_field_values(page, safe_values)
        except Exception:
            pass

    # update XFA datasets XML if present
    _fill_xfa_datasets(writer, field_values)

    # apply drawn signature image overlays
    if signature_overlays:
        _apply_signature_overlays(writer, signature_overlays)

    with out_pdf.open("wb") as f:
        writer.write(f)

    return out_pdf
