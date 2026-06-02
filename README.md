# SCORE - basketball prediction website
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen?style=flat-square)]()
[![GitHub issues](https://img.shields.io/github/issues/HEGATNB/kyrsach-basketball?style=flat-square)](https://github.com/HEGATNB/score-basketball/issues)
[![Your feedback is greatly appreciated](https://img.shields.io/badge/feedback-welcome-blue?style=flat-square)](https://github.com/HEGATNB/score-basketball/issues/new)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/HEGATNB/kyrsach-basketball?style=flat-square)](https://github.com/HEGATNB/score-basketball/pulls)
## Обзор

SCORE — это веб-приложение для анализа статистики баскетбольных матчей NBA и прогнозирования исходов с использованием нейросетевых моделей. Система предоставляет доступ к статистике команд и игроков, live-данным с ESPN API и машинному обучению.

Технологический стек: Python / FastAPI (бэкенд), TypeScript / React (фронтенд), PostgreSQL (база данных), Redis (кэш/авторизация), TensorFlow/Keras (ML-модель), Docker (контейнеризация).
## Возможности

На данный момент SCORE умеет:

    [stats] Просмотр команд и игроков NBA с фильтрацией по сезонам и сортировкой

    [predict] Генерация прогнозов исходов матчей с использованием нейросетевой модели (EMA-обработка, 10 статистических категорий)

    [live] Отображение актуального счёта матчей через ESPN API

    [auth] Регистрация пользователей и JWT-аутентификация с ролевой моделью (гость/пользователь/оператор/администратор)

    [history] Отслеживание точности прогнозов, серий, рейтинга и начисление баллов

    [admin] Управление пользователями, просмотр логов аудита, создание и восстановление резервных копий

    [analytics] Визуализация метрик модели (точность, loss, веса факторов)

## Установка

SCORE распространяется в виде Docker-контейнеров. Оптимальный способ запуска — через Docker Compose:

```
git clone https://github.com/HEGATNB/kyrsach-basketball.git
cd kyrsach-basketball
git checkout feature/hegatnb
docker compose up -d
```
## Настройка

Создайте файл backend/env с параметрами подключения к базе данных и настройками безопасности:

```
DB_HOST=host.docker.internal
DB_PORT=5432
DB_NAME=nba
DB_USER=postgres
DB_PASSWORD=your_password
REDIS_HOST=redis
JWT_SECRET=your_secret_key
```
## Использование

По умолчанию SCORE запускает все сервисы:
```
Веб-интерфейс: http://localhost (порт 80)

Документация API: http://localhost:8000/docs
```
Проверка состояния API:
```
curl http://localhost/health
```
Просмотр состояния контейнеров:
```
docker compose ps
```
Просмотр логов бэкенда:
```
docker compose logs backend
```
Остановка приложения:
```
docker compose down
```
## Тестирование

Запуск тестов бэкенда через pytest:
```
cd backend
pytest tests/
```
Результаты тестирования: 18 успешно <br>
(10 модульных тестов, 3 интеграционных, 5 API-тестов).
## Архитектура


Browser ->Nginx(reverse proxy) -> FastAPI (бэкенд) -> PostgreSQL/Redis<br>
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;|<br>
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;└── TensorFlow модель 

## Участие в разработке

Мы приветствуем вклад в развитие SCORE. Вы можете помочь следующими способами:

    Создать Issue с предложениями по улучшению или сообщить об ошибке;

    Сделать форк репозитория и отправить Pull Request;

    Улучшить документацию.

Рекомендации по коду:

    Код на Python должен соответствовать стандарту PEP 8;

    Код на TypeScript должен соответствовать правилам ESLint;

    Pull Request должны содержать тесты для новой функциональности.

## Авторы

    Говорунов Д.Д. (Тимлид, Архитектор)

    Нижегородов Д.С. (Системный аналитик)

    Рыбаков М.М. (Backend-разработчик)

    Журавлев А.И. (Frontend-разработчик)

    Карапетян А.Л. (QA-инженер)

РТУ МИРЭА, 2026
