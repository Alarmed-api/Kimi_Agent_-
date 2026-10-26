FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
# Устанавливаем абсолютно все зависимости (включая инструменты сборки)
RUN npm italic --include=dev || npm install
COPY . .
# Возвращаем родную команду сборки от Kimi
RUN npm run build
EXPOSE 10000
CMD ["npm", "start"]