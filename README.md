# Для начала работы
- Создать виртуальное окружение<br>
**python -m venv .venv**
<br></br>
- Активировать виртуальное окружение<br>
**.venv\Scripts\activate**
<br></br>
- Перейти в папку бэкенда<br>
**cd backend**
<br></br>
- Установить зависимости<br>
**pip install -r requirements.txt**
<br></br>
- Скачать базу и перенести в нужное место<br>
*(База должна лежать в: backend/data/nba.sqlite)*
<br></br>
- Запустить сервер<br>
**uvicorn main:app --reload --port 8000**
<br></br>
- Перейти в корневую папку<br>
**cd ../**
<br></br>
- Из корня проекта перейти в папку фронтенда<br>
**cd frontend**
<br></br>
- Установить зависимости<br>
**npm install**
<br></br>
- Запустить дев-сервер<br>
**npm run dev**
<br></br>
