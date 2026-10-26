FROM node:20-alpine
WORKDIR /app

# Сначала ставим pnpm глобально в систему
RUN npm install -g pnpm

# Копируем все файлы проекта в контейнер
COPY . .

# Удаляем старые файлы блокировки npm, чтобы они не мешали pnpm
RUN rm -f package-lock.json

# Устанавливаем библиотеки, игнорируя встроенные скрипты компиляции
RUN pnpm install --ignore-scripts

# Принудительно доставляем tsx локально, полностью игнорируя скрипты сборщика
RUN pnpm add tsx --ignore-scripts

EXPOSE 10000
# Используем npx для запуска ИИ-ассистента в реальном времени!
CMD ["npx", "tsx", "api/boot.ts"]
