import prisma from '../../config/db';
import { getIO } from '../../config/socket/socketManager';
import { generateTicketCode } from '../ticketSupport/utils';
import { TICKET_SOCKET_EVENTS } from '../ticketSupport/constants';
import { adminPresenceStore, CHAT_SOCKET_EVENTS } from './constants';
import { generateConversationCode } from './utils';
import type { ConvertChatToTicketInput } from './zodSchemas';
import type { ConversationStatus, SenderType, TicketCategory, TicketPriority } from '@prisma/client';

export async function startConversation(userId: number, initialMessage?: string) {
  let activeConversation = await prisma.supportConversation.findFirst({
    where: {
      userId,
      status: { in: ['WAITING_AGENT', 'AGENT_HANDLING'] }
    },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' }
      },
      agent: {
        select: { id: true, name: true, email: true, avatarUrl: true }
      }
    }
  });

  const isAgentOnline = adminPresenceStore.isAgentAvailable();

  if (activeConversation) {
    if (initialMessage) {
      await sendMessage(activeConversation.id, 'USER', userId, initialMessage);
    }

    const updated = await prisma.supportConversation.findUnique({
      where: { id: activeConversation.id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        agent: { select: { id: true, name: true, email: true, avatarUrl: true } }
      }
    });

    return {
      conversation: updated!,
      isAgentOnline,
      autoConvertedTicket: null
    };
  }

  if (!isAgentOnline) {
    return {
      conversation: null,
      isAgentOnline: false,
      autoConvertedTicket: null
    };
  }

  const code = generateConversationCode();

  const defaultAdmin = await prisma.user.findFirst({
    where: { role: 'admin', status: 'active' }
  });

  const conversation = await prisma.supportConversation.create({
    data: {
      code,
      userId,
      assignedTo: defaultAdmin?.id || null,
      status: 'WAITING_AGENT',
      lastMessage: initialMessage || 'Bắt đầu cuộc trò chuyện mới',
      lastSender: 'USER'
    },
    include: {
      agent: {
        select: { id: true, name: true, email: true, avatarUrl: true }
      }
    }
  });

  if (initialMessage) {
    await prisma.supportMessage.create({
      data: {
        conversationId: conversation.id,
        senderType: 'USER',
        senderId: userId,
        content: initialMessage
      }
    });
  }

  await prisma.supportMessage.create({
    data: {
      conversationId: conversation.id,
      senderType: 'SYSTEM',
      content: 'Chào mừng bạn đến với TradeVerse! Yêu cầu hỗ trợ của bạn đã được chuyển đến nhân viên CSKH.',
      isSystemNotice: true
    }
  });

  const fullConversation = await prisma.supportConversation.findUnique({
    where: { id: conversation.id },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      agent: { select: { id: true, name: true, email: true, avatarUrl: true } }
    }
  });

  return {
    conversation: fullConversation!,
    isAgentOnline: true,
    autoConvertedTicket: null
  };
}

export async function sendMessage(
  conversationId: number,
  senderType: SenderType,
  senderId: number | null,
  content: string,
  attachments?: string[]
) {
  const message = await prisma.supportMessage.create({
    data: {
      conversationId,
      senderType,
      senderId,
      content,
      attachments: attachments ? attachments : undefined
    }
  });

  await prisma.supportConversation.update({
    where: { id: conversationId },
    data: {
      lastMessage: content || (attachments && attachments.length > 0 ? '[Hình ảnh]' : ''),
      lastSender: senderType,
      updatedAt: new Date()
    }
  });

  return message;
}

