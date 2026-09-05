import prisma from '../../config/db';
import { TICKET_RATE_LIMIT } from './constants';

/**
 * Sinh mã Ticket theo định dạng TK-YYYYMMDD-XXXX không trùng lặp
 */
export async function generateTicketCode(dbClient: any = prisma): Promise<string> {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  let code = '';
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 10) {
    attempts++;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    code = `TK-${dateStr}-${randomSuffix}`;

    const existing = await dbClient.supportTicket.findUnique({
      where: { code },
      select: { id: true }
    });

    if (!existing) {
      isUnique = true;
    }
  }

  return code;
}

// In-Memory Rate Limiter: Tối đa 5 lượt tạo ticket trong 10 phút per userId
const ticketCreationMap = new Map<number, number[]>();


export function checkTicketRateLimit(userId: number): boolean {
  const now = Date.now();
  const userTimestamps = ticketCreationMap.get(userId) || [];

  // Lọc lấy các mốc thời gian nằm trong cửa sổ 10 phút
  const validTimestamps = userTimestamps.filter((ts) => now - ts < TICKET_RATE_LIMIT.WINDOW_MS);

  if (validTimestamps.length >= TICKET_RATE_LIMIT.MAX_TICKETS_PER_WINDOW) {
    return false; // Đã vượt quá giới hạn
  }

  validTimestamps.push(now);
  ticketCreationMap.set(userId, validTimestamps);
  return true;
}

