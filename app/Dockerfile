FROM node:20-alpine
WORKDIR /app

# Задаем переменные портов прямо внутри контейнера
ENV PORT=10000
ENV HOST=0.0.0.0

RUN npm install -g pnpm
COPY . .
RUN rm -f package-lock.json
RUN pnpm install --ignore-scripts
RUN pnpm add tsx --ignore-scripts

EXPOSE 10000

# Запускаем, принудительно передавая порт 10000 в аргументы запуска tsx
CMD ["npx", "tsx", "api/boot.ts", "--port", "10000", "0.0.0.0"]
