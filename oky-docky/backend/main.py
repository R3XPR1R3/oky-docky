from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from typing import Dict, Optional, List
import os
import re
from datetime import datetime
import uuid
import json
from pathlib import Path

# Наши модули
from pdf_processor import PDFProcessor
from storage import Storage
from models import FormData, GenerateRequest
from myroutes import router
app = FastAPI(title="Oky Docky API", version="2.0")

app.include_router(router)

# CORS для фронтенда
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Инициализация
pdf_processor = PDFProcessor()
storage = Storage()