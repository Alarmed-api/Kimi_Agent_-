# --- Этап 1: Сборка зависимостей ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# Устанавливаем абсолютно все библиотеки в изолированной среде сборщика
RUN npm install --include=dev

# --- Этап 2: Финальный легковесный контейнер ---
FROM node:20-alpine
WORKDIR /app

# Копируем уже установленные модули из первого этапа
COPY --from=builder /app/node_modules ./node_modules
# Устанавливаем tsx глобально для запуска
RUN npm install -g tsx

# Копируем исходный код проекта
COPY . .

EXPOSE 10000
# Теперь папка node_modules уже на месте, запускаем напрямую!
CMD ["tsx", "api/boot.ts"]
