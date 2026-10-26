FROM node:20-alpine
WORKDIR /app

# Сразу копируем абсолютно ВСЕ файлы проекта в контейнер
COPY . .

# Устанавливаем библиотеки прямо внутри готового окружения со всеми файлами
RUN npm install --include=dev

# Ставим утилиту запуска
RUN npm install -g tsx

EXPOSE 10000
# Запускаем напрямую
CMD ["tsx", "api/boot.ts"]
