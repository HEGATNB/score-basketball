# Stage 1: Сборка фронтенда
FROM node:18-alpine as builder

WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Stage 2: Nginx с HTTPS
FROM nginx:alpine

# Удаляем дефолтный конфиг
RUN rm /etc/nginx/conf.d/default.conf

# Копируем наш конфиг
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Копируем SSL сертификаты
COPY nginx/ssl /etc/nginx/ssl

# Копируем собранный фронтенд
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
EXPOSE 443

CMD ["nginx", "-g", "daemon off;"]