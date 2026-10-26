FROM node:20-alpine
WORKDIR /app

RUN npm install -g pnpm
COPY . .
RUN rm -f package-lock.json
RUN pnpm install --ignore-scripts
RUN pnpm add tsx --ignore-scripts

# Явно прописываем системные порты, которые фреймворк Hono считывает автоматически
ENV PORT=10000
ENV HOST=0.0.0.0
EXPOSE 10000

# Запускаем напрямую через tsx, передавая переменные окружения
CMD ["npx", "tsx", "api/boot.ts"]
