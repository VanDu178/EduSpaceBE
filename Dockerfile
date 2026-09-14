# ==========================================
# Stage 1: Install dependencies
# ==========================================
FROM node:22-alpine AS deps
# Cài đặt openssl & libc6-compat bắt buộc cho Prisma trên Alpine Linux
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

# Tối ưu Docker Layer Cache: sao chép package.json trước để tận dụng cache npm ci
COPY package*.json ./
RUN npm ci

# ==========================================
# Stage 2: Build source code
# ==========================================
FROM node:22-alpine AS builder
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY prisma ./prisma/
COPY . .

# Generate Prisma Client & biên dịch TypeScript ra JavaScript thuần
RUN npx prisma generate
RUN npm run build

# Dọn dẹp devDependencies an toàn sau khi đã build xong
RUN npm prune --production

# ==========================================
# Stage 3: Production Runner
# ==========================================
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Cài đặt openssl cho Prisma runtime và wget cho Healthcheck
RUN apk add --no-cache openssl wget

# Sao chép các tài nguyên đã được build với quyền phân bổ cho user node
COPY --from=builder --chown=node:node /app/package*.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --chown=node:node docker-entrypoint.sh ./docker-entrypoint.sh

# Cấp quyền thực thi script entrypoint
RUN chmod +x ./docker-entrypoint.sh

USER node

EXPOSE 5000

# Healthcheck định kỳ kiểm tra sức khỏe của server backend tại /api/health
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

# Sử dụng entrypoint script tự động migrate DB trước khi khởi chạy Node.js
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]