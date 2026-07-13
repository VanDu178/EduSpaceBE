const { PrismaClient } = require('@prisma/client');

// Khởi tạo Prisma Client để quản lý các kết nối đến MySQL.
// Tùy chọn log giúp hiển thị các câu lệnh SQL trên console để tiện theo dõi/học tập.
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error']
});

module.exports = prisma;
