FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install -g tsx

COPY . .

EXPOSE 10000
# Магия: принудительно накатываем вообще все библиотеки из package.json (включая tRPC) 
# прямо в момент старта контейнера, после чего запускаем ИИ-ассистента
CMD ["sh", "-c", "npm install --include=dev && tsx api/boot.ts"]
