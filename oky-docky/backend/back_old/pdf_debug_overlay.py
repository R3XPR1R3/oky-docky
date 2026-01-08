#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import io
import json
from pathlib import Path
from typing import Any, Dict, List

from reportlab.pdfgen import canvas
from pypdf import PdfReader, PdfWriter  # pip install pypdf


def _load_form_schema(schema_path: Path) -> Dict[str, Any]:
    if not schema_path.exists():
        raise FileNotFoundError(f"Schema not found: {schema_path}")
    with schema_path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _create_overlay_pdf(original_pdf: PdfReader,
                        fields: List[Dict[str, Any]]) -> PdfReader:
    """
    Делаем PDF-оверлей с надписями ID полей,
    по размерам совпадающий со страницами оригинала.
    """
    buf = io.BytesIO()

    # Размер первой страницы возьмём из исходного PDF,
    # а дальше будем менять setPageSize под каждую страницу.
    first_page = original_pdf.pages[0]
    w0 = float(first_page.mediabox.width)
    h0 = float(first_page.mediabox.height)

    c = canvas.Canvas(buf, pagesize=(w0, h0))

    num_pages = len(original_pdf.pages)

    # Соберём поля по страницам для удобства
    fields_by_page: Dict[int, List[Dict[str, Any]]] = {i: [] for i in range(num_pages)}
    for field in fields:
        for r in field.get("rects", []):
            page_index = r.get("page_index")
            if page_index is None:
                continue
            if 0 <= page_index < num_pages:
                item = {
                    "id": field.get("id"),
                    "kind": field.get("kind"),
                    "rect": r["rect"],
                }
                fields_by_page[page_index].append(item)

    # Рисуем постранично
    for page_index in range(num_pages):
        page = original_pdf.pages[page_index]
        w = float(page.mediabox.width)
        h = float(page.mediabox.height)

        if page_index > 0:
            c.setPageSize((w, h))

        # Немного стиля для дебага
        c.setFont("Helvetica", 6)

        for item in fields_by_page.get(page_index, []):
            fid = item["id"] or "???"
            kind = item["kind"] or "unknown"
            x1, y1, x2, y2 = item["rect"]

            # Координаты в PDF: (0,0) внизу слева.
            # Пишем текст внутри прямоугольника, немного сместившись.
            text_x = x1 + 1.5
            text_y = y2 - 7  # чуть ниже верхней границы

            # Для чекбоксов/радио можно кратко помечать
            label = fid
            if kind == "button":
                label = f"[btn] {fid}"
            elif kind == "text":
                label = f"[txt] {fid}"

            # Чтобы текст не улетал за рамки, можно обрезать по ширине
            max_width = (x2 - x1) - 2
            while c.stringWidth(label, "Helvetica", 6) > max_width and len(label) > 3:
                label = label[:-4] + "..."

            c.drawString(text_x, text_y, label)

        c.showPage()

    c.save()
    buf.seek(0)
    return PdfReader(buf)


def build_debug_pdf_for_form(form_id: str,
                             forms_dir: Path) -> bytes:
    """
    Собирает дебаг-PDF с подписями всех полей для заданной формы.

    Ожидается структура:
      forms_dir /
        w4_2026.pdf
        w4_2026.schema.json
    """

    pdf_path = forms_dir / f"{form_id}.pdf"
    schema_path = forms_dir / f"{form_id}.schema.json"

    if not pdf_path.exists():
        raise FileNotFoundError(f"Template PDF not found: {pdf_path}")
    if not schema_path.exists():
        raise FileNotFoundError(f"Schema JSON not found: {schema_path}")

    reader = PdfReader(str(pdf_path))
    schema = _load_form_schema(schema_path)

    fields = schema.get("fields", [])

    overlay_reader = _create_overlay_pdf(reader, fields)

    writer = PdfWriter()

    # Сливаем по страницам
    for i, page in enumerate(reader.pages):
        # клонируем страницу
        base_page = page
        if i < len(overlay_reader.pages):
            base_page.merge_page(overlay_reader.pages[i])
        writer.add_page(base_page)

    out_buf = io.BytesIO()
    writer.write(out_buf)
    out_buf.seek(0)
    return out_buf.read()
