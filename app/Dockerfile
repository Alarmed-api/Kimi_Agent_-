FROM node:20-alpine
WORKDIR /app

# Устанавливаем системную утилиту socat для принудительной пересылки портов
RUN apk add --no-cache socat

RUN npm install -g pnpm
COPY . .
RUN rm -f package-lock.json
RUN pnpm install --ignore-scripts
RUN pnpm add tsx --ignore-scripts

EXPOSE 10000

# Запускаем прокси (10000 -> 3000) параллельно с ИИ-ассистентом
CMD socat TCP-LISTEN:10000,fork TCP:127.0.0.1:3000 & npx tsx api/boot.ts
