# ============================================
# Деплой на Render (render.com)
# ============================================
#
# Схема: два сервиса на один репозиторий.
#
#   acceptance-facility-management-system — API (Node, Prisma, Fastify)
#   priyomka-web — веб-клиент (Docker: сборка vite + nginx)
#
# Клиент ходит в API по относительному пути `/api`, а nginx веб-узла
# проксирует его на API. Так клиент и API выглядят одним источником: кука
# сессии (httpOnly, SameSite=Lax) не пересекает домены, CORS не нужен.
#
# Шаг 1: Подключите репозиторий к Render
#   1.1. Зарегистрируйтесь на https://render.com
#   1.2. В панели нажмите "New +" → "Web Service"
#   1.3. Выберите репозиторий Slavik993/Acceptance-Facility-Management-System
#
# Шаг 2: Создайте PostgreSQL базу данных
#   2.1. "New +" → "PostgreSQL"
#   2.2. Имя: priyomka-db, регион: Oregon (Free)
#   2.3. Регион базы обязан совпадать с регионом сервисов: внутренний адрес
#        PostgreSQL доступен только из того же региона
#
# Шаг 3: Настройте Web Service для API
#   3.1. Name: acceptance-facility-management-system
#   3.2. Region: Oregon, Instance Type: Free
#   3.3. Root Directory: пусто (корень репозитория — pnpm-воркспейс)
#   3.4. Build Command:
#          corepack enable && pnpm install --frozen-lockfile && pnpm --filter @priyomka/api exec prisma generate && pnpm --filter @priyomka/api run build
#   3.5. Start Command:
#          pnpm --filter @priyomka/api run migrate:deploy && pnpm --filter @priyomka/api run start
#   3.6. Health Check Path: /health
#   3.7. Environment Variables:
#          NODE_ENV=production
#          DATABASE_URL=<Internal Database URL базы priyomka-db>
#          STORAGE_DIR=/tmp/storage
#          WEB_ORIGIN=https://priyomka-web.onrender.com
#   3.8. "Create Web Service"
#
# Шаг 4: Создайте веб-сервис (Docker)
#   4.1. "New +" → "Web Service" → Runtime: Docker
#   4.2. Name: priyomka-web, Region: Oregon, Instance Type: Free
#   4.3. Dockerfile Path: ./apps/web/Dockerfile
#   4.4. Docker Context: . (корень репозитория)
#   4.5. Environment Variables:
#          API_UPSTREAM=https://acceptance-facility-management-system.onrender.com
#   4.6. "Create Web Service"
#
# Проверка после деплоя
#   - API: https://acceptance-facility-management-system.onrender.com/health
#     → {"status":"ok","database":"ok"}
#   - Клиент: https://priyomka-web.onrender.com
#
# Примечания:
# - Free-режим API-сервиса "засыпает" после 15 минут бездействия (первый
#   запрос ~30 сек). Веб-узел при этом отвечает, но API ещё просыпается.
# - PORT не задаём: Render выдаёт 10000, приложение слушает переменную PORT.
# - Постоянного диска на Free нет: файлы объектов исчезают при пересоздании
#   инстанса. Для боевой работы нужен платный план или S3-хранилище.
# - Free PostgreSQL ограничен 1 ГБ и удаляется через 90 дней.
# - Пароль базы лежит в render.yaml в репозитории — смените его и держите
#   новый только в переменных окружения сервиса.
# - Настройки сервисов продублированы в render.yaml: при пересоздании
#   сервиса сверяйтесь с ним.
