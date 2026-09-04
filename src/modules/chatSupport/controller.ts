import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../middlewares/authMiddleware';
import { asyncHandler } from '../../utils/asyncHandler';
import * as validation from './validation';
import * as chatService from './services';
import { getIO } from '../../config/socket/socketManager';

export const startConversationHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId, input } = validation.validateStartConversation(req);
  const result = await chatService.startConversation(userId, input.initialMessage);

  res.status(200).json({
    success: true,
    message: result.isAgentOnline
      ? 'Đã kết nối với hệ thống CSKH TradeVerse'
      : 'Admin hiện không trực tuyến. Vui lòng gửi Ticket hỗ trợ!',
    data: result
  });
});

export const sendMessageHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId, senderType, input } = await validation.validateSendMessage(req);

  const message = await chatService.sendMessage(
    input.conversationId,
    senderType,
    userId,
    input.content,
    input.attachments
  );

  try {
    const io = getIO();
    io.to(`conversation_${input.conversationId}`).emit('new_message', {
      conversationId: input.conversationId,
      message
    });

    if (senderType === 'USER') {
      io.to('admin_agents').emit('user_new_message_notice', {
        conversationId: input.conversationId,
        user: req.user,
        message
      });
    }
  } catch (err) {
    console.error('[sendMessageHandler] Socket broadcast notice error:', err);
  }

  res.status(201).json({
    success: true,
    data: message
  });
});

export const getConversationsHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId, role, status, search } = validation.validateGetConversations(req);
  const conversations = await chatService.getConversations(role, userId, status, search);

  res.status(200).json({
    success: true,
    data: conversations
  });
});

export const getConversationDetailHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { conversationId } = await validation.validateGetConversationDetail(req);
  const conversation = await chatService.getConversationDetail(conversationId);

  res.status(200).json({
    success: true,
    data: conversation
  });
});

export const acceptConversationHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { conversationId, adminId } = await validation.validateAcceptConversation(req);
  const conversation = await chatService.acceptConversation(conversationId, adminId);

  res.status(200).json({
    success: true,
    message: 'Đã tiếp nhận cuộc trò chuyện',
    data: conversation
  });
});

export const convertChatToTicketHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { adminId, input } = await validation.validateConvertChatToTicket(req);
  const ticket = await chatService.convertChatToTicket(
    input.conversationId,
    adminId,
    input
  );

  res.status(201).json({
    success: true,
    message: `Đã chuyển cuộc trò chuyện thành Ticket #${ticket.code}`,
    data: ticket
  });
});

export const resolveConversationHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { conversationId } = await validation.validateResolveConversation(req);
  const conversation = await chatService.resolveConversation(conversationId);

  res.status(200).json({
    success: true,
    message: 'Đã hoàn tất cuộc trò chuyện',
    data: conversation
  });
});

export const getAdminStatusHandler = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  res.status(200).json({
    success: true,
    data: chatService.getAdminPresenceStatus()
  });
});

export const setAdminStatusHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  validation.validateSetAdminStatus(req);
  res.status(200).json({
    success: true,
    message: 'Trạng thái trực CSKH được quản lý tự động dựa trên kết nối Socket của Admin',
    data: chatService.getAdminPresenceStatus()
  });
});
