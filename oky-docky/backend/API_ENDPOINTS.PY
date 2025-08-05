@app.get("/")
async def root():
    return {"message": "Oky Docky API v2.0", "status": "ready"}

@app.post("/api/upload-template")
async def upload_template(
    file: UploadFile = File(...),
    form_id: str = None,
    name: str = None
):
    """Загрузка нового PDF шаблона"""
    
    # Генерируем ID если не указан
    if not form_id:
        form_id = str(uuid.uuid4())[:8]
    
    # Сохраняем шаблон
    template_path = pdf_processor.templates_dir / f"{form_id}.pdf"
    
    content = await file.read()
    with open(template_path, "wb") as f:
        f.write(content)
    
    # Извлекаем переменные из шаблона
    variables = pdf_processor.extract_variables_from_template(str(template_path))
    
    # Сохраняем метаданные
    metadata = {
        "id": form_id,
        "name": name or file.filename,
        "variables": variables,
        "uploaded_at": datetime.now().isoformat()
    }
    
    with open(pdf_processor.templates_dir / f"{form_id}.json", "w") as f:
        json.dump(metadata, f, indent=2)
    
    return {
        "form_id": form_id,
        "name": name,
        "variables": variables,
        "message": f"Шаблон загружен! Найдено {len(variables)} переменных"
    }

@app.get("/api/templates")
async def get_templates():
    """Получить список всех шаблонов"""
    templates = []
    
    for json_file in pdf_processor.templates_dir.glob("*.json"):
        with open(json_file) as f:
            metadata = json.load(f)
            templates.append(metadata)
    
    return templates

@app.get("/api/template/{form_id}/variables")
async def get_template_variables(form_id: str):
    """Получить список переменных в шаблоне"""
    template_path = pdf_processor.templates_dir / f"{form_id}.pdf"
    
    if not template_path.exists():
        raise HTTPException(status_code=404, detail="Шаблон не найден")
    
    variables = pdf_processor.extract_variables_from_template(str(template_path))
    
    return {
        "form_id": form_id,
        "variables": variables,
        "count": len(variables)
    }

@app.post("/api/generate")
async def generate_document(request: FormData, background_tasks: BackgroundTasks):
    """Генерация документа с заполненными данными"""
    
    # Проверяем существование шаблона
    template_path = pdf_processor.templates_dir / f"{request.form_id}.pdf"
    if not template_path.exists():
        raise HTTPException(status_code=404, detail="Шаблон не найден")
    
    try:
        # Обрабатываем PDF
        result_bytes = pdf_processor.process_pdf_with_variables(
            str(template_path),
            request.variables,
            request.output_format
        )
        
        # Определяем расширение и content-type
        if request.output_format == "png":
            extension = "png"
            content_type = "image/png"
        else:
            extension = "pdf"
            content_type = "application/pdf"
        
        # Генерируем имя файла
        filename = f"{request.form_id}_{uuid.uuid4()[:8]}.{extension}"
        
        # Сохраняем файл
        file_url = await storage.save_file(
            result_bytes,
            filename,
            content_type
        )
        
        return {
            "success": True,
            "file_url": file_url,
            "filename": filename,
            "format": request.output_format
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка генерации: {str(e)}")

@app.get("/api/files/{filename}")
async def get_file(filename: str):
    """Получить сгенерированный файл (для локальной разработки)"""
    file_path = storage.local_storage / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Файл не найден")
    
    # Определяем content-type по расширению
    if filename.endswith('.png'):
        media_type = "image/png"
    else:
        media_type = "application/pdf"
    
    return FileResponse(file_path, media_type=media_type)

@app.post("/api/generate-batch")
async def generate_batch(form_id: str, users_data: List[Dict[str, str]], format: str = "pdf"):
    """Массовая генерация документов"""
    results = []
    
    for user_data in users_data:
        try:
            request = FormData(
                form_id=form_id,
                variables=user_data,
                output_format=format
            )
            result = await generate_document(request, BackgroundTasks())
            results.append(result)
        except Exception as e:
            results.append({"error": str(e), "data": user_data})
    
    return {"results": results, "total": len(results)}