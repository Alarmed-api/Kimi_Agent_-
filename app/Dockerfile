FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install
RUN npm install -g typescript

COPY . .

RUN tsc --skipLibCheck

EXPOSE 10000
# Запускаем скомпилированный бэкенд напрямую по его реальному пути
CMD ["node", "dist/api/boot.js"]
