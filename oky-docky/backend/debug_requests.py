#!/usr/bin/env python3
"""
Скрипт для диагностики проблем с API
"""

import requests
import json

def test_debug_endpoint():
    """Тестируем отладочный endpoint"""
    print("🔍 Проверяем доступные шаблоны...")
    
    try:
        response = requests.get("http://localhost:8000/api/debug/form_data_test")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Отладочный endpoint работает")
            
            templates = data.get('available_templates', [])
            print(f"📋 Найдено шаблонов: {len(templates)}")
            
            for template in templates:
                print(f"  - ID: {template['id']}")
                print(f"    Имя: {template['name']}")
                print(f"    Оригинальное имя: {template['original_filename']}")
                print(f"    PDF существует: {template['pdf_exists']}")
                print(f"    Переменные: {template['variables']}")
                print("")
            
            return templates
        else:
            print(f"❌ Ошибка: {response.status_code}")
            print(response.text)
            return []
            
    except Exception as e:
        print(f"💥 Ошибка запроса: {e}")
        return []

def test_placeholder_debug(template_name):
    """Тестируем отладку плейсхолдеров"""
    print(f"🔍 Тестируем плейсхолдеры для: {template_name}")
    
    try:
        response = requests.get(f"http://localhost:8000/api/debug/placeholder_test/{template_name}")
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('success'):
                debug_info = data.get('debug_info', {})
                print("✅ Отладка плейсхолдеров работает")
                print(f"📝 Длина текста: {debug_info.get('raw_text_length', 0)}")
                print(f"🔤 Превью текста: {debug_info.get('raw_text_preview', '')[:100]}...")
                print(f"📋 Найдено плейсхолдеров: {debug_info.get('placeholders_found', 0)}")
                
                placeholders = debug_info.get('placeholders_detail', {})
                for name, info in placeholders.items():
                    print(f"  - {{{name}}} встречается {info['count']} раз")
                
                form_fields = debug_info.get('generated_form_fields', [])
                print(f"📝 Поля формы: {len(form_fields)}")
                for field in form_fields:
                    print(f"  - {field['label']} ({field['type']})")
                
                return True
            else:
                print("❌ API вернул ошибку")
                return False
        else:
            print(f"❌ HTTP ошибка: {response.status_code}")
            print(response.text)
            return False
            
    except Exception as e:
        print(f"💥 Ошибка запроса: {e}")
        return False

def test_generation(template_name):
    """Тестируем генерацию документа"""
    print(f"🔄 Тестируем генерацию для: {template_name}")
    
    # Подготавливаем тестовые данные
    test_data = {
        'name': 'Иван Иванов',
        'test': 'тестовые данные',
        'data': '2025-08-07'
    }
    
    # Формируем FormData как делает frontend
    form_data = {
        'format_type': 'pdf',
        'field_data': json.dumps(test_data)
    }
    
    try:
        response = requests.post(
            f"http://localhost:8000/api/generate/{template_name}",
            data=form_data
        )
        
        print(f"📡 Статус ответа: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print("✅ Генерация успешна!")
                print(f"📄 Файл: {data.get('output_file')}")
                print(f"🔗 URL: {data.get('download_url')}")
                return True
            else:
                print("❌ Генерация завершилась с ошибкой")
                print(f"💬 Сообщение: {data.get('message', 'Нет сообщения')}")
                return False
        else:
            print(f"❌ HTTP ошибка: {response.status_code}")
            try:
                error_data = response.json()
                print(f"💬 Детали ошибки: {error_data}")
            except:
                print(f"💬 Текст ошибки: {response.text}")
            return False
            
    except Exception as e:
        print(f"💥 Ошибка запроса: {e}")
        return False

def main():
    print("🚀 ДИАГНОСТИКА OKY DOCKY API")
    print("=" * 50)
    
    # 1. Проверяем доступные шаблоны
    templates = test_debug_endpoint()
    
    if not templates:
        print("❌ Нет доступных шаблонов для тестирования")
        return
    
    # 2. Берем первый шаблон для тестирования
    test_template = templates[0]
    template_name = test_template['name']
    
    print(f"\n🎯 Выбран шаблон для тестирования: {template_name}")
    print("=" * 50)
    
    # 3. Тестируем отладку плейсхолдеров
    placeholder_ok = test_placeholder_debug(template_name)
    
    # 4. Тестируем генерацию
    if placeholder_ok:
        print(f"\n🔄 ТЕСТИРОВАНИЕ ГЕНЕРАЦИИ")
        print("=" * 30)
        generation_ok = test_generation(template_name)
        
        if generation_ok:
            print("\n🎉 ВСЁ РАБОТАЕТ! Попробуй в браузере:")
            print(f"http://localhost:8000")
        else:
            print("\n⚠️ Проблема с генерацией. Проверь логи сервера.")
    else:
        print("\n⚠️ Проблема с анализом плейсхолдеров. Проверь PDF файл.")

if __name__ == "__main__":
    main()