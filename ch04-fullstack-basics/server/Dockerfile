# packages/server/Dockerfile

# ── 第一阶段：构建 ────────────────────────────────────────
# node:22-alpine 是基础镜像：
#   - node:22 选的是 Node.js 的当前 LTS 主版本，长期支持、生产稳
#   - alpine 是一个极小的 Linux 发行版，镜像只有 ~5MB，比默认的 Debian 基础镜像小一个数量级
FROM node:22-alpine AS builder

WORKDIR /app
RUN npm install -g pnpm

# 先只复制 package.json / lockfile
# Docker 按层缓存：这一层的输入没变，下次构建就跳过 pnpm install，节省几十秒
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

RUN pnpm install --frozen-lockfile

# 再复制源码（源码经常变，放在依赖安装之后，最大化利用缓存）
COPY packages/shared ./packages/shared
COPY packages/server ./packages/server

# 编译 TypeScript 为 JavaScript
RUN pnpm --filter shared build
RUN pnpm --filter server build

# ── 第二阶段：运行 ────────────────────────────────────────
# 新开一个干净镜像，只放运行必需的东西——不要构建工具、不要源码、不要 devDependencies
FROM node:22-alpine AS runner

WORKDIR /app
RUN npm install -g pnpm

COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/server/package.json ./packages/server/

# 只安装 dependencies，不装 devDependencies
RUN pnpm install --prod --frozen-lockfile

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist

EXPOSE 3000
CMD ["node", "packages/server/dist/index.js"]
