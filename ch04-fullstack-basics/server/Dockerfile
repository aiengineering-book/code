# packages/server/Dockerfile

# ── Stage 1: Build ────────────────────────────────────────
# node:22-alpine as the base image:
#   - node:22 is the current Node.js LTS major version, stable and long-term supported
#   - alpine is a minimal Linux distro (~5 MB), far smaller than the default Debian-based image
FROM node:22-alpine AS builder

WORKDIR /app
RUN npm install -g pnpm

# Copy only package.json / lockfile first
# Docker caches by layer: if this layer's inputs haven't changed, pnpm install is skipped on the next build
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

RUN pnpm install --frozen-lockfile

# Copy source code after dependencies (source changes often; keeping it here maximises cache reuse)
COPY packages/shared ./packages/shared
COPY packages/server ./packages/server

# Compile TypeScript to JavaScript
RUN pnpm --filter shared build
RUN pnpm --filter server build

# ── Stage 2: Run ────────────────────────────────────────
# Start from a clean image containing only what's needed at runtime —
# no build tools, no source code, no devDependencies
FROM node:22-alpine AS runner

WORKDIR /app
RUN npm install -g pnpm

COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/server/package.json ./packages/server/

# Install production dependencies only (no devDependencies)
RUN pnpm install --prod --frozen-lockfile

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist

EXPOSE 3000
CMD ["node", "packages/server/dist/index.js"]
