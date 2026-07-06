FROM node:24-slim AS builder

# --max-old-space-size
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_OPTIONS=--max-old-space-size=4096
ENV TZ=Asia/Shanghai
ENV CI=true

RUN npm i -g corepack

WORKDIR /app

# copy package.json and pnpm-lock.yaml to workspace
COPY . /app

# 安装依赖
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    --mount=type=cache,id=turbo,target=/app/node_modules/.cache/turbo \
    pnpm install --frozen-lockfile
RUN --mount=type=cache,id=turbo,target=/app/node_modules/.cache/turbo \
    pnpm run build:nexus

RUN echo "Builder Success"

FROM nginx:stable-alpine AS production

# 安装 gettext（提供 envsubst 用于配置模板替换）
RUN apk add --no-cache gettext

# 配置 nginx
RUN echo "types { application/javascript js mjs; }" > /etc/nginx/conf.d/mjs.conf \
    && rm -rf /etc/nginx/conf.d/default.conf

# 复制构建产物
COPY --from=builder /app/apps/nexus-media/dist /usr/share/nginx/html

# 复制 nginx 配置模板和入口脚本
COPY --from=builder /app/scripts/deploy/nginx.conf.template /etc/nginx/nginx.conf.template
COPY --from=builder /app/scripts/deploy/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# 默认值（docker-compose 中无需设置，docker run 时通过 -e 覆盖）
ENV BACKEND_HOST=nexus-media
ENV BACKEND_PORT=8080

EXPOSE 8080

ENTRYPOINT ["/docker-entrypoint.sh"]
