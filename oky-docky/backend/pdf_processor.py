from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pathlib import Path

from io import BytesIO
import re
from typing import Dict, List
from PIL import Image
import fitz  # PyMuPDF для более точной работы с текстом

class PDFProcessor:
    def __init__(self):
        # Папка с шаблонами
        self.templates_dir = Path("templates")
        self.templates_dir.mkdir(exist_ok=True)
        
        # Регулярка для поиска переменных вида {VARIABLE_NAME}
        self.variable_pattern = re.compile(r'\{([A-Z_]+)\}')
        
        # Кэш загруженных шаблонов
        self.template_cache = {}
    
    def process_pdf_with_variables(self, template_path: str, variables: Dict[str, str], 
                                 output_format: str = "pdf") -> bytes:
        """
        Главная функция - заменяет {ПЕРЕМЕННЫЕ} в PDF на реальные значения
        
        Args:
            template_path: путь к шаблону PDF
            variables: словарь с заменами, например {"FIRST_NAME": "Иван"}
            output_format: "pdf", "pdf_editable" или "png"
        """
        
        # Открываем PDF с помощью PyMuPDF (работает лучше с текстом)
        doc = fitz.open(template_path)
        
        # Проходим по всем страницам
        for page_num in range(len(doc)):
            page = doc[page_num]
            
            # Получаем весь текст страницы
            text_instances = page.search_for("{")
            
            # Ищем все переменные на странице
            for inst in text_instances:
                # Получаем текст в области
                text = page.get_textbox(inst)
                
                # Проверяем, есть ли это переменная
                for match in self.variable_pattern.finditer(text):
                    var_name = match.group(1)
                    
                    # Если есть значение для замены
                    if var_name in variables:
                        # Заменяем текст
                        new_text = text.replace(match.group(0), variables[var_name])
                        
                        # Удаляем старый текст и добавляем новый
                        page.add_redact_annot(inst)
                        page.apply_redactions()
                        
                        # Добавляем новый текст на то же место
                        page.insert_text(
                            inst[:2],  # координаты
                            new_text,
                            fontsize=11,
                            color=(0, 0, 0)
                        )
        
        # Сохраняем результат
        if output_format == "png":
            # Конвертируем в PNG с водяными знаками
            return self._convert_to_png_with_watermarks(doc)
        else:
            # Сохраняем как PDF
            pdf_bytes = doc.write()
            doc.close()
            
            # Если нужен нередактируемый PDF - блокируем поля
            if output_format == "pdf":
                return self._flatten_pdf(pdf_bytes)
            
            return pdf_bytes
    
    def _flatten_pdf(self, pdf_bytes: bytes) -> bytes:
        """Делает PDF нередактируемым"""
        reader = PdfReader(BytesIO(pdf_bytes))
        writer = PdfWriter()
        
        # Копируем все страницы
        for page in reader.pages:
            writer.add_page(page)
        
        # Блокируем редактирование
        writer.encrypt("", "", permissions_flag=0b0100)  # Только чтение и печать
        
        output = BytesIO()
        writer.write(output)
        return output.getvalue()
    
    def _convert_to_png_with_watermarks(self, doc) -> bytes:
        """Конвертирует PDF в PNG и добавляет водяные знаки"""
        # Берём первую страницу
        page = doc[0]
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x zoom для качества
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        
        # Добавляем водяные знаки
        from PIL import ImageDraw, ImageFont
        draw = ImageDraw.Draw(img)
        
        # Пытаемся загрузить шрифт
        try:
            font = ImageFont.truetype("Arial.ttf", 60)
        except:
            font = ImageFont.load_default()
        
        # Добавляем 5 водяных знаков по диагонали
        watermark_text = "OKY DOCKY"
        for i in range(5):
            x = 100 + i * 150
            y = 100 + i * 200
            # Полупрозрачный оранжевый цвет
            draw.text((x, y), watermark_text, fill=(255, 140, 66, 128), font=font)
        
        # Сохраняем в байты
        output = BytesIO()
        img.save(output, format='PNG')
        return output.getvalue()
    
    def extract_variables_from_template(self, template_path: str) -> List[str]:
        """Извлекает все переменные {VAR_NAME} из шаблона"""
        doc = fitz.open(template_path)
        variables = set()
        
        for page in doc:
            text = page.get_text()
            matches = self.variable_pattern.findall(text)
            variables.update(matches)
        
        doc.close()
        return list(variables)