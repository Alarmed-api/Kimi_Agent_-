FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install
RUN npm install -g typescript

COPY . .

# Запускаем компиляцию напрямую, чтобы увидеть все ошибки в консоли
RUN tsc --skipLibCheck

EXPOSE 10000
CMD ["npm", "start"]
