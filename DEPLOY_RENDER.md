# ============================================
# Деплой на Render (render.com)
# ============================================
#
# Шаг 1: Подключите репозиторий к Render
#   1.1. Зарегистрируйтесь на https://render.com
#   1.2. Нажмите "New +" → "Automatic"
#   1.3. Выберите этот репозиторий GitHub
#
# Шаг 2: Создайте PostgreSQL базу данных
#   2.1. В панели Render нажмите "New +" → "PostgreSQL"
#   2.2. Оставьте настройки по умолчанию (Free — достаточно для старта)
#   2.3. Скопируйте значение "Internal Database URL" (начинается с postgresql://...)
#
# Шаг 3: Создайте Web Service для API
#   3.1. Нажмите "New +" → "Private Web Service"
#   3.2. Выберите этот репозиторий
#   3.3. Настройки:
#         Name: priyomka-api
#         Root Directory: apps/api
#         Build Command: pnpm install && pnpm --filter @priyomka/api exec prisma generate && pnpm --filter @priyomka/api run build
#         Start Command: pnpm --filter @priyomka/api run migrate:deploy && pnpm --filter @priyomka/api run start
#         Instance Type: Free
#   3.4. В разделе "Environment Variables" добавьте:
#         NODE_ENV=production
#         DATABASE_URL=<вставьте Internal Database URL из шага 2.2>
#         WEB_ORIGIN=https://your-app-name.onrender.com  # будет после деплоя фронтенда
#         PORT=3000
#         STORAGE_DIR=/tmp/storage  # Render ephemeral filesystem — файлы теряются при перезапуске
#   3.5. Нажмите "Create Web Service"
#
# Шаг 4: Создайте Static Site для веб-фронтенда
#   4.1. Нажмите "New +" → "Static Site"
#   4.2. Выберите этот репозиторий
#   4.3. Настройки:
#         Name: priyomka-web
#         Root Directory: apps/web
#         Build Command: pnpm install && pnpm --filter @priyomka/web run build
#         Publish Path: dist
#   4.4. После создания скопируйте адрес (например: https://priyomka-web.onrender.com)
#   4.5. Вернитесь к API-сервису и обновите WEB_ORIGIN на этот адрес
#
# ============================================
# Альтернативный вариант: render.yaml (Infrastructure as Code)
# ============================================
#
# Если вы хотите настроить всё через файл, раскомментируйте и настройте
# секции ниже в файле render.yaml (если он создан), затем подключите
# репозиторий к Render — он автоматически создаст все сервисы.
#
# Примечания:
# - Free-режим API-сервиса "засыпает" после 15 минут бездействия (первый запрос ~30 сек)
# - Для production рекомендуется Paid plan ($7/мес за web service)
# - Free PostgreSQL ограничен 1 GB и удаляется через 90 дней
# - Файловое хранилище на Render эфемерно — для production используйте S3-совместимое хранилище
# ============================================
