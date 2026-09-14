# ==========================================
# Stage 1: Install dependencies
# ==========================================
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

# Cài đầy đủ dependencies (bao gồm devDeps để build)
RUN npm ci

# ==========================================
# Stage 2: Build source code
# ==========================================
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client & build TypeScript
RUN npx prisma generate
RUN npm run build

# Dọn dẹp devDependencies an toàn sau khi đã build xong
# Nếu dự án dùng tsx/ts-node runtime thì giữ lại, nếu build ra JS thuần ở dist/ thì prune
RUN npm prune --production

# ==========================================
# Stage 3: Production Runner
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Thêm wget/curl để phục vụ healthcheck nếu cần
RUN apk add --no-cache openssl

# Tạo group/user node nếu image base chưa map đủ quyền (alpine mặc định có user node)
COPY --from=builder --chown=node:node /app/package*.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma

USER node

EXPOSE 5000

# Chạy migration rồi start app
CMD ["sh", "-c", "npx prisma migrate deploy && exec npm run start"]