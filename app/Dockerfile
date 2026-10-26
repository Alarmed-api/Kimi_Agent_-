FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
# Устанавливаем TypeScript глобально внутри контейнера для сборки
RUN npm install -g typescript
COPY . .
# Компилируем проект напрямую через установленный TypeScript-компилятор
RUN tsc
EXPOSE 10000
CMD ["npm", "start"]