# SCORE - basketball prediction website

> Веб-приложение для просмотра статистики баскетбольных матчей и игроков

## О проекте

Проект представляет собой веб-приложение с бэкендом на **FastAPI** и фронтендом на **React + Vite**.  
Данные о матчах и игроках хранятся в SQLite базе данных.

### Возможности
- Просмотр списка игроков и их статистики
- Поиск и фильтрация матчей
- Детальная информация о каждом матче
- Адаптивный интерфейс
- ИИ предсказывающий матчи

---

## Быстрый старт

### 1. Клонирование репозитория
```
bash
git clone https://github.com/HEGATNB/kyrsach-basketball.git
cd kyrsach-basketball
git checkout feature/hegatnb
```
# Бэкенд (FastAPI)

### 1. Создать и активировать виртуальное окружение:

   ```
   python -m venv .venv
   .venv\Scripts\activate   # Windows
   # source .venv/bin/activate   # Mac/Linux
   ```
### 2. Установить зависимости:

   ``` 
   cd backend
   pip install -r requirements.txt
   ``` 
### 3. Запустить сервер:

   ```
   uvicorn main:app --reload --port 8000
   ``` 
# Для начала работы
- Создать виртуальное окружение<br>
```python -m venv .venv```
<br></br>
- Активировать виртуальное окружение<br>
```.venv\Scripts\activate```
<br></br>
- Перейти в папку бэкенда<br>
```cd backend```
<br></br>
- Установить зависимости<br>
```pip install -r requirements.txt```
<br></br>
- Скачать базу и перенести в нужное место<br>
*(База должна лежать в: backend/data/nba.sqlite)*
<br></br>
- Запустить сервер<br>
```uvicorn main:app --reload --port 8000```
<br></br>
- Перейти в корневую папку<br>
```cd ../```
<br></br>
- Из корня проекта перейти в папку фронтенда<br>
```cd frontend```
<br></br>
- Установить зависимости<br>
```npm install```
<br></br>
- Запустить дев-сервер<br>
```npm run dev```
<br></br>
____
____

# Basketball Stats Hub

> Web application for viewing basketball match and player statistics

## About

The project is a web application with a **FastAPI** backend and a **React + Vite** frontend.  
Match and player data is stored in an SQLite database.

### Features
- View list of players and their statistics
- Search and filter matches
- Detailed information about each match
- Responsive interface
- AI-powered match prediction

---

## Quick Start

### 1. Clone the repository
```
bash
git clone https://github.com/HEGATNB/kyrsach-basketball.git
cd kyrsach-basketball
git checkout feature/hegatnb
```
# Backend (FastAPI)

### 1. Create and activate a virtual environment:
```
   python -m venv .venv
   .venv\Scripts\activate   # Windows
   # source .venv/bin/activate   # Mac/Linux
   ```

### 2. Install dependencies:
```
    cd backend
    pip install -r requirements.txt
```
### 3. Start the server:
```
uvicorn main:app --reload --port 8000
```
# Getting Started
- Create a virtual environment<br>
```python -m venv .venv```
<br></br>
- Activate the virtual environment<br>
```.venv\Scripts\activate```
<br></br>
- Navigate to the backend folder<br>
```cd backend```
<br></br>
- Install dependencies<br>
```pip install -r requirements.txt```
<br></br>
- Download the database and place it in the correct location<br>
*(Database should be located at: backend/data/nba.sqlite)*
<br></br>
- Start the server<br>
```uvicorn main:app --reload --port 8000```
<br></br>
- Navigate back to the root folder<br>
```cd ../```
<br></br>
- From the root, navigate to the frontend folder<br>
```cd frontend```
<br></br>
- Install dependencies<br>
```npm install```
<br></br>
- Start the development server<br>
```npm run dev```
<br></br>
