FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (git needed for sync-to-repo)
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Recreate the package structure: actual.back.*
RUN mkdir -p actual
COPY back/ actual/back/
RUN touch actual/__init__.py

EXPOSE 8000

CMD ["python3", "-m", "uvicorn", "actual.back.fillable_processor:app", "--host", "0.0.0.0", "--port", "8000"]
