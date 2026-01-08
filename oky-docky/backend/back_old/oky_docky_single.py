#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
oky-docky — однофайловый рендер PDF из Figma-like JSON.
Сюда сведены:
- валидация/нормализация JSON
- парсинг PLACEHOLDER'ов и чекбоксов
- извлечение TEXT/RECTANGLE/VECTOR/IMAGE
- рисование через reportlab
"""

from __future__ import annotations

# =========================
# Imports
# =========================
import base64
import io
import json
import math
import os
import re
import tempfile
from typing import Any, Dict, List, Optional, Tuple

import reportlab
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

try:
    from svgelements import Path as SvgPath
    _HAS_SVG = True
except Exception:
    _HAS_SVG = False

# =========================
# Regexes / tokens
# =========================
PAGE_TAG_RE = re.compile(r"\[\{page:(\d+)\}\]")
VAR_TOKEN_RE = re.compile(r"\[\{\s*([A-Za-z0-9_.:\-]+)\s*\}\]")
VAR_TOKEN_RE_ADV = re.compile(
    r"\[\{\s*"
    r"(?P<var>[A-Za-z0-9_.:\-]+)"
    r"(?:\s*;\s*(?:max|maxlength|max_length)\s*=\s*(?P<max>\d+))?"
    r"\s*\}\]"
)
CB_TOKEN_RE = re.compile(r"\[\<\s*cbid\s*:\s*([A-Za-z0-9_.\-]+)\s*\>\]")
CBWRAP_TAG_RE = re.compile(r"\[\{\s*cbwrap\s*:\s*([A-Za-z0-9_.\-]+)\s*\}\]")

# ASCII чекбоксы по умолчанию (если нужно — включи юникод)
USE_UNICODE_CHECKMARKS = False


# =========================
# Utils
# =========================
def json_scraper(file_path: str) -> Optional[dict]:
    """Прочитать JSON-файл."""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        print("JSON file loaded successfully.")
        return data
    except FileNotFoundError:
        print("File not found. Please check the path and try again.")
    except json.JSONDecodeError:
        print("Error decoding JSON. Please check the file format.")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
    return None


def iter_nodes(node: Any):
    """Генератор обхода дерева dict/list."""
    if isinstance(node, dict):
        yield node
        for v in node.values():
            yield from iter_nodes(v)
    elif isinstance(node, list):
        for it in node:
            yield from iter_nodes(it)


def _bounds(node: dict) -> Tuple[float, float, float, float]:
    """absoluteRenderBounds приоритетнее, иначе x/y/width/height"""
    arb = node.get("absoluteRenderBounds")
    if isinstance(arb, dict):
        return (
            float(arb.get("x", 0)),
            float(arb.get("y", 0)),
            float(arb.get("width", 0)),
            float(arb.get("height", 0)),
        )
    return (
        float(node.get("x", 0)),
        float(node.get("y", 0)),
        float(node.get("width", 0)),
        float(node.get("height", 0)),
    )


def _first_solid_fill(node: dict) -> Optional[dict]:
    for f in (node.get("fills") or []):
        if f and f.get("type") == "SOLID" and f.get("visible", True):
            return f
    return None


def _rgba_from_fill(fill: Optional[dict], node_opacity: float = 1.0):
    if not fill:
        return (None, None)
    c = fill.get("color") or {}
    r, g, b = float(c.get("r", 0)), float(c.get("g", 0)), float(c.get("b", 0))
    a = float(fill.get("opacity", 1.0)) * float(node_opacity if node_opacity is not None else 1.0)
    a = max(0.0, min(1.0, a))
    return (r, g, b, a), (
        int(round(r * 255)),
        int(round(g * 255)),
        int(round(b * 255)),
        int(round(a * 255)),
    )


def _set_fill_color255(c: canvas.Canvas, rgba255: Optional[Tuple[int, int, int, int]]):
    if not rgba255:
        return
    r, g, b, a = rgba255
    c.setFillColorRGB(r / 255.0, g / 255.0, b / 255.0)
    try:
        c.setFillAlpha(a / 255.0)
    except Exception:
        pass

def _draw_watermark(c, page_w, page_h, text="PREVIEW", alpha=0.10):
    """Рисует полупрозрачный водяной знак на странице."""
    c.saveState()
    try:
        c.setFillAlpha(alpha)  # если ReportLab поддерживает прозрачность
    except Exception:
        pass
    c.setFillColorRGB(0.0, 0.0, 0.0)
    c.translate(page_w / 2, page_h / 2)
    c.rotate(45)
    c.setFont("Helvetica-Bold", 72)
    c.drawCentredString(0, 0, text)
    c.restoreState()


def _cb_symbol(state: str) -> str:
    s = (state or "").strip().upper()
    if USE_UNICODE_CHECKMARKS:
        return {"YES": "☑", "NO": "☒", "SKIP": "☐"}.get(s, "☐")
    return {"YES": "[+]", "NO": "[X]", "SKIP": "[ ]"}.get(s, "[ ]")


def _find_cbwrap_id(node: dict, root: Any) -> Optional[str]:
    """Поднимаемся по родителям в поиске имени FRAME со спец-тегом cbwrap."""
    parent_of: Dict[int, Any] = {}

    def _walk(n: Any, parent: Any = None):
        if isinstance(n, dict):
            parent_of[id(n)] = parent
            for v in n.values():
                _walk(v, n)
        elif isinstance(n, list):
            for it in n:
                _walk(it, parent)

    _walk(root, None)
    cur = node
    while cur is not None:
        if isinstance(cur, dict):
            name = cur.get("name", "") or ""
            m = CBWRAP_TAG_RE.search(name)
            if m:
                return m.group(1)
        cur = parent_of.get(id(cur))
    return None


def _find_parent_frame_and_page(node: dict, root: Any):
    """Ищем ближайший FRAME-родитель, читаем [{page:N}]."""
    parent_of: Dict[int, Any] = {}

    def _walk(n: Any, parent: Any = None):
        if isinstance(n, dict):
            parent_of[id(n)] = parent
            for v in n.values():
                _walk(v, n)
        elif isinstance(n, list):
            for it in n:
                _walk(it, parent)

    _walk(root, None)
    cur = node
    while cur is not None:
        if isinstance(cur, dict) and cur.get("type") == "FRAME":
            name = cur.get("name", "")
            m = PAGE_TAG_RE.search(name)
            page = int(m.group(1)) if m else None
            fx, fy, fw, fh = _bounds(cur)
            return (fx, fy, fw, fh), page
        cur = parent_of.get(id(cur))
    return None, None


# =========================
# Placeholders & CB
# =========================
def _apply_max_length(val: Any, m: Optional[int]) -> str:
    if val is None:
        return ""
    s = str(val)
    if m is None:
        return s
    try:
        m = int(m)
    except Exception:
        return s
    return s[: max(0, m)]


def substitute_vars_adv(text: str, values: dict, missing_policy: str = "leave") -> str:
    """Поддержка [{name;max=16}] / [{name}]"""
    def _repl(m: re.Match) -> str:
        key = m.group("var")
        max_len = m.group("max")
        if key in values and values[key] is not None:
            return _apply_max_length(values[key], int(max_len) if max_len else None)
        if missing_policy == "empty":
            return ""
        if missing_policy == "guess":
            return f"<{key}?>"
        return m.group(0)
    return VAR_TOKEN_RE_ADV.sub(_repl, text)


def substitute_vars(text: str, values: dict, missing_policy: str = "leave") -> str:
    """Простая замена [{KEY}] → values[KEY]."""
    def _repl(m: re.Match) -> str:
        key = m.group(1)
        if key in values and values[key] is not None:
            return str(values[key])
        if missing_policy == "empty":
            return ""
        if missing_policy == "guess":
            return f"<{key}?>"
        return m.group(0)
    return VAR_TOKEN_RE.sub(_repl, text)


def _render_cb_tokens(text: str, values: dict, cb_counters: Optional[Dict[str, int]] = None) -> str:
    """
    values:
      - группы: values["cbgroup:<gid>"] = {"yes_index": k, "else": "NO"/"SKIP"}
      - одиночные: values["cbgroup:<gid>"] = {"single": "YES"/"NO"/"SKIP"}
      - legacy:    values["cbid:<gid>"]    = "YES"/"NO"/"SKIP"
    """
    if cb_counters is None:
        cb_counters = {}

    def _decide_symbol(gid: str) -> str:
        pref = (values or {}).get(f"cbgroup:{gid}")
        legacy = (values or {}).get(f"cbid:{gid}", "")
        if pref is None and legacy:
            return _cb_symbol(legacy)

        idx = cb_counters.get(gid, 0) + 1
        cb_counters[gid] = idx

        if not pref:
            return _cb_symbol("SKIP")

        if "single" in pref:
            return _cb_symbol(pref["single"])

        yes_index = int(pref.get("yes_index", 0))
        else_policy = pref.get("else", "NO")
        return _cb_symbol("YES" if idx == yes_index else else_policy)

    def _repl(m: re.Match) -> str:
        gid = m.group(1)
        return _decide_symbol(gid)

    return CB_TOKEN_RE.sub(_repl, text)


def collect_placeholders_from_text_nodes(root: Any) -> List[str]:
    keys = set()
    for n in iter_nodes(root):
        if isinstance(n, dict) and n.get("type") == "TEXT":
            txt = (n.get("characters") or "")
            for m in VAR_TOKEN_RE_ADV.finditer(txt):
                keys.add(m.group("var"))
    return sorted(keys)


def count_cb_occurrences(root: Any) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for n in iter_nodes(root):
        if isinstance(n, dict) and n.get("type") == "TEXT":
            txt = (n.get("characters") or "")
            for m in CB_TOKEN_RE.finditer(txt):
                gid = m.group(1)
                counts[gid] = counts.get(gid, 0) + 1
    return counts


def collect_cbids_from_text_nodes(root: Any) -> List[str]:
    ids = set()
    for n in iter_nodes(root):
        if isinstance(n, dict) and n.get("type") == "TEXT":
            txt = (n.get("characters") or "")
            for m in CB_TOKEN_RE.finditer(txt):
                ids.add(m.group(1))
    return sorted(ids)


# =========================
# Page frames
# =========================
def extract_page_frames(root: Any) -> List[dict]:
    pages: List[dict] = []
    for n in iter_nodes(root):
        if not isinstance(n, dict):
            continue
        if n.get("type") != "FRAME":
            continue
        name = n.get("name", "")
        m = PAGE_TAG_RE.search(name)
        if not m:
            continue
        try:
            pages.append({
                "num": int(m.group(1)),
                "name": name,
                "w": float(n.get("width", 612)),
                "h": float(n.get("height", 792)),
                "node": n
            })
        except (TypeError, ValueError):
            pass

    seen, out = set(), []
    for p in sorted(pages, key=lambda x: x["num"]):
        if p["num"] in seen:
            continue
        seen.add(p["num"])
        out.append(p)
    return out


# =========================
# TEXT
# =========================
def extract_text_nodes(root: Any, only_visible: bool = True) -> List[dict]:
    out: List[dict] = []
    for n in iter_nodes(root):
        if not isinstance(n, dict):
            continue
        if only_visible and n.get("visible") is False:
            continue
        if n.get("type") != "TEXT":
            continue

        wrap_id = _find_cbwrap_id(n, root)
        x, y, w, h = _bounds(n)
        frame_bbox, page_num = _find_parent_frame_and_page(n, root)
        rel_x = rel_y_top = None
        if frame_bbox:
            fx, fy, fw, fh = frame_bbox
            rel_x = x - fx
            rel_y_top = y - fy

        out.append({
            "cbwrap": wrap_id,
            "text": n.get("characters", ""),
            "x": x, "y": y, "w": w, "h": h,
            "rel_x": rel_x, "rel_y_top": rel_y_top,
            "font_family": (n.get("fontName", {}) or {}).get("family", "Helvetica"),
            "font_size": float(n.get("fontSize", 12)),
            "fill_rgba_255": _rgba_from_fill(_first_solid_fill(n), n.get("opacity", 1))[1],
            "page": page_num,
            "node": n
        })
    return out


def _shrink_font_to_fit(c: canvas.Canvas, text: str, font_name: str, font_size: float,
                        max_width: float, min_font_size: float = 6.0) -> float:
    fs = float(font_size)
    while fs > min_font_size and c.stringWidth(text, font_name, fs) > max_width:
        fs -= 0.5
    return max(fs, min_font_size)


def _draw_wrapped_lines(c: canvas.Canvas, text: str, x: float, baseline_y: float, box_w: float,
                        line_h: float, font_name: str, font_size: float):
    lines: List[str] = []
    for para in (text or "").split("\n"):
        words = para.split()
        if not words:
            lines.append("")
            continue
        cur = words[0]
        for w in words[1:]:
            test = cur + " " + w
            if c.stringWidth(test, font_name, font_size) <= box_w:
                cur = test
            else:
                lines.append(cur)
                cur = w
        lines.append(cur)
    y = baseline_y
    for ln in lines:
        c.drawString(x, y, ln)
        y -= line_h


def draw_text_node(c: canvas.Canvas, t: dict, page_h: float, values: Optional[dict] = None,
                   shrink_to_fit: bool = True, wrap_if_needed: bool = True,
                   cb_counters: Optional[Dict[str, int]] = None):
    if t["page"] is None:
        return

    rel_x, rel_y_top = t["rel_x"], t["rel_y_top"]
    w, h, fs = t["w"], t["h"], t["font_size"]
    raw_text = t.get("text", "")

    if values:
        raw_text = substitute_vars_adv(raw_text, values, missing_policy="leave")

        wrap_id = t.get("cbwrap")
        if wrap_id and (values.get(f"cbid:{wrap_id}", "").strip().upper() == "SKIP"):
            print(f"[cbwrap] skip group {wrap_id} -> hide text node")
            return

        raw_text = _render_cb_tokens(raw_text, values, cb_counters=cb_counters)

    pdf_y = page_h - (rel_y_top + h)
    _set_fill_color255(c, t["fill_rgba_255"])

    font_name = t["font_family"] or "Helvetica"
    try:
        c.setFont(font_name, fs)
    except Exception:
        font_name = "Helvetica"
        c.setFont(font_name, fs)

    if shrink_to_fit and c.stringWidth(raw_text, font_name, fs) > w and not wrap_if_needed:
        fs = _shrink_font_to_fit(c, raw_text, font_name, fs, w)
        c.setFont(font_name, fs)

    baseline = pdf_y + (h - fs) * 0.8

    if wrap_if_needed and c.stringWidth(raw_text, font_name, fs) > w:
        line_h = fs * 1.2
        _draw_wrapped_lines(c, raw_text, rel_x, baseline, w, line_h, font_name, fs)
    else:
        c.drawString(rel_x, baseline, raw_text)


# =========================
# RECTANGLE
# =========================
def extract_rectangles(root: Any) -> List[dict]:
    out: List[dict] = []
    for n in iter_nodes(root):
        if not isinstance(n, dict):
            continue
        if n.get("type") != "RECTANGLE":
            continue
        x, y, w, h = _bounds(n)
        frame_bbox, page_num = _find_parent_frame_and_page(n, root)
        rel_x = rel_y_top = None
        if frame_bbox:
            fx, fy, fw, fh = frame_bbox
            rel_x = x - fx
            rel_y_top = y - fy
        fill = _first_solid_fill(n)
        rgba255 = _rgba_from_fill(fill, n.get("opacity", 1))[1]
        out.append({
            "x": x, "y": y, "w": w, "h": h,
            "rel_x": rel_x, "rel_y_top": rel_y_top,
            "fill_rgba_255": rgba255,
            "page": page_num,
            "node": n
        })
    return out


def draw_rectangle_node(c: canvas.Canvas, r: dict, page_h: float, stroke: int = 0):
    if r["page"] is None:
        return
    _set_fill_color255(c, r["fill_rgba_255"])
    pdf_y = page_h - (r["rel_y_top"] + r["h"])
    c.rect(r["rel_x"], pdf_y, r["w"], r["h"], stroke=stroke, fill=1)


# =========================
# VECTOR
# =========================
def extract_vectors(root: Any) -> List[dict]:
    out: List[dict] = []
    for n in iter_nodes(root):
        if not isinstance(n, dict) or n.get("type") != "VECTOR":
            continue
        x, y, w, h = _bounds(n)
        frame_bbox, page_num = _find_parent_frame_and_page(n, root)
        rel_x = rel_y_top = None
        if frame_bbox:
            fx, fy, fw, fh = frame_bbox
            rel_x = x - fx
            rel_y_top = y - fy
        fill = _first_solid_fill(n)
        rgba255 = _rgba_from_fill(fill, n.get("opacity", 1))[1]
        paths = [
            g.get("data") for g in (n.get("fillGeometry") or [])
            if isinstance(g, dict) and g.get("data")
        ]
        out.append({
            "x": x, "y": y, "w": w, "h": h,
            "rel_x": rel_x, "rel_y_top": rel_y_top,
            "color_rgba_255": rgba255,
            "paths": paths,
            "page": page_num,
            "node": n
        })
    return out


def draw_vector_node(c: canvas.Canvas, v: dict, page_h: float):
    if v.get("page") is None:
        return

    if not v.get("paths") or not _HAS_SVG:
        _set_fill_color255(c, v.get("color_rgba_255"))
        pdf_y = page_h - (v["rel_y_top"] + v["h"])
        c.rect(v["rel_x"], pdf_y, v["w"], v["h"], stroke=0, fill=1)
        return

    _set_fill_color255(c, v.get("color_rgba_255"))

    for d in v["paths"]:
        sp = SvgPath(d)
        bbox = sp.bbox()
        if bbox is None:
            xmin, ymin, xmax, ymax = 0.0, 0.0, max(1.0, v["w"]), max(1.0, v["h"])
        else:
            xmin, ymin, xmax, ymax = bbox
            if None in (xmin, ymin, xmax, ymax) or xmax == xmin or ymax == ymin:
                xmin, ymin, xmax, ymax = 0.0, 0.0, max(1.0, v["w"]), max(1.0, v["h"])

        # Локальные координаты: вписать путь в рамку ноды, ось Y переворачиваем
        c.saveState()
        bottom = page_h - (v["rel_y_top"] + v["h"])
        c.translate(v["rel_x"], bottom + v["h"])
        c.scale(1, -1)
        c.translate(-xmin, -ymin)

        p = c.beginPath()
        has_current_point = False

        for seg in sp:
            cls = seg.__class__.__name__
            s = getattr(seg, "start", None)
            e = getattr(seg, "end", None)

            if cls == "Move":
                if e is not None:
                    p.moveTo(e.x, e.y)
                    has_current_point = True
                continue

            if not has_current_point:
                if s is not None:
                    p.moveTo(s.x, s.y)
                elif e is not None:
                    p.moveTo(e.x, e.y)
                has_current_point = True

            if cls == "Line" and e is not None:
                p.lineTo(e.x, e.y)

            elif cls == "CubicBezier" and e is not None:
                c1 = getattr(seg, "control1", None)
                c2 = getattr(seg, "control2", None)
                if c1 is not None and c2 is not None:
                    p.curveTo(c1.x, c1.y, c2.x, c2.y, e.x, e.y)
                else:
                    p.lineTo(e.x, e.y)

            elif cls in ("QuadraticBezier", "Arc"):
                for cubic in seg.as_cubic_curves():
                    p.curveTo(
                        cubic.control1.x, cubic.control1.y,
                        cubic.control2.x, cubic.control2.y,
                        cubic.end.x, cubic.end.y
                    )

            elif cls == "Close":
                p.close()

            else:
                if e is not None:
                    p.lineTo(e.x, e.y)

        c.drawPath(p, stroke=0, fill=1)
        c.restoreState()


# =========================
# IMAGE
# =========================
def _image_bytes_from_node(n: dict, external_images: Optional[Dict[str, bytes]] = None) -> Optional[bytes]:
    """Возвращает bytes картинки: либо embedded base64, либо по ссылке/маппингу."""
    b64 = n.get("imageBytes")
    if b64:
        try:
            return base64.b64decode(b64)
        except Exception:
            pass
    ref = n.get("imageRef")
    if ref and isinstance(external_images, dict) and ref in external_images:
        return external_images[ref]
    if ref and isinstance(ref, str) and os.path.exists(ref):
        with open(ref, "rb") as f:
            return f.read()
    return None


def extract_images(root: Any, external_images: Optional[Dict[str, bytes]] = None) -> List[dict]:
    out: List[dict] = []

    # Явные IMAGE-ноды
    for n in iter_nodes(root):
        if not isinstance(n, dict):
            continue
        if n.get("type") == "IMAGE":
            x, y, w, h = _bounds(n)
            frame_bbox, page_num = _find_parent_frame_and_page(n, root)
            rel_x = rel_y_top = None
            if frame_bbox:
                fx, fy, fw, fh = frame_bbox
                rel_x = x - fx
                rel_y_top = y - fy
            img_bytes = _image_bytes_from_node(n, external_images)
            out.append({
                "x": x, "y": y, "w": w, "h": h,
                "rel_x": rel_x, "rel_y_top": rel_y_top,
                "page": page_num,
                "image_bytes": img_bytes,
                "node": n
            })

    # RECTANGLE с IMAGE fill
    for n in iter_nodes(root):
        if not isinstance(n, dict):
            continue
        if n.get("type") != "RECTANGLE":
            continue

        img_fill = None
        for f in (n.get("fills") or []):
            if f and f.get("type") == "IMAGE" and f.get("visible", True):
                img_fill = f
                break
        if not img_fill:
            continue

        x, y, w, h = _bounds(n)
        frame_bbox, page_num = _find_parent_frame_and_page(n, root)
        rel_x = rel_y_top = None
        if frame_bbox:
            fx, fy, fw, fh = frame_bbox
            rel_x = x - fx
            rel_y_top = y - fy

        img_bytes = None
        if "imageBytes" in img_fill:
            try:
                img_bytes = base64.b64decode(img_fill["imageBytes"])
            except Exception:
                img_bytes = None

        if not img_bytes and "imageRef" in img_fill:
            img_bytes = _image_bytes_from_node({"imageRef": img_fill["imageRef"]}, external_images)

        out.append({
            "x": x, "y": y, "w": w, "h": h,
            "rel_x": rel_x, "rel_y_top": rel_y_top,
            "page": page_num,
            "image_bytes": img_bytes,
            "node": n
        })

    return out


def draw_image_node(c: canvas.Canvas, im: dict, page_h: float, preserve_aspect: bool = True):
    if im["page"] is None:
        return
    pdf_y = page_h - (im["rel_y_top"] + im["h"])

    if not im["image_bytes"]:
        # нет байтов → просто рамка
        c.rect(im["rel_x"], pdf_y, im["w"], im["h"], stroke=1, fill=0)
        return

    img = ImageReader(io.BytesIO(im["image_bytes"]))
    if not preserve_aspect:
        c.drawImage(img, im["rel_x"], pdf_y, width=im["w"], height=im["h"], mask="auto")
    else:
        iw, ih = img.getSize()
        sx, sy = im["w"] / iw, im["h"] / ih
        s = min(sx, sy)
        dw, dh = iw * s, ih * s
        ox = im["rel_x"] + (im["w"] - dw) / 2.0
        oy = pdf_y + (im["h"] - dh) / 2.0
        c.drawImage(img, ox, oy, width=dw, height=dh, mask="auto")


# =========================
# Validation / Normalization
# =========================
def normalize_root(json_data: Any) -> Any:
    """dict: document|self; list: вернуть как есть; иначе {}."""
    if isinstance(json_data, dict):
        print("Normalizing JSON root: dict detected.")
        return json_data.get("document", json_data)
    if isinstance(json_data, list):
        print("Normalizing JSON root: list detected.")
        return json_data
    print("Invalid JSON: expected dict or list, got", type(json_data))
    return {}


def validate_json_structure(json_data: Any) -> Tuple[bool, Optional[Any]]:
    root = normalize_root(json_data)
    print("Validating JSON structure...")

    if isinstance(root, dict) and root:
        print("Valid JSON: non-empty dict.")
        return True, root

    if isinstance(root, list) and any(isinstance(x, dict) for x in root):
        print("Valid JSON: list with dict items.")
        return True, root

    print("Invalid JSON: expected non-empty dict or list with dict items.")
    return False, None


# =========================
# Render orchestration
# =========================
def extract_vectors_text_rects_imgs(root: Any):
    pages = extract_page_frames(root)
    texts = extract_text_nodes(root, only_visible=True)
    rects = extract_rectangles(root)
    vecs = extract_vectors(root)
    imgs = extract_images(root, external_images=None)
    return pages, texts, rects, vecs, imgs


def render_pdf(figma_json_root: Any, out_path: str,
               external_images: Optional[Dict[str, bytes]] = None,
               values: Optional[Dict[str, Any]] = None,
               watermark: bool = False) -> str:
    pages = extract_page_frames(figma_json_root)
    texts = extract_text_nodes(figma_json_root, only_visible=True)
    rects = extract_rectangles(figma_json_root)
    vecs = extract_vectors(figma_json_root)
    imgs = extract_images(figma_json_root, external_images=external_images)
    

    print(f"Found {len(pages)} pages, {len(texts)} texts, {len(rects)} rectangles, {len(vecs)} vectors, {len(imgs)} images.")
    print("Preparing to render PDF...")
    print("--------------------------------------------------")

    if not pages:
        pages = [{"num": 1, "name": "Letter[{page:1}]", "w": 612, "h": 792, "node": None}]

    by_page_texts: Dict[int, List[dict]] = {}
    by_page_rects: Dict[int, List[dict]] = {}
    by_page_vecs: Dict[int, List[dict]] = {}
    by_page_imgs: Dict[int, List[dict]] = {}
    cb_counters: Dict[str, int] = {}

    for p in pages:
        by_page_texts[p["num"]] = []
        by_page_rects[p["num"]] = []
        by_page_vecs[p["num"]] = []
        by_page_imgs[p["num"]] = []

    for t in texts:
        if t["page"] in by_page_texts:
            by_page_texts[t["page"]].append(t)
    for r in rects:
        if r["page"] in by_page_rects:
            by_page_rects[r["page"]].append(r)
    for v in vecs:
        if v["page"] in by_page_vecs:
            by_page_vecs[v["page"]].append(v)
    for i in imgs:
        if i["page"] in by_page_imgs:
            by_page_imgs[i["page"]].append(i)

    print(f"Rendering {len(pages)} pages to PDF: {out_path}")
    c = canvas.Canvas(out_path, pagesize=(pages[0]["w"], pages[0]["h"]))
    print("Canvas created with initial page size:", pages[0]["w"], "x", pages[0]["h"])
    print("_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-")

    for idx, p in enumerate(pages):
        if idx > 0:
            c.setPageSize((p["w"], p["h"]))
        page_h = float(p["h"])
        print(f"Rendering page {p['num']} ({p['name']}) with size {p['w']}x{p['h']}")

        for r in by_page_rects.get(p["num"], []):
            draw_rectangle_node(c, r, page_h)

        for v in by_page_vecs.get(p["num"], []):
            draw_vector_node(c, v, page_h)

        for im in by_page_imgs.get(p["num"], []):
            draw_image_node(c, im, page_h)

        for t in by_page_texts.get(p["num"], []):
            draw_text_node(c, t, page_h, values=values, shrink_to_fit=True, wrap_if_needed=True, cb_counters=cb_counters)
        if watermark:
            _draw_watermark(c, p["w"], p["h"], text="OKY DOCKY • PREVIEW", alpha=0.12)

        c.showPage()

    c.save()
    return out_path


def render_pdf_from_json(json_data: Any, output_path: str,
                         external_images: Optional[Dict[str, bytes]] = None,
                         values: Optional[Dict[str, Any]] = None) -> str:
    return render_pdf(json_data, output_path, external_images=external_images, values=values)


def run_validation_and_render(json_file_path: str, output_pdf_path: str,
                              external_images: Optional[Dict[str, bytes]] = None,
                              values: Optional[Dict[str, Any]] = None) -> Optional[str]:
    json_data = json_scraper(json_file_path)
    if not json_data:
        print("Failed to load JSON data.")
        return None

    ok, root = validate_json_structure(json_data)
    if not ok or root is None:
        print("JSON structure validation failed.")
        return None

    print("JSON structure is valid. Proceeding to render PDF...")
    pages = extract_page_frames(root)
    print("PAGES:", [(p["num"], p["name"]) for p in pages])
    print("Total pages found:", len(pages))
    if not pages:
        print("No pages found. Will render single default page.")
        pages = [{"num": 1, "name": "Default Page", "w": 612, "h": 792, "node": None}]
    return render_pdf_from_json(root, output_pdf_path, external_images=external_images or {}, values=values or {})


# =========================
# API-friendly wrappers
# =========================
def render_pdf_from_template_path(
    template_path: str,
    values: Optional[Dict[str, Any]] = None,
    external_images: Optional[Dict[str, bytes]] = None,
    out_dir: Optional[str] = None,
    out_name: Optional[str] = None,
) -> str:
    data = json_scraper(template_path)
    if data is None:
        raise ValueError("Template file not found or invalid JSON")
    ok, root = validate_json_structure(data)
    if not ok or root is None:
        raise ValueError("Invalid JSON structure for template")

    if out_dir is None:
        out_dir = tempfile.mkdtemp(prefix="okydocky_")
    if out_name is None:
        base = os.path.splitext(os.path.basename(template_path))[0]
        out_name = f"{base}.pdf"

    out_path = os.path.join(out_dir, out_name)
    return render_pdf_from_json(root, out_path, external_images=external_images or {}, values=values or {})


from typing import Dict, Any, List

def introspect_template_path(template_path: str) -> Dict[str, Any]:
    """
    Загружает JSON-шаблон, валидирует и вытаскивает:
    - placeholders: список текстовых плейсхолдеров (как раньше)
    - cb_counts: сырая инфа по чекбоксам (как раньше)
    - fields: единый список полей для фронта:
        [
          {"kind": "text", "key": "first_name", "order": 0},
          {"kind": "text", "key": "last_name",  "order": 1},
          {"kind": "checkbox", "group_id": "cb1",
           "options": ["cb1.opt1", "cb1.opt2"], "exclusive": True, "order": 2},
          ...
        ]
    """
    data = json_scraper(template_path)
    if data is None:
        raise ValueError("Template file not found or invalid JSON")

    ok, root = validate_json_structure(data)
    if not ok or root is None:
        raise ValueError("Invalid template JSON structure")

    # то, что уже было
    placeholders: List[str] = collect_placeholders_from_text_nodes(root)
    cb_counts: Dict[str, int] = count_cb_occurrences(root)
    


    # --- группируем чекбоксы по "cb1", "cb1.opt1" и т.п. ---
    # ожидаем, что ключи в cb_counts выглядят типа:
    #   "cb1" или "cb1.opt1", "cb1.opt2"
    checkbox_groups: Dict[str, List[str]] = {}

    for cb_key in cb_counts.keys():
        if "." in cb_key:
            group_id, _ = cb_key.split(".", 1)
        else:
            group_id = cb_key
        checkbox_groups.setdefault(group_id, []).append(cb_key)

    # --- собираем единый список полей ---
    fields: List[Dict[str, Any]] = []
    order = 0

    # текстовые плейсхолдеры
    for key in placeholders:
        fields.append({
            "kind": "text",
            "key": key,
            "order": order,
            # сюда потом можно добавить "page", "x", "y", если появятся
        })
        order += 1

    # чекбокс-группы
    for group_id, count in checkbox_groups.items():
        fields.append({
            "kind": "checkbox",
            "group_id": group_id,
            "count": count,       # 👈 вот это важно
            
            "exclusive": True,   # пока считаем, что это радио-группа; можно сделать настройкой
            "order": order,
        })
        order += 1

    # на всякий случай сортируем по order (если выше когда-нибудь сменишь цикл)
    fields.sort(key=lambda f: f["order"])

    return {
        "placeholders": placeholders,
        "cb_counts": cb_counts,
        "fields": fields,
    }


#=======================================

#stop! here is the pdf processor module


#=======================================


# ============================================================
# PDF (AcroForm) parsing + filling (ADD-ON, ничего не вырезаем)
# ============================================================
#
# Что это даёт:
# 1) introspect_pdf_form_path(pdf_path) -> вернёт список полей с ID
# 2) fill_pdf_form_to_path(pdf_path, out_path, values) -> заполнит поля и сохранит PDF
# 3) wrappers для API: introspect_pdf_form_path / fill_pdf_form_bytes
#
# Поддержка:
# - Text fields (/Tx)
# - Button fields (/Btn) including checkbox / radio groups
#
# IMPORTANT:
# - В реальных PDF "on" значение может быть НЕ /Yes (часто /1, /2, /3 как в W-4).
#   Поэтому мы вытаскиваем on_values из /AP /N.
#
# ============================================================

from typing import Iterable, Union

try:
    from pypdf import PdfReader, PdfWriter
    _HAS_PYPDF = True
except Exception:
    _HAS_PYPDF = False


def _ensure_pypdf():
    if not _HAS_PYPDF:
        raise ImportError("pypdf is required. Install: pip install pypdf")


def _pdf_name_to_str(x: Any) -> str:
    """
    pypdf может вернуть NameObject вида '/Yes' или просто 'Yes'.
    Мы приводим к строке, желательно с '/' если оно так хранится.
    """
    if x is None:
        return ""
    s = str(x)
    return s


def _extract_on_states_from_field_dict(field_dict: dict) -> List[str]:
    """
    Достаём возможные appearance states для кнопок (/Btn).
    Обычно лежит в /AP -> /N (normal appearance) как dict ключей:
        {'/Off': ..., '/Yes': ...}
    В W-4 часто {'/Off':..., '/1':...} и т.д.
    """
    on_values: List[str] = []
    ap = field_dict.get("/AP")
    if isinstance(ap, dict):
        n = ap.get("/N")
        if isinstance(n, dict):
            for k in n.keys():
                ks = _pdf_name_to_str(k)
                if ks and ks != "/Off" and ks != "Off":
                    on_values.append(ks)
    # иногда /Opt встречается у некоторых кнопок/радио
    opt = field_dict.get("/Opt")
    if isinstance(opt, list):
        for v in opt:
            vs = _pdf_name_to_str(v)
            if vs and vs not in on_values:
                on_values.append(vs)

    # Уникализация
    seen = set()
    out = []
    for v in on_values:
        if v in seen:
            continue
        seen.add(v)
        out.append(v)
    return out


def _walk_widgets_for_rects(field_obj: dict) -> List[Tuple[int, List[float]]]:
    """
    В PDF прямоугольник (/Rect) может лежать:
    - либо в самом поле
    - либо в /Kids (виджеты), каждый прикреплён к странице
    Мы возвращаем список (page_index, rect).
    page_index — 0-based
    """
    rects: List[Tuple[int, List[float]]] = []

    # helper: попытаться вытащить страницу из виджета через /P
    def _page_index_from_widget(widget: dict, reader: PdfReader) -> Optional[int]:
        p = widget.get("/P")
        if p is None:
            return None
        # p — ссылка на page object; попробуем найти индекс
        try:
            for i, pg in enumerate(reader.pages):
                if pg.indirect_reference == p:
                    return i
        except Exception:
            pass
        # fallback: иногда сравнение объекта
        try:
            for i, pg in enumerate(reader.pages):
                if pg == p:
                    return i
        except Exception:
            pass
        return None

    # основной rect
    if "/Rect" in field_obj and isinstance(field_obj.get("/Rect"), (list, tuple)) and len(field_obj["/Rect"]) == 4:
        try:
            rect = [float(x) for x in field_obj["/Rect"]]
            rects.append((-1, rect))  # -1 = неизвестная страница, если не нашли
        except Exception:
            pass

    kids = field_obj.get("/Kids")
    if isinstance(kids, list):
        # reader нужен чтобы сопоставить страницу
        # (передадим позже, если нужно)
        pass

    return rects


def introspect_pdf_form_path(pdf_path: str) -> Dict[str, Any]:
    """
    Главная функция: парсит PDF форму и возвращает структуру
    пригодную для фронта/бекенда.

    Возвращает:
    {
      "fillable": bool,
      "fields": [
        {
          "id": "<field_name>",
          "type": "text" | "button" | "choice" | "signature" | "unknown",
          "ft": "/Tx" | "/Btn" | "/Ch" | ...,
          "on_values": ["/1", "/Yes", ...],   # только для button
          "off_value": "/Off",
          "value": "<current>",
          "labels": {"T": "...", "TU": "..."},
          "rects": [{"page_index": 0, "rect":[x1,y1,x2,y2]} , ...]
        }
      ],
      "meta": {"pages": N}
    }
    """
    _ensure_pypdf()
    reader = PdfReader(pdf_path)

    root = reader.trailer.get("/Root", {})
    acro = root.get("/AcroForm")
    if not acro:
        return {"fillable": False, "fields": [], "meta": {"pages": len(reader.pages)}}

    fields_map = reader.get_fields() or {}
    if not fields_map:
        return {"fillable": False, "fields": [], "meta": {"pages": len(reader.pages)}}

    out_fields: List[Dict[str, Any]] = []

    # В pypdf get_fields возвращает dict: name -> dict field props
    for name, f in fields_map.items():
        ft = _pdf_name_to_str(f.get("/FT"))
        t = _pdf_name_to_str(f.get("/T"))
        tu = _pdf_name_to_str(f.get("/TU"))
        v = f.get("/V")

        kind = "unknown"
        if ft == "/Tx":
            kind = "text"
        elif ft == "/Btn":
            kind = "button"
        elif ft == "/Ch":
            kind = "choice"

        # on-values для кнопок
        on_values: List[str] = []
        if ft == "/Btn":
            on_values = _extract_on_states_from_field_dict(f)

        # rects: попробуем собрать из /Kids виджетов и /Rect
        rects: List[Dict[str, Any]] = []

        # 1) если есть /Kids: каждый kid может иметь /Rect и /P (страницу)
        kids = f.get("/Kids")
        if isinstance(kids, list):
            for kid_ref in kids:
                try:
                    kid = kid_ref.get_object()
                except Exception:
                    kid = kid_ref
                if not isinstance(kid, dict):
                    continue

                rect = kid.get("/Rect")
                if isinstance(rect, (list, tuple)) and len(rect) == 4:
                    try:
                        rect_f = [float(x) for x in rect]
                    except Exception:
                        rect_f = None
                else:
                    rect_f = None

                # определяем страницу
                page_index = None
                p = kid.get("/P")
                if p is not None:
                    try:
                        for i, pg in enumerate(reader.pages):
                            # сопоставление через indirect reference
                            if getattr(pg, "indirect_reference", None) == p:
                                page_index = i
                                break
                    except Exception:
                        pass

                if rect_f is not None:
                    rects.append({"page_index": page_index, "rect": rect_f})

        # 2) если на поле есть /Rect (редко, но бывает)
        rect = f.get("/Rect")
        if isinstance(rect, (list, tuple)) and len(rect) == 4:
            try:
                rect_f = [float(x) for x in rect]
                rects.append({"page_index": None, "rect": rect_f})
            except Exception:
                pass

        out_fields.append({
            "id": name,                      # <-- твой ID поля
            "type": kind,
            "ft": ft,
            "on_values": on_values,
            "off_value": "/Off",
            "value": _pdf_name_to_str(v) if v is not None else None,
            "labels": {"T": t, "TU": tu},
            "rects": rects
        })

    # Чуть-чуть стабильности сортировки (чтобы фронт не прыгал)
    out_fields.sort(key=lambda x: x["id"])

    return {
        "fillable": True,
        "fields": out_fields,
        "meta": {"pages": len(reader.pages)}
    }


def _normalize_pdf_values_for_buttons(schema: Dict[str, Any], values: Dict[str, Any]) -> Dict[str, Any]:
    """
    Пользователь/фронт может прислать:
      - True/False
      - "on"/"off"
      - конкретное "/1" "/Yes"
    Мы превращаем это в то, что PDF реально понимает.

    Логика:
      - если поле /Btn:
          * True  -> первый on_values (если есть) иначе "/Yes"
          * False -> "/Off"
          * str   -> оставляем как есть, но если "YES"/"ON" -> первый on
    """
    if not schema or not isinstance(schema, dict):
        return dict(values or {})

    fields = schema.get("fields") or []
    btn_map = {f["id"]: f for f in fields if f.get("ft") == "/Btn"}

    out = dict(values or {})
    for fid, meta in btn_map.items():
        if fid not in out:
            continue
        raw = out[fid]

        on_vals = meta.get("on_values") or []
        default_on = on_vals[0] if on_vals else "/Yes"

        if isinstance(raw, bool):
            out[fid] = default_on if raw else "/Off"
            continue

        if raw is None:
            out[fid] = "/Off"
            continue

        s = str(raw).strip()
        up = s.upper()

        if up in ("TRUE", "YES", "ON", "1"):
            out[fid] = default_on
        elif up in ("FALSE", "NO", "OFF", "0"):
            out[fid] = "/Off"
        else:
            # если уже прислали "/1" "/2" "/Yes" — оставляем как есть
            # но если прислали "2" (без слэша) а on_values хранит "/2" — подправим
            if on_vals and (s in [v.lstrip("/") for v in on_vals]):
                # найдем соответствие
                for v in on_vals:
                    if v.lstrip("/") == s:
                        out[fid] = v
                        break
            else:
                out[fid] = s

    return out


def fill_pdf_form_to_path(src_pdf_path: str, out_pdf_path: str, values: Dict[str, Any],
                          force_need_appearances: bool = True) -> str:
    """
    Заполняет AcroForm поля и пишет PDF на диск.
    values: dict[field_id] = value

    - Для текста (/Tx): строка
    - Для кнопок (/Btn): лучше передавать bool или конкретный state "/1", "/Yes"
    """
    _ensure_pypdf()

    # 1) Снимаем схему, чтобы корректно нормализовать чекбоксы/радио
    schema = introspect_pdf_form_path(src_pdf_path)
    if not schema.get("fillable"):
        raise ValueError("PDF is not fillable (no AcroForm). Use overlay mapping instead.")

    norm_values = _normalize_pdf_values_for_buttons(schema, values or {})

    reader = PdfReader(src_pdf_path)
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)

    # 2) NeedAppearances — чтобы Acrobat/Preview рисовали значения
    try:
        if force_need_appearances:
            acro = writer._root_object.get("/AcroForm")
            if acro is not None:
                acro.update({"/NeedAppearances": True})
    except Exception:
        pass

    # 3) Заполняем каждую страницу
    for page in writer.pages:
        try:
            writer.update_page_form_field_values(page, norm_values)
        except Exception as e:
            # Не падаем сразу — иногда одна страница без форм, но другая с формами
            print("[fill_pdf] update_page_form_field_values error:", e)

    # 4) Запись результата
    with open(out_pdf_path, "wb") as f:
        writer.write(f)

    return out_pdf_path


def fill_pdf_form_bytes(src_pdf_path: str, values: Dict[str, Any],
                        force_need_appearances: bool = True) -> bytes:
    """
    То же самое, но возвращает bytes (удобно для FastAPI Response).
    """
    _ensure_pypdf()
    tmp_dir = tempfile.mkdtemp(prefix="okydocky_pdf_fill_")
    out_path = os.path.join(tmp_dir, "filled.pdf")
    fill_pdf_form_to_path(src_pdf_path, out_path, values, force_need_appearances=force_need_appearances)
    with open(out_path, "rb") as f:
        return f.read()


def pdf_schema_to_front_fields(pdf_schema: Dict[str, Any]) -> Dict[str, Any]:
    """
    Переводит "сырой" introspection в более UI-friendly формат.

    Идея:
    - text: {kind:"text", id:"...", label:"...", rects:[...]}
    - checkbox/radio: {kind:"button", id:"...", on_values:["/1","/2"], exclusive: ???}

    Важно:
    - У IRS формы часто radio-группы реализованы как разные поля (c1_1[0], c1_1[1]..),
      то есть "exclusive" можно вычислить руками потом (или по префиксу).
    """
    if not pdf_schema.get("fillable"):
        return {"fillable": False, "fields": [], "meta": pdf_schema.get("meta", {})}

    out: List[Dict[str, Any]] = []
    for f in pdf_schema.get("fields", []):
        fid = f.get("id")
        ft = f.get("ft")
        labels = f.get("labels") or {}
        label = labels.get("TU") or labels.get("T") or fid

        if ft == "/Tx":
            out.append({
                "kind": "text",
                "id": fid,
                "label": label,
                "rects": f.get("rects", []),
            })
        elif ft == "/Btn":
            out.append({
                "kind": "button",
                "id": fid,
                "label": label,
                "on_values": f.get("on_values") or [],
                "off_value": f.get("off_value") or "/Off",
                "rects": f.get("rects", []),
            })
        else:
            out.append({
                "kind": "unknown",
                "id": fid,
                "label": label,
                "ft": ft,
                "rects": f.get("rects", []),
            })

    return {"fillable": True, "fields": out, "meta": pdf_schema.get("meta", {})}


# ============================================================
# OPTIONAL: Quick test helpers for your exact W-4 sample
# (Ничего не мешает, просто пример как использовать)
# ============================================================

def _example_fill_w4_2026_like(src_pdf_path: str, out_pdf_path: str) -> str:
    """
    Пример: заполнить самые базовые поля W-4.
    ВАЖНО: ID должны совпадать с тем, что вернёт introspect_pdf_form_path().
    """
    values = {
        # Step 1(a)
        "topmostSubform[0].Page1[0].Step1a[0].f1_01[0]": "John D",
        "topmostSubform[0].Page1[0].Step1a[0].f1_02[0]": "Doe",
        "topmostSubform[0].Page1[0].Step1a[0].f1_03[0]": "123 Main St",
        "topmostSubform[0].Page1[0].Step1a[0].f1_04[0]": "Wellington, FL 33414",
        "topmostSubform[0].Page1[0].Step1a[0].f1_05[0]": "123-45-6789",

        # Filing status (choose one) — можно bool, но лучше конкретный state:
        # Single = /1, Married = /2, HoH = /3 (у W-4 2026 так)
        "topmostSubform[0].Page1[0].c1_1[0]": "/1",

        # Step 2(c) checkbox "two jobs" (ON обычно /1)
        "topmostSubform[0].Page1[0].c1_2[0]": True,

        # Step 4(c) Extra withholding
        "topmostSubform[0].Page1[0].f1_11[0]": "25",

        # Step 5 signature/date
        "topmostSubform[0].Page1[0].f1_12[0]": "John Doe",
        "topmostSubform[0].Page1[0].f1_13[0]": "12/27/2025",
    }
    return fill_pdf_form_to_path(src_pdf_path, out_pdf_path, values)


# ============================================================
# API-friendly wrappers (под твой стиль)
# ============================================================

def introspect_pdf_form_for_api(pdf_path: str) -> Dict[str, Any]:
    """
    Возвращает сразу UI-friendly schema (fields list),
    чтобы фронт/клиент мог строить формы.
    """
    schema = introspect_pdf_form_path(pdf_path)
    return pdf_schema_to_front_fields(schema)


def fill_pdf_form_from_template_path(
    template_pdf_path: str,
    values: Dict[str, Any],
    out_dir: Optional[str] = None,
    out_name: Optional[str] = None,
) -> str:
    """
    Как твой render_pdf_from_template_path, только для PDF AcroForm.
    """
    if out_dir is None:
        out_dir = tempfile.mkdtemp(prefix="okydocky_fillpdf_")
    if out_name is None:
        base = os.path.splitext(os.path.basename(template_pdf_path))[0]
        out_name = f"{base}_filled.pdf"
    out_path = os.path.join(out_dir, out_name)
    return fill_pdf_form_to_path(template_pdf_path, out_path, values)












# =========================
# CLI guard
# =========================
def main():
    # CLI отключён намеренно
    raise SystemExit("Use FastAPI or call run_validation_and_render(); CLI main() disabled.")


if __name__ == "__main__":
    print("ReportLab version:", reportlab.Version)
    # main()
