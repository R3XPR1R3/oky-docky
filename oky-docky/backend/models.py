from pydantic import BaseModel, Field
from typing import Dict, Optional, List
from enum import Enum

class OutputFormat(str, Enum):
    PNG_FREE = "png"
    PDF_LOCKED = "pdf"
    PDF_EDITABLE = "pdf_editable"

class FormData(BaseModel):
    """Данные для заполнения формы"""
    form_id: str
    variables: Dict[str, str] = Field(..., example={
        "FIRST_NAME": "John",
        "LAST_NAME": "Doe",
        "EMAIL": "john@example.com"
    })
    output_format: OutputFormat = OutputFormat.PDF_LOCKED

class GenerateRequest(BaseModel):
    """Запрос на генерацию документа"""
    form_id: str
    user_data: Dict[str, str]
    format: str = "pdf"
    
class TemplateInfo(BaseModel):
    """Информация о шаблоне"""
    id: str
    name: str
    description: str
    variables: List[str]
    tags: List[str]

# НОВЫЕ МОДЕЛИ ДЛЯ УЛУЧШЕННОГО ПАРСИНГА

class PlaceholderDetail(BaseModel):
    """Подробная информация о плейсхолдере"""
    name: str
    count: int
    positions: List[int]
    file_type: str

class FormField(BaseModel):
    """Поле формы для frontend"""
    name: str
    label: str
    type: str
    required: bool = True
    placeholder: str = ""
    validation: Dict = {}
    occurrences: int = 1

class TemplateStats(BaseModel):
    """Статистика шаблона"""
    total_placeholders: int
    total_occurrences: int

class ExtendedTemplateInfo(BaseModel):
    """Расширенная информация о шаблоне"""
    id: str
    name: str
    variables: List[str]
    uploaded_at: str
    file_size: int
    original_filename: str
    placeholders: Dict[str, PlaceholderDetail] = {}
    form_fields: List[FormField] = []
    stats: TemplateStats

class DebugInfo(BaseModel):
    """Отладочная информация о шаблоне"""
    file_name: str
    raw_text_length: int
    raw_text_preview: str
    placeholders_found: int
    placeholders_detail: Dict[str, Dict]
    generated_form_fields: List[FormField]
    legacy_variables: List[str] = []

class ApiResponse(BaseModel):
    """Стандартный ответ API"""
    success: bool
    message: str = ""
    data: Optional[Dict] = None
    error: Optional[str] = None

class TemplatesResponse(BaseModel):
    """Ответ со списком шаблонов"""
    success: bool
    templates: Dict[str, ExtendedTemplateInfo]
    total: int
    last_scan: str