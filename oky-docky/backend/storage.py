import os
from pathlib import Path
from datetime import datetime, timedelta
import boto3
from botocore.config import Config
import aiofiles
from typing import Optional



class Storage:
    def __init__(self):
        # Используем Cloudflare R2 (S3-совместимый)
        self.s3_client = boto3.client(
            's3',
            endpoint_url=os.getenv('R2_ENDPOINT'),
            aws_access_key_id=os.getenv('R2_ACCESS_KEY'),
            aws_secret_access_key=os.getenv('R2_SECRET_KEY'),
            config=Config(signature_version='s3v4'),
            region_name='auto'
        )
        self.bucket = os.getenv('R2_BUCKET', 'oky-docky-files')
        
        # Локальное хранилище для разработки
        self.local_storage = Path("generated_files")
        self.local_storage.mkdir(exist_ok=True)
    
    async def save_file(self, file_bytes: bytes, filename: str, content_type: str) -> str:
        """Сохраняет файл и возвращает URL"""
        
        if os.getenv('USE_LOCAL_STORAGE', 'true') == 'true':
            # Локальное сохранение для разработки
            file_path = self.local_storage / filename
            async with aiofiles.open(file_path, 'wb') as f:
                await f.write(file_bytes)
            return f"/files/{filename}"
        else:
            # Загрузка в S3/R2
            self.s3_client.put_object(
                Bucket=self.bucket,
                Key=filename,
                Body=file_bytes,
                ContentType=content_type,
                # Файл доступен 24 часа
                Expires=datetime.now() + timedelta(hours=24)
            )
            
            # Генерируем подписанный URL
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket, 'Key': filename},
                ExpiresIn=86400  # 24 часа
            )
            return url