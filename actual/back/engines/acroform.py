from __future__ import annotations
from pathlib import Path
from typing import Dict, Any, Union
from pypdf import PdfReader, PdfWriter


def fill_acroform_pdf(
    src_pdf: Union[str, Path],
    field_values: Dict[str, Any],
    out_pdf: Union[str, Path],
) -> Path:
    src_pdf = Path(src_pdf)
    out_pdf = Path(out_pdf)
    out_pdf.parent.mkdir(parents=True, exist_ok=True)

    reader = PdfReader(str(src_pdf))

    # ✅ КЛЮЧ: клонируем документ вместе с AcroForm
    writer = PdfWriter(clone_from=reader)

    # Чтобы значения отображались в viewer'ах
    writer.set_need_appearances_writer()

    # Можно пройтись по всем страницам (поля могут быть где угодно)
    for page in writer.pages:
        writer.update_page_form_field_values(page, field_values)

    with out_pdf.open("wb") as f:
        writer.write(f)

    return out_pdf
