FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
# Ставим библиотеки с флагом --include=dev, чтобы точно не потерять модули компиляции
RUN npm install --include=dev
# Принудительно накатываем Hono и tsx глобально, чтобы бэкенд запустился без сбоев
RUN npm install -g hono tsx

COPY . .

EXPOSE 10000
CMD ["tsx", "api/boot.ts"]
