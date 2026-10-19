# ---------- 阶段 1：构建前端 ----------
FROM node:22-bookworm-slim AS web-builder
WORKDIR /build/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ---------- 阶段 2：安装后端依赖 ----------
FROM node:22-bookworm-slim AS server-deps
# better-sqlite3 官方提供 linux x64 预编译包；装编译链仅为无预编译包时兜底
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---------- 阶段 3：运行时 ----------
FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=3456
WORKDIR /app

COPY --from=server-deps /build/node_modules ./node_modules
COPY package.json server.js ./
COPY src/ ./src/
COPY --from=web-builder /build/web/dist ./web/dist

# 数据目录：SQLite 库 + 封面素材，运行期产生，用非 root 用户运行并挂载卷持久化
RUN mkdir -p /app/src/data /app/covers && chown -R node:node /app
USER node
VOLUME ["/app/src/data", "/app/covers"]

EXPOSE 3456
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3456)+'/api/recipes').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
