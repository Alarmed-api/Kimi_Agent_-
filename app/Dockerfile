FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --include=dev
RUN npm install -g tsx

COPY . .

EXPOSE 10000
# Магия: принудительно доустанавливаем hono локально в контейнер перед тем, как tsx начнет выполнять код boot.ts
CMD ["sh", "-c", "npm install hono && tsx api/boot.ts"]