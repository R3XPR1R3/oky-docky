from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

# Роутер
router = APIRouter()

# Подключение статических файлов и шаблонов

templates = Jinja2Templates(directory="/workspaces/oky-docky/oky-docky/FRONTEND_UI/HTML/index")

@router.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("mainpage.html", {"request": request})

@router.get("/api/hello")
def hello():
    return {"message": "Hello from router!"}
