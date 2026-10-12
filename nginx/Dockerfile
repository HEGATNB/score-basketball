# Сборка фронтенда

FROM node:18-alpine as builder

WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Nginx; TLS завершается на внешнем ingress.

FROM nginx:alpine

# Удаляем дефолтный конфиг

RUN rm /etc/nginx/conf.d/default.conf

# Копируем наш конфиг

COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Копируем собранный фронтенд

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
