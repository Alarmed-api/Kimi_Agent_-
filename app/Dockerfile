FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install

# Устанавливаем tsx глобально для прямого запуска TypeScript кода
RUN npm install -g tsx

COPY . .

EXPOSE 10000
# Запускаем исходный файл boot.ts напрямую в реальном времени!
CMD ["tsx", "api/boot.ts"]