export async function getConversations(role: string, userId: number, status?: string, search?: string) {
  const whereCondition: any = {};

  if (role !== 'admin') {
    whereCondition.userId = userId;
  } else {
    // FE Admin: Chỉ hiển thị các cuộc trò chuyện của Admin đó phụ trách
    whereCondition.assignedTo = userId;
    if (status) {
      whereCondition.status = status as ConversationStatus;
    }
  }

  if (search && search.trim()) {
    const term = search.trim();
    whereCondition.OR = [
      { code: { contains: term, mode: 'insensitive' } },
      { user: { name: { contains: term, mode: 'insensitive' } } },
      { user: { email: { contains: term, mode: 'insensitive' } } }
    ];
  }

  const conversations = await prisma.supportConversation.findMany({
    where: whereCondition,
    include: {
      user: {
        select: { id: true, name: true, email: true, avatarUrl: true }
      },
      agent: {
        select: { id: true, name: true, email: true, avatarUrl: true }
      },
      _count: {
        select: { messages: true }
      }
    },
    orderBy: { updatedAt: 'desc' }
  });

  return conversations;
}

export async function getConversationDetail(conversationId: number) {
  const conversation = await prisma.supportConversation.findUnique({
    where: { id: conversationId },
    include: {
      user: {
        select: { id: true, name: true, email: true, avatarUrl: true }
      },
      agent: {
        select: { id: true, name: true, email: true, avatarUrl: true }
      },
      messages: {
        orderBy: { createdAt: 'asc' }
      },
      ticket: {
        select: { id: true, code: true, title: true, status: true }
      }
    }
  });

  return conversation;
}

export async function acceptConversation(conversationId: number, adminId: number) {
  const updated = await prisma.supportConversation.update({
    where: { id: conversationId },
    data: {
      status: 'AGENT_HANDLING',
      assignedTo: adminId
    },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      agent: { select: { id: true, name: true, email: true, avatarUrl: true } },
      messages: { orderBy: { createdAt: 'asc' } }
    }
  });

  await prisma.supportMessage.create({
    data: {
      conversationId,
      senderType: 'SYSTEM',
      content: 'Nhân viên CSKH đã tiếp nhận cuộc trò chuyện.',
      isSystemNotice: true
    }
  });

  return updated;
}

export async function convertChatToTicket(
  conversationId: number,
  adminId: number,
  input: ConvertChatToTicketInput
) {
  const conversation = await prisma.supportConversation.findUnique({
    where: { id: conversationId },
    include: {
      user: true,
      ticket: true
    }
  });

  if (!conversation) {
    throw new Error('Không tìm thấy cuộc trò chuyện');
  }

  const cleanDescription = input.description?.trim() ? input.description.trim() : input.title.trim();

  // Bọc tạo Ticket, cập nhật Conversation và tạo Message hệ thống trong 1 Atomic Transaction
  const { ticket, systemMsg } = await prisma.$transaction(async (tx) => {
    const ticketCode = await generateTicketCode(tx);

    const createdTicket = await tx.supportTicket.create({
      data: {
        code: ticketCode,
        title: input.title.trim(),
        description: cleanDescription,
        category: input.category as TicketCategory,
        priority: input.priority as TicketPriority,
        status: 'OPEN',
        creatorId: conversation.userId,
        assigneeId: adminId,
        sourceConversationId: conversation.id
      },
      include: {
        creator: { select: { id: true, name: true, email: true, avatarUrl: true } },
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true } }
      }
    });

    if (input.attachments && input.attachments.length > 0) {
      await tx.supportTicketComment.create({
        data: {
          ticketId: createdTicket.id,
          senderId: adminId,
          content: 'Tệp/Hình ảnh đính kèm khi chuyển từ Chat',
          attachments: input.attachments
        }
      });
    }

    await tx.supportConversation.update({
      where: { id: conversationId },
      data: {
        status: 'CONVERTED_TO_TICKET',
        closedAt: new Date()
      }
    });

    const systemNotice = await tx.supportMessage.create({
      data: {
        conversationId,
        senderType: 'SYSTEM',
        content: `Cuộc trò chuyện này đã được chuyển thành yêu cầu hỗ trợ mã #${createdTicket.code}.`,
        isSystemNotice: true
      }
    });

    return { ticket: createdTicket, systemMsg: systemNotice };
  });

  // Bắn Socket Realtime thông báo cho phía Client & Admin
  try {
    const io = getIO();
    if (io) {
      const convertPayload = {
        conversationId,
        ticketId: ticket.id,
        ticketCode: ticket.code,
        status: 'CONVERTED_TO_TICKET'
      };
      io.to(`conversation_${conversationId}`).emit(CHAT_SOCKET_EVENTS.CONVERSATION_CONVERTED, convertPayload);
      io.to(`user_${conversation.userId}`).emit(CHAT_SOCKET_EVENTS.CONVERSATION_CONVERTED, convertPayload);
      io.to(`conversation_${conversationId}`).emit(CHAT_SOCKET_EVENTS.NEW_MESSAGE, { conversationId, message: systemMsg });
      io.to('admin_agents').emit(TICKET_SOCKET_EVENTS.CREATED, ticket);
    }
  } catch (err) {
    console.error('[Socket] Error broadcasting convertChatToTicket:', err);
  }

  return ticket;
}

