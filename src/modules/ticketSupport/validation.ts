import type { AuthenticatedRequest } from '../../middlewares/authMiddleware';
import { AppError } from '../../utils/appError';
import prisma from '../../config/db';
import {
  createTicketSchema,
  addTicketCommentSchema,
  updateTicketStatusSchema,
  updateTicketSchema,
  CreateTicketInput,
  AddTicketCommentInput,
  UpdateTicketStatusInput,
  UpdateTicketInput
} from './zodSchemas';

// Helper parse query string safely
function parseQueryString(val: any): string | undefined {
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && typeof val[0] === 'string') return val[0];
  return undefined;
}

function parseParamId(val: any): number {
  const str = Array.isArray(val) ? val[0] : String(val);
  const parsed = parseInt(str, 10);
  if (isNaN(parsed)) {
    throw new AppError('ID không hợp lệ', 400, 'BAD_REQUEST');
  }
  return parsed;
}

export function validateCreateTicket(req: AuthenticatedRequest): { userId: number; input: CreateTicketInput } {
  const userId = req.user!.id;
  const parseResult = createTicketSchema.safeParse(req.body);
  if (!parseResult.success) {
    const message = parseResult.error.issues[0]?.message || 'Dữ liệu không hợp lệ';
    throw new AppError(message, 400, 'BAD_REQUEST');
  }
  return { userId, input: parseResult.data };
}

export function validateGetTickets(req: AuthenticatedRequest): {
  userId: number;
  role: string;
  query: {
    status?: string;
    category?: string;
    priority?: string;
    search?: string;
    page: number;
    limit: number;
  };
} {
  const userId = req.user!.id;
  const role = req.user!.role;

  const status = parseQueryString(req.query.status);
  const category = parseQueryString(req.query.category);
  const priority = parseQueryString(req.query.priority);
  const search = parseQueryString(req.query.search);
  const pageStr = parseQueryString(req.query.page);
  const limitStr = parseQueryString(req.query.limit);

  const page = pageStr ? parseInt(pageStr, 10) : 1;
  const limit = limitStr ? parseInt(limitStr, 10) : 20;

  return {
    userId,
    role,
    query: {
      status,
      category,
      priority,
      search,
      page: isNaN(page) ? 1 : page,
      limit: isNaN(limit) ? 20 : limit
    }
  };
}

export async function validateGetTicketById(req: AuthenticatedRequest): Promise<{
  ticketId: number;
  userId: number;
  role: string;
}> {
  const userId = req.user!.id;
  const role = req.user!.role;
  const ticketId = parseParamId(req.params.id);

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, creatorId: true }
  });

  if (!ticket) {
    throw new AppError('Không tìm thấy yêu cầu hỗ trợ (Ticket)', 404, 'NOT_FOUND');
  }

  if (role !== 'admin' && ticket.creatorId !== userId) {
    throw new AppError('Bạn không có quyền truy cập Ticket này', 403, 'FORBIDDEN');
  }

  return { ticketId, userId, role };
}

export async function validateAddTicketComment(req: AuthenticatedRequest): Promise<{
  ticketId: number;
  userId: number;
  role: string;
  input: AddTicketCommentInput;
}> {
  const userId = req.user!.id;
  const role = req.user!.role;
  const ticketId = parseParamId(req.params.id);

  const parseResult = addTicketCommentSchema.safeParse(req.body);
  if (!parseResult.success) {
    const message = parseResult.error.issues[0]?.message || 'Dữ liệu không hợp lệ';
    throw new AppError(message, 400, 'BAD_REQUEST');
  }

  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    throw new AppError('Không tìm thấy Ticket', 404, 'NOT_FOUND');
  }

  if (role !== 'admin' && ticket.creatorId !== userId) {
    throw new AppError('Bạn không có quyền phản hồi trên Ticket này', 403, 'FORBIDDEN');
  }

  if (ticket.status === 'CLOSED') {
    throw new AppError('Ticket đã đóng, không thể gửi phản hồi mới', 400, 'BAD_REQUEST');
  }

  return { ticketId, userId, role, input: parseResult.data };
}

export async function validateUpdateTicketStatus(req: AuthenticatedRequest): Promise<{
  ticketId: number;
  input: UpdateTicketStatusInput;
}> {
  const ticketId = parseParamId(req.params.id);

  const parseResult = updateTicketStatusSchema.safeParse(req.body);
  if (!parseResult.success) {
    const message = parseResult.error.issues[0]?.message || 'Dữ liệu không hợp lệ';
    throw new AppError(message, 400, 'BAD_REQUEST');
  }

  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    throw new AppError('Không tìm thấy Ticket', 404, 'NOT_FOUND');
  }

  return { ticketId, input: parseResult.data };
}

export async function validateUpdateTicket(req: AuthenticatedRequest): Promise<{
  ticketId: number;
  input: UpdateTicketInput;
}> {
  const ticketId = parseParamId(req.params.id);

  const parseResult = updateTicketSchema.safeParse(req.body);
  if (!parseResult.success) {
    const message = parseResult.error.issues[0]?.message || 'Dữ liệu không hợp lệ';
    throw new AppError(message, 400, 'BAD_REQUEST');
  }

  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    throw new AppError('Không tìm thấy Ticket', 404, 'NOT_FOUND');
  }

  return { ticketId, input: parseResult.data };
}
