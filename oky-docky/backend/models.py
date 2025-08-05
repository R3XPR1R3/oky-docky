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