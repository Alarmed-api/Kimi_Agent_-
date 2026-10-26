FROM node:20-alpine
WORKDIR /app

# Сначала ставим pnpm глобально в систему
RUN npm install -g pnpm

# Копируем все файлы проекта в контейнер
COPY . .

# Удаляем старые файлы блокировки npm, чтобы они не мешали pnpm
RUN rm -f package-lock.json

# Устанавливаем библиотеки, игнорируя сбойные встроенные скрипты сборки вроде canvas
RUN pnpm install --ignore-scripts

# Устанавливаем инструмент запуска TypeScript
RUN pnpm add -g tsx

EXPOSE 10000
CMD ["tsx", "api/boot.ts"]
