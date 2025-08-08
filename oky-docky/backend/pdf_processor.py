from pathlib import Path
import re
from typing import Dict, List
from io import BytesIO

# Попробуем импортировать PyMuPDF
try:
    import fitz
    PYMUPDF_AVAILABLE = True
    print("✅ PyMuPDF доступен")
except ImportError:
    PYMUPDF_AVAILABLE = False
    print("⚠️ PyMuPDF недоступен, используем упрощенную версию")

# Импортируем наш парсер
try:
    from placeholder_parser import AdvancedPlaceholderParser
    PARSER_AVAILABLE = True
except ImportError:
    PARSER_AVAILABLE = False
    print("⚠️ AdvancedPlaceholderParser недоступен")

class PDFProcessor:
    """Упрощенная версия PDF процессора"""
    
    def __init__(self):
        self.templates_dir = Path("templates")
        self.templates_dir.mkdir(exist_ok=True)
        
        # Простая регулярка для переменных
        self.variable_pattern = re.compile(r'\{([A-Za-z_]+)\}')
        
        # Кэш
        self.template_cache = {}
        
        # Инициализируем парсер если доступен
        if PARSER_AVAILABLE:
            self.advanced_parser = AdvancedPlaceholderParser()
        else:
            self.advanced_parser = None
    
    def extract_variables_from_template(self, template_path: str) -> List[str]:
        """Извлекает переменные из PDF"""
        print(f"🔍 Извлечение переменных из: {template_path}")
        
        if self.advanced_parser:
            try:
                file_path = Path(template_path)
                placeholders = self.advanced_parser.analyze_template_file(file_path)
                variables = [name.upper() for name in placeholders.keys()]
                print(f"✅ Найдено переменных (advanced): {variables}")
                return variables
            except Exception as e:
                print(f"⚠️ Ошибка advanced парсера: {e}")
        
        # Fallback - простой анализ
        try:
            if PYMUPDF_AVAILABLE:
                doc = fitz.open(template_path)
                text = ""
                for page in doc:
                    text += page.get_text()
                doc.close()
            else:
                # Еще более простой fallback
                from pypdf import PdfReader
                reader = PdfReader(template_path)
                text = ""
                for page in reader.pages:
                    text += page.extract_text()
            
            variables = list(set(self.variable_pattern.findall(text)))
            print(f"✅ Найдено переменных (fallback): {variables}")
            return variables
            
        except Exception as e:
            print(f"❌ Ошибка извлечения переменных: {e}")
            return []
    
    def get_template_form_fields(self, template_path: str) -> List[Dict]:
        """Генерирует поля формы"""
        if self.advanced_parser:
            try:
                file_path = Path(template_path)
                placeholders = self.advanced_parser.analyze_template_file(file_path)
                return self.advanced_parser.generate_form_fields(placeholders)
            except Exception as e:
                print(f"❌ Ошибка генерации полей: {e}")
        
        # Простой fallback
        variables = self.extract_variables_from_template(template_path)
        fields = []
        for var in variables:
            fields.append({
                'name': var.lower(),
                'label': var.replace('_', ' ').title(),
                'type': 'text',
                'required': True,
                'placeholder': f'Введите {var.lower()}',
                'validation': {},
                'occurrences': 1
            })
        return fields
    
    def debug_template(self, template_path: str) -> Dict:
        """Отладка шаблона"""
        try:
            file_path = Path(template_path)
            
            if self.advanced_parser:
                raw_text = self.advanced_parser.extract_text_from_file(file_path)
                placeholders = self.advanced_parser.analyze_template_file(file_path)
                form_fields = self.advanced_parser.generate_form_fields(placeholders)
                
                return {
                    "file_name": file_path.name,
                    "raw_text_length": len(raw_text),
                    "raw_text_preview": raw_text[:500] + "..." if len(raw_text) > 500 else raw_text,
                    "placeholders_found": len(placeholders),
                    "placeholders_detail": {
                        name: {
                            "count": info.count,
                            "positions": info.positions,
                            "file_type": info.file_type
                        } for name, info in placeholders.items()
                    },
                    "generated_form_fields": form_fields,
                    "method": "advanced_parser"
                }
            else:
                variables = self.extract_variables_from_template(template_path)
                return {
                    "file_name": file_path.name,
                    "raw_text_length": 0,
                    "raw_text_preview": "Парсер недоступен",
                    "placeholders_found": len(variables),
                    "placeholders_detail": {},
                    "generated_form_fields": self.get_template_form_fields(template_path),
                    "legacy_variables": variables,
                    "method": "simple_fallback"
                }
                
        except Exception as e:
            return {
                "error": str(e),
                "file_name": Path(template_path).name,
                "method": "error"
            }
    
    def process_pdf_with_variables(self, template_path: str, variables: Dict[str, str], 
                                 output_format: str = "pdf") -> bytes:
        """Обрабатывает PDF с переменными"""
        print(f"🔄 Обработка PDF: {template_path}")
        print(f"📝 Переменные: {variables}")
        print(f"📋 Формат: {output_format}")
        
        try:
            if output_format == "png":
                return self._create_simple_png(variables)
            else:
                return self._create_simple_pdf(variables)
                
        except Exception as e:
            print(f"❌ Ошибка обработки: {e}")
            return self._create_error_pdf(str(e))
    
    def _create_simple_pdf(self, variables: Dict[str, str]) -> bytes:
        """Создает простой PDF"""
        try:
            from reportlab.pdfgen import canvas
            from reportlab.lib.pagesizes import letter
            
            buffer = BytesIO()
            c = canvas.Canvas(buffer, pagesize=letter)
            
            # Заголовок
            c.setFont("Helvetica-Bold", 16)
            c.drawString(100, 750, "Oky Docky - Generated Document")
            
            # Данные
            c.setFont("Helvetica", 12)
            y = 700
            
            for key, value in variables.items():
                c.drawString(100, y, f"{key}: {value}")
                y -= 30
                if y < 100:  # Новая страница если нужно
                    c.showPage()
                    y = 750
            
            # Водяной знак
            c.setFont("Helvetica", 40)
            c.setFillGray(0.9)
            c.drawString(200, 400, "OKY DOCKY")
            
            c.save()
            result = buffer.getvalue()
            print(f"✅ PDF создан, размер: {len(result)} байт")
            return result
            
        except Exception as e:
            print(f"❌ Ошибка создания PDF: {e}")
            return self._create_error_pdf(str(e))
    
    def _create_simple_png(self, variables: Dict[str, str]) -> bytes:
        """Создает простой PNG"""
        try:
            from PIL import Image, ImageDraw, ImageFont
            
            img = Image.new('RGB', (800, 600), color='white')
            draw = ImageDraw.Draw(img)
            
            try:
                font = ImageFont.truetype("Arial.ttf", 20)
            except:
                font = ImageFont.load_default()
            
            # Заголовок
            draw.text((50, 50), "Oky Docky - Generated Document", fill='black', font=font)
            
            # Данные
            y = 100
            for key, value in variables.items():
                draw.text((50, y), f"{key}: {value}", fill='black', font=font)
                y += 30
            
            # Водяной знак
            draw.text((200, 400), "OKY DOCKY", fill=(200, 200, 200), font=font)
            
            buffer = BytesIO()
            img.save(buffer, format='PNG')
            result = buffer.getvalue()
            print(f"✅ PNG создан, размер: {len(result)} байт")
            return result
            
        except Exception as e:
            print(f"❌ Ошибка создания PNG: {e}")
            return b""  # Пустые байты
    
    def _create_error_pdf(self, error_message: str) -> bytes:
        """Создает PDF с сообщением об ошибке"""
        try:
            from reportlab.pdfgen import canvas
            from reportlab.lib.pagesizes import letter
            
            buffer = BytesIO()
            c = canvas.Canvas(buffer, pagesize=letter)
            
            c.setFont("Helvetica-Bold", 16)
            c.drawString(100, 750, "Oky Docky - Error")
            
            c.setFont("Helvetica", 12)
            c.drawString(100, 700, f"Error: {error_message}")
            
            c.save()
            return buffer.getvalue()
        except:
            return b""  # Пустые байты в крайнем случае