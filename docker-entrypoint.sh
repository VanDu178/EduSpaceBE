#!/bin/sh
set -e

# ==========================================
# EduSpaceBE Docker Entrypoint Script
# ==========================================

echo "==> [EduSpaceBE] Running Prisma Database Migrations..."
npx prisma migrate deploy

echo "==> [EduSpaceBE] Database Migrations completed successfully. Starting application server..."

# Chuyển giao tiến trình sang node mà không spawn shell con (giữ PID 1 cho Node process)
exec "$@"
