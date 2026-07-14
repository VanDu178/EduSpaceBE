import { PrismaClient } from '@prisma/client';

// Khởi tạo Prisma Client để quản lý các kết nối đến MySQL.
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error']
});

export default prisma;
