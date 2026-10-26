FROM node:20-alpine
WORKDIR /app

# Устанавливаем системные инструменты для компиляции бинарников
RUN apk add --no-cache libc6-compat

COPY package*.json ./

# Принудительно ставим все библиотеки разработки
RUN npm install --include=dev

# Глобально доустанавливаем утилиты, которые требует package.json
RUN npm install -g esbuild vite

COPY . .

# Запускаем родную сборку от Kimi
RUN npm run build

EXPOSE 10000
CMD ["npm", "start"]
