import type { AuthenticatedRequest } from '../../middlewares/authMiddleware';
import { AppError } from '../../utils/appError';
import prisma from '../../config/db';
import {
  createTicketSchema,
  getTicketsQuerySchema,
  addTicketCommentSchema,
  updateTicketStatusSchema,
  updateTicketSchema,
  CreateTicketInput,
  GetTicketsQueryInput,
  AddTicketCommentInput,
  UpdateTicketStatusInput,
  UpdateTicketInput
} from './zodSchemas';
import { TICKET_STATUS } from './constants';
import { checkTicketRateLimit, isValidStatusTransition } from './utils';

function parseParamId(val: any): number {
  const str = Array.isArray(val) ? val[0] : String(val);
  const parsed = parseInt(str, 10);
  if (isNaN(parsed) || parsed <= 0) {
    throw new AppError('ID không hợp lệ', 400, 'BAD_REQUEST');
  }
  return parsed;
}

/**
 * 1. Validate dữ liệu khi tạo Ticket mới
 */
export function validateCreateTicket(req: AuthenticatedRequest): {
  userId: number;
  input: CreateTicketInput;
} {
  const userId = req.user!.id;

  if (!checkTicketRateLimit(userId)) {
    throw new AppError('Bạn đã tạo quá nhiều yêu cầu hỗ trợ trong thời gian ngắn. Vui lòng thử lại sau 10 phút.', 429, 'TOO_MANY_REQUESTS');
  }

  const parseResult = createTicketSchema.safeParse(req.body);
  if (!parseResult.success) {
    const message = parseResult.error.issues[0]?.message || 'Dữ liệu không hợp lệ';
    throw new AppError(message, 400, 'BAD_REQUEST');
  }
  return { userId, input: parseResult.data };
}

/**
 * 2. Validate tham số truy vấn khi lấy danh sách Tickets
 */
export function validateGetTickets(req: AuthenticatedRequest): {
  userId: number;
  role: string;
  query: GetTicketsQueryInput;
} {
  const userId = req.user!.id;
  const role = req.user!.role;

  const parseResult = getTicketsQuerySchema.safeParse(req.query);
  if (!parseResult.success) {
    const message = parseResult.error.issues[0]?.message || 'Tham số tìm kiếm không hợp lệ';
    throw new AppError(message, 400, 'BAD_REQUEST');
  }

  return {
    userId,
    role,
    query: parseResult.data
  };
}

/**
 * 3. Validate và kiểm tra quyền truy cập chi tiết Ticket theo ID
 */
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

/**
 * 4. Validate dữ liệu và quyền gửi phản hồi (comment) vào Ticket
 */
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

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, creatorId: true, status: true }
  });

  if (!ticket) {
    throw new AppError('Không tìm thấy Ticket', 404, 'NOT_FOUND');
  }

  if (role !== 'admin' && ticket.creatorId !== userId) {
    throw new AppError('Bạn không có quyền phản hồi trên Ticket này', 403, 'FORBIDDEN');
  }

  if (ticket.status === TICKET_STATUS.CLOSED) {
    throw new AppError('Ticket đã đóng, không thể gửi phản hồi mới', 400, 'BAD_REQUEST');
  }

  return { ticketId, userId, role, input: parseResult.data };
}

/**
 * 5. Validate dữ liệu khi cập nhật trạng thái Ticket (Admin)
 */
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

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, status: true }
  });

  if (!ticket) {
    throw new AppError('Không tìm thấy Ticket', 404, 'NOT_FOUND');
  }

  if (!isValidStatusTransition(ticket.status, parseResult.data.status)) {
    if (ticket.status === TICKET_STATUS.CLOSED) {
      throw new AppError('Ticket đã ở trạng thái đã đóng, không thể chuyển đổi trạng thái.', 400, 'BAD_REQUEST');
    }
    if (ticket.status === TICKET_STATUS.RESOLVED) {
      throw new AppError('Ticket đã ở trạng thái đã giải quyết, không thể chuyển về lại các trạng thái trước đó.', 400, 'BAD_REQUEST');
    }
    throw new AppError('Ticket đã rời trạng thái mới, không thể chuyển về lại trạng thái mới.', 400, 'BAD_REQUEST');
  }

  return { ticketId, input: parseResult.data };
}

/**
 * 6. Validate dữ liệu và kiểm tra CSDL khi cập nhật thông tin Ticket (Admin)
 */
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

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true }
  });

  if (!ticket) {
    throw new AppError('Không tìm thấy Ticket', 404, 'NOT_FOUND');
  }

  // Kiểm tra sự tồn tại của người được phân công (assigneeId) nếu có truyền
  if (parseResult.data.assigneeId) {
    const assignee = await prisma.user.findUnique({
      where: { id: parseResult.data.assigneeId },
      select: { id: true }
    });
    if (!assignee) {
      throw new AppError('Người hỗ trợ (Assignee) được chọn không tồn tại', 400, 'BAD_REQUEST');
    }
  }

  return { ticketId, input: parseResult.data };
}
