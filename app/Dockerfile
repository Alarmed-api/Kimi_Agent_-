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

# Принудительно доставляем tsx локально в папку проекта, чтобы избежать ошибок глобальных путей Linux
RUN pnpm add tsx

EXPOSE 10000
# Используем встроенный npx, который мгновенно найдет локальный tsx и запустит ИИ-ассистента!
CMD ["npx", "tsx", "api/boot.ts"]
