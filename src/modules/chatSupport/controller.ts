import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../middlewares/authMiddleware';
import { asyncHandler } from '../../utils/asyncHandler';
import * as validation from './validation';
import * as chatService from './services';
import { getIO } from '../../config/socket/socketManager';
import { CHAT_SOCKET_EVENTS, SENDER_TYPE } from './constants';

export const startConversationHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId, input } = validation.validateStartConversation(req);
  const result = await chatService.startConversation(userId, input.initialMessage);

  if (result.conversation) {
    try {
      const io = getIO();
      io.to('admin_agents').emit(CHAT_SOCKET_EVENTS.CONVERSATION_UPDATED, {
        conversationId: result.conversation.id
      });
      const userMessage = result.conversation.messages?.find((m) => m.senderType === SENDER_TYPE.USER);
      if (userMessage) {
        io.to('admin_agents').emit(CHAT_SOCKET_EVENTS.USER_NEW_MESSAGE_NOTICE, {
          conversationId: result.conversation.id,
          user: req.user,
          message: userMessage
        });
      }
    } catch (err) {
      console.error('[startConversationHandler] Socket broadcast notice error:', err);
    }
  }

  res.status(200).json({
    success: true,
    message: result.isAgentOnline
      ? 'Đã kết nối với hệ thống CSKH TradeVerse'
      : 'Admin hiện không trực tuyến. Vui lòng gửi yêu cầu hỗ trợ!',
    data: result
  });
});

export const sendMessageHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId, senderType, input } = await validation.validateSendMessage(req);

  const { message, isInitialMessage } = await chatService.sendMessage(
    input.conversationId,
    senderType,
    userId,
    input.content,
    input.attachments
  );

  try {
    const io = getIO();
    io.to(`conversation_${input.conversationId}`).emit(CHAT_SOCKET_EVENTS.NEW_MESSAGE, {
      conversationId: input.conversationId,
      message
    });

    if (senderType === SENDER_TYPE.USER) {
      io.to('admin_agents').emit(CHAT_SOCKET_EVENTS.CONVERSATION_UPDATED, {
        conversationId: input.conversationId
      });

      io.to('admin_agents').emit(CHAT_SOCKET_EVENTS.USER_NEW_MESSAGE_NOTICE, {
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
  const conversation = await chatService.getConversationDetail(conversationId, req.user?.role);

  res.status(200).json({
    success: true,
    data: conversation
  });
});

export const markConversationAsReadHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { conversationId } = await validation.validateGetConversationDetail(req);
  await chatService.markConversationAsRead(conversationId, req.user?.role || 'user');

  try {
    const io = getIO();
    if (req.user?.role === 'admin') {
      io.to('admin_agents').emit(CHAT_SOCKET_EVENTS.CONVERSATION_UPDATED, {
        conversationId
      });
    } else {
      io.to(`user_${req.user?.id}`).emit(CHAT_SOCKET_EVENTS.CONVERSATION_UPDATED, {
        conversationId
      });
    }
  } catch (err) {
    console.error('[markConversationAsReadHandler] Socket broadcast error:', err);
  }

  res.status(200).json({
    success: true,
    message: 'Đã đánh dấu cuộc trò chuyện là đã đọc'
  });
});

export const acceptConversationHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { conversationId, adminId } = await validation.validateAcceptConversation(req);
  const { conversation, systemMessage } = await chatService.acceptConversation(conversationId, adminId);

  try {
    const io = getIO();

    io.to(`conversation_${conversationId}`).emit(CHAT_SOCKET_EVENTS.NEW_MESSAGE, {
      conversationId,
      message: systemMessage
    });

    io.to(`conversation_${conversationId}`).emit(CHAT_SOCKET_EVENTS.CONVERSATION_UPDATED, {
      conversationId
    });

    io.to('admin_agents').emit(CHAT_SOCKET_EVENTS.CONVERSATION_UPDATED, {
      conversationId
    });
  } catch (err) {
    console.error('[acceptConversationHandler] Socket broadcast error:', err);
  }

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

  try {
    const io = getIO();
    io.to('admin_agents').emit(CHAT_SOCKET_EVENTS.CONVERSATION_UPDATED, {
      conversationId: input.conversationId
    });
  } catch (err) {
    console.error('[convertChatToTicketHandler] Socket broadcast error:', err);
  }

  res.status(201).json({
    success: true,
    message: `Đã chuyển cuộc trò chuyện thành Ticket #${ticket.code}`,
    data: ticket
  });
});

export const resolveConversationHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { conversationId } = await validation.validateResolveConversation(req);
  const conversation = await chatService.resolveConversation(conversationId);

  try {
    const io = getIO();
    io.to('admin_agents').emit(CHAT_SOCKET_EVENTS.CONVERSATION_UPDATED, {
      conversationId
    });
  } catch (err) {
    console.error('[resolveConversationHandler] Socket broadcast error:', err);
  }

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
