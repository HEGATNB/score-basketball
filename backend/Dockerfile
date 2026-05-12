FROM python:3.11

WORKDIR /app

# Копируем зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Копируем остальной код
COPY . .

# Создаем папки для моделей и бэкапов
RUN mkdir -p /app/models /app/backups

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]