export async function resolveConversation(conversationId: number) {
  const conversation = await prisma.supportConversation.update({
    where: { id: conversationId },
    data: {
      status: 'RESOLVED',
      closedAt: new Date()
    }
  });

  await prisma.supportMessage.create({
    data: {
      conversationId,
      senderType: 'SYSTEM',
      content: 'Cuộc trò chuyện đã hoàn tất.',
      isSystemNotice: true
    }
  });

  return conversation;
}

export function getAdminPresenceStatus() {
  return adminPresenceStore.getStatus();
}

/* HELPER SERVICES */

/**
 * Worker tự động chuyển các cuộc chat WAITING_AGENT quá timeoutMinutes thành Ticket
 */
export async function autoEscalateTimeoutConversations(timeoutMinutes = 5) {
  const timeoutThreshold = new Date(Date.now() - timeoutMinutes * 60 * 1000);

  const expiredConversations = await prisma.supportConversation.findMany({
    where: {
      status: 'WAITING_AGENT',
      updatedAt: { lt: timeoutThreshold }
    }
  });

  for (const conv of expiredConversations) {
    const ticketCode = await generateTicketCode();
    const autoTicket = await prisma.supportTicket.create({
      data: {
        code: ticketCode,
        title: `Hỗ trợ tự động chuyển từ Chat - ${conv.code}`,
        description: `Tự động tạo do thời gian chờ quá ${timeoutMinutes} phút.`,
        category: 'OTHER',
        priority: 'HIGH',
        status: 'OPEN',
        creatorId: conv.userId,
        sourceConversationId: conv.id
      }
    });

    await prisma.supportConversation.update({
      where: { id: conv.id },
      data: {
        status: 'CONVERTED_TO_TICKET',
        closedAt: new Date()
      }
    });

    const systemNoticeMsg = await prisma.supportMessage.create({
      data: {
        conversationId: conv.id,
        senderType: 'SYSTEM',
        content: `Hệ thống đã tự động chuyển yêu cầu chat này thành Ticket #${autoTicket.code} do thời gian chờ lâu.`,
        isSystemNotice: true
      }
    });

    // Bắn Socket Realtime
    try {
      const io = getIO();
      if (io) {
        const convertPayload = {
          conversationId: conv.id,
          ticketId: autoTicket.id,
          ticketCode: autoTicket.code,
          status: 'CONVERTED_TO_TICKET'
        };
        io.to(`conversation_${conv.id}`).emit(CHAT_SOCKET_EVENTS.CONVERSATION_CONVERTED, convertPayload);
        io.to(`user_${conv.userId}`).emit(CHAT_SOCKET_EVENTS.CONVERSATION_CONVERTED, convertPayload);
        io.to(`conversation_${conv.id}`).emit(CHAT_SOCKET_EVENTS.NEW_MESSAGE, { conversationId: conv.id, message: systemNoticeMsg });
        io.to('admin_agents').emit(TICKET_SOCKET_EVENTS.CREATED, autoTicket);
      }
    } catch (err) {
      console.error('[Socket] Error broadcasting autoEscalateTimeoutConversations:', err);
    }
  }

  return expiredConversations.length;
}
