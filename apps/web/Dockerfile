FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo

# Клиент Prisma вебу не нужен, а его postinstall при установке только тратит
# время на генерацию.
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @priyomka/web run build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
COPY apps/web/templates/default.conf.template /etc/nginx/templates/default.conf.template
ENV NGINX_ENVSUBST_FILTER="^(API_UPSTREAM)$"
EXPOSE 10000
