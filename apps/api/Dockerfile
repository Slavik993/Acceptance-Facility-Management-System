# Сборка API. Собирается из корня репозитория: пакеты рабочего пространства
# нужны целиком, поэтому контекст сборки — корень, а не apps/api.
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo

# Клиент Prisma генерируется отдельной командой ниже, поэтому штатный
# postinstall при установке не нужен — и не должен спотыкаться о схему.
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true

COPY . .
RUN pnpm approve-builds --all
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @priyomka/api run prisma:generate \
 && pnpm --filter @priyomka/api run build

FROM node:22-alpine AS runtime
RUN corepack enable
WORKDIR /repo
ENV NODE_ENV=production
# Render задаёт PORT=10000 и направляет на этот порт трафик; приложение
# слушает переменную PORT. На стенде порт задаёт compose.
ENV PORT=10000
COPY --from=build /repo /repo
EXPOSE 10000
# Миграции применяются перед запуском: база поднимается с нуля одной командой.
CMD ["sh", "-c", "pnpm --filter @priyomka/api run migrate:deploy && pnpm --filter @priyomka/api run start"]
