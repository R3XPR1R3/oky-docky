from __future__ import annotations
from pathlib import Path
from typing import Dict, Any, Union
from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject, BooleanObject


def _with_name_fallbacks(reader: PdfReader, field_values: Dict[str, Any]) -> Dict[str, Any]:
    """
    Делает заполнение устойчивым:
    - если дали длинное имя topmostSubform...f1_01[0], добавляем короткое f1_01[0]
    - если дали короткое, но в PDF почему-то только длинное — оставляем как есть (проверим совпадение)
    """
    fields = reader.get_fields() or {}
    available = set(fields.keys())

    out = dict(field_values)

    for k, v in list(field_values.items()):
        if k in available:
            continue
        if "." in k:
            short = k.split(".")[-1]
            # добавим короткое имя, если его нет
            if short not in out:
                out[short] = v

    return out


def fill_acroform_pdf(
    src_pdf: Union[str, Path],
    field_values: Dict[str, Any],
    out_pdf: Union[str, Path],
) -> Path:
    src_pdf = Path(src_pdf)
    out_pdf = Path(out_pdf)
    out_pdf.parent.mkdir(parents=True, exist_ok=True)

    reader = PdfReader(str(src_pdf))

    # ✅ как в твоём fill_w9.py: writer + страницы
    writer = PdfWriter()
    writer.append_pages_from_reader(reader)

    # ✅ копируем AcroForm, иначе /Fields может "пропасть" и Btn может не обновляться корректно
    root = reader.trailer["/Root"]
    if "/AcroForm" in root:
        writer._root_object.update({NameObject("/AcroForm"): root["/AcroForm"]})
        # ✅ чтобы значения отображались в viewer'ах
        try:
            writer._root_object["/AcroForm"].update({NameObject("/NeedAppearances"): BooleanObject(True)})
        except Exception:
            pass
    else:
        # не fillable
        with out_pdf.open("wb") as f:
            writer.write(f)
        return out_pdf

    # ✅ делаем фоллбеки имён (длинные -> короткие)
    safe_values = _with_name_fallbacks(reader, field_values)

    # ✅ апдейтим по всем страницам (в W-9 одна страница, но так универсальней)
    for page in writer.pages:
        try:
            writer.update_page_form_field_values(page, safe_values)
        except Exception:
            # не валим весь рендер из-за одной страницы
            pass

    with out_pdf.open("wb") as f:
        writer.write(f)

    return out_pdf
