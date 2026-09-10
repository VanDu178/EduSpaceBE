import type { AuthenticatedRequest } from '../../middlewares/authMiddleware';
import { AppError } from '../../utils/appError';
import prisma from '../../config/db';
import { CHAT_STATUS, SENDER_TYPE } from './constants';
import {
  startConversationSchema,
  sendMessageSchema,
  convertChatToTicketSchema,
  setAdminStatusSchema,
  StartConversationInput,
  SendMessageInput,
  ConvertChatToTicketInput,
  SetAdminStatusInput
} from './zodSchemas';

function parseQueryString(val: any): string | undefined {
  if (typeof val === 'string' && val.trim() !== '' && val !== 'null' && val !== 'undefined') return val;
  if (Array.isArray(val) && typeof val[0] === 'string' && val[0].trim() !== '' && val[0] !== 'null' && val[0] !== 'undefined') return val[0];
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

export function validateStartConversation(req: AuthenticatedRequest): {
  userId: number;
  input: StartConversationInput;
} {
  const userId = req.user!.id;
  const parseResult = startConversationSchema.safeParse(req.body);
  if (!parseResult.success) {
    const message = parseResult.error.issues[0]?.message || 'Dữ liệu không hợp lệ';
    throw new AppError(message, 400, 'BAD_REQUEST');
  }
  return { userId, input: parseResult.data };
}

export async function validateSendMessage(req: AuthenticatedRequest): Promise<{
  userId: number;
  role: string;
  senderType: typeof SENDER_TYPE.AGENT | typeof SENDER_TYPE.USER;
  input: SendMessageInput;
}> {
  const userId = req.user!.id;
  const role = req.user!.role;
  const senderType = role === 'admin' ? SENDER_TYPE.AGENT : SENDER_TYPE.USER;

  const parseResult = sendMessageSchema.safeParse(req.body);
  if (!parseResult.success) {
    const message = parseResult.error.issues[0]?.message || 'Dữ liệu không hợp lệ';
    throw new AppError(message, 400, 'BAD_REQUEST');
  }

  const conversation = await prisma.supportConversation.findUnique({
    where: { id: parseResult.data.conversationId }
  });

  if (!conversation) {
    throw new AppError('Không tìm thấy cuộc trò chuyện', 404, 'NOT_FOUND');
  }

  if (conversation.status === CHAT_STATUS.RESOLVED || conversation.status === CHAT_STATUS.CONVERTED_TO_TICKET) {
    throw new AppError('Cuộc trò chuyện đã kết thúc hoặc đã chuyển thành Ticket', 400, 'BAD_REQUEST');
  }

  return { userId, role, senderType, input: parseResult.data };
}

export function validateGetConversations(req: AuthenticatedRequest): {
  userId: number;
  role: string;
  status?: string;
  search?: string;
} {
  const userId = req.user!.id;
  const role = req.user!.role;
  const status = parseQueryString(req.query.status);
  const search = parseQueryString(req.query.search);
  return { userId, role, status, search };
}

export async function validateGetConversationDetail(req: AuthenticatedRequest): Promise<{
  conversationId: number;
  userId: number;
  role: string;
}> {
  const userId = req.user!.id;
  const role = req.user!.role;
  const conversationId = parseParamId(req.params.id);

  const conversation = await prisma.supportConversation.findUnique({
    where: { id: conversationId },
    select: { id: true, userId: true }
  });

  if (!conversation) {
    throw new AppError('Không tìm thấy cuộc trò chuyện', 404, 'NOT_FOUND');
  }

  if (role !== 'admin' && conversation.userId !== userId) {
    throw new AppError('Bạn không có quyền xem cuộc trò chuyện này', 403, 'FORBIDDEN');
  }

  return { conversationId, userId, role };
}

export async function validateAcceptConversation(req: AuthenticatedRequest): Promise<{
  conversationId: number;
  adminId: number;
}> {
  const adminId = req.user!.id;
  const conversationId = parseParamId(req.params.id);

  const conversation = await prisma.supportConversation.findUnique({
    where: { id: conversationId }
  });

  if (!conversation) {
    throw new AppError('Không tìm thấy cuộc trò chuyện', 404, 'NOT_FOUND');
  }

  return { conversationId, adminId };
}

export async function validateConvertChatToTicket(req: AuthenticatedRequest): Promise<{
  adminId: number;
  input: ConvertChatToTicketInput;
}> {
  const adminId = req.user!.id;
  const parseResult = convertChatToTicketSchema.safeParse(req.body);
  if (!parseResult.success) {
    const message = parseResult.error.issues[0]?.message || 'Dữ liệu không hợp lệ';
    throw new AppError(message, 400, 'BAD_REQUEST');
  }

  const conversation = await prisma.supportConversation.findUnique({
    where: { id: parseResult.data.conversationId },
    include: { ticket: true }
  });

  if (!conversation) {
    throw new AppError('Không tìm thấy cuộc trò chuyện', 404, 'NOT_FOUND');
  }

  if (conversation.ticket) {
    throw new AppError(`Cuộc trò chuyện này đã được tạo thành Ticket ${conversation.ticket.code} từ trước`, 400, 'BAD_REQUEST');
  }

  return { adminId, input: parseResult.data };
}

export async function validateResolveConversation(req: AuthenticatedRequest): Promise<{
  conversationId: number;
}> {
  const conversationId = parseParamId(req.params.id);
  const conversation = await prisma.supportConversation.findUnique({
    where: { id: conversationId }
  });

  if (!conversation) {
    throw new AppError('Không tìm thấy cuộc trò chuyện', 404, 'NOT_FOUND');
  }

  return { conversationId };
}

export function validateGetAdminStatus(_req: AuthenticatedRequest): void {}

export function validateSetAdminStatus(req: AuthenticatedRequest): SetAdminStatusInput {
  const parseResult = setAdminStatusSchema.safeParse(req.body);
  if (!parseResult.success) {
    const message = parseResult.error.issues[0]?.message || 'Dữ liệu không hợp lệ';
    throw new AppError(message, 400, 'BAD_REQUEST');
  }
  return parseResult.data;
}
