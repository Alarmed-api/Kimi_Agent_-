FROM node:20-alpine
WORKDIR /app

# Сначала ставим pnpm глобально в систему
RUN npm install -g pnpm

# Копируем все файлы проекта в контейнер
COPY . .

# Удаляем старые файлы блокировки npm, чтобы они не мешали pnpm
RUN rm -f package-lock.json

# Устанавливаем ВСЕ библиотеки через pnpm без единой ошибки
RUN pnpm install

# Устанавливаем инструмент запуска TypeScript
RUN pnpm add -g tsx

EXPOSE 10000
CMD ["tsx", "api/boot.ts"]
