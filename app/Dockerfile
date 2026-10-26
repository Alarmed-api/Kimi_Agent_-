FROM node:20-alpine
WORKDIR /app

# Копируем все файлы проекта в контейнер
COPY . .

# Принудительно удаляем старый локальный файл блокировки, чтобы избежать сбоя npm
RUN rm -f package-lock.json

# Устанавливаем все библиотеки с нуля без конфликтов конфигурации
RUN npm install --include=dev

# Устанавливаем инструмент запуска TypeScript на лету
RUN npm install -g tsx

EXPOSE 10000
CMD ["tsx", "api/boot.ts"]
