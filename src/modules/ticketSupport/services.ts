import prisma from '../../config/db';
import { generateTicketCode } from './utils';
import type {
  CreateTicketInput,
  GetTicketsQueryInput,
  UpdateTicketStatusInput,
  UpdateTicketInput,
  AddTicketCommentInput
} from './zodSchemas';
import type { TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';
import { notifyAllAdmins, createAndSendNotification } from '../notifications/services';
import { NOTIFICATION_TYPE } from '../notifications/constants';
import { getIO } from '../../config/socket/socketManager';
import {
  TICKET_STATUS,
  TICKET_SOCKET_EVENTS,
  TICKET_STATUS_LABELS,
  TicketStatusType,
  TICKET_LINKS
} from './constants';

/**
 * 1. Service tạo mới Yêu cầu hỗ trợ (Ticket)
 */
export async function createTicket(userId: number, input: CreateTicketInput) {
  // Hiện tại lấy 1 admin cố định để phân công
  const defaultAdmin = await prisma.user.findFirst({
    where: { role: 'admin', status: 'active' }
  });

  const ticket = await prisma.$transaction(async (tx) => {
    const code = await generateTicketCode(tx);

    const createdTicket = await tx.supportTicket.create({
      data: {
        code,
        title: input.title.trim(),
        description: input.description.trim(),
        category: input.category as TicketCategory,
        priority: input.priority as TicketPriority,
        status: TICKET_STATUS.OPEN,
        creatorId: userId,
        assigneeId: defaultAdmin?.id || null,
        assigneeUnreadCount: 1
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        },
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        }
      }
    });

    // Tạo comment khởi tạo nếu có đính kèm file/ảnh
    if (input.attachments && input.attachments.length > 0) {
      await tx.supportTicketComment.create({
        data: {
          ticketId: createdTicket.id,
          senderId: userId,
          content: 'Tệp đính kèm khi gửi yêu cầu hỗ trợ',
          attachments: input.attachments
        }
      });
    }

    return createdTicket;
  });

  // Trigger Notification ĐÍCH DANH tới Admin phụ trách (nếu có)
  if (ticket.assigneeId) {
    createAndSendNotification({
      userId: ticket.assigneeId,
      title: 'Yêu cầu hỗ trợ mới được phân công',
      content: `Khách hàng ${ticket.creator?.name || ''} đã gửi yêu cầu hỗ trợ mới #${ticket.code}`,
      type: NOTIFICATION_TYPE.TICKET_CREATED,
      link: `${TICKET_LINKS.ADMIN_SUPPORT}?tab=tickets&ticketId=${ticket.id}`,
    }).catch((err) => console.error('[Notification] Error in createTicket createAndSendNotification:', err));
  }

  // Broadcast realtime socket event tới Admin & Creator
  try {
    const io = getIO();
    if (io) {
      io.to('admin_agents').emit(TICKET_SOCKET_EVENTS.CREATED, ticket);
      io.to(`user_${userId}`).emit(TICKET_SOCKET_EVENTS.CREATED, ticket);
    }
  } catch (err) {
    console.error('[Socket] Broadcast create ticket error:', err);
  }

  return ticket;
}

/**
 * 2. Service lấy danh sách Tickets kèm phân trang & lọc
 */
export async function getTickets(
  userId: number,
  role: string,
  query: GetTicketsQueryInput
) {
  const page = Math.max(1, query.page || 1);
  const limit = Math.max(1, Math.min(100, query.limit || 20));

  const whereCondition: any = {};

  if (role !== 'admin') {
    whereCondition.creatorId = userId;
  } else {
    // FE Admin: Load danh sách Ticket được phân công cho Admin hoặc chưa được phân công (null)
    whereCondition.OR = [{ assigneeId: userId }, { assigneeId: null }];
  }

  if (query.status) {
    whereCondition.status = query.status as TicketStatus;
  }
  if (query.category) {
    whereCondition.category = query.category as TicketCategory;
  }
  if (query.priority) {
    whereCondition.priority = query.priority as TicketPriority;
  }
  if (query.search) {
    whereCondition.OR = [
      { code: { contains: query.search, mode: 'insensitive' } },
      { title: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } }
    ];
  }

  if (query.cursor) {
    whereCondition.id = { lt: query.cursor };
  }

  const useSkip = !query.cursor && page > 1;
  const skip = useSkip ? (page - 1) * limit : undefined;

  const [total, fetchedTickets] = await Promise.all([
    prisma.supportTicket.count({ where: whereCondition }),
    prisma.supportTicket.findMany({
      where: whereCondition,
      include: {
        creator: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        },
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        },
        _count: {
          select: { comments: true }
        }
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      skip,
      take: limit + 1
    })
  ]);

  const hasMore = fetchedTickets.length > limit;
  const tickets = hasMore ? fetchedTickets.slice(0, limit) : fetchedTickets;
  const nextCursor = hasMore && tickets.length > 0 ? tickets[tickets.length - 1].id : null;

  return {
    tickets,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      nextCursor,
      hasMore
    }
  };
}

/**
 * 3. Service lấy chi tiết một Ticket theo ID
 */
export async function getTicketById(ticketId: number, role?: string) {
  if (role) {
    await markTicketAsRead(ticketId, role);
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      creator: {
        select: { id: true, name: true, email: true, avatarUrl: true }
      },
      assignee: {
        select: { id: true, name: true, email: true, avatarUrl: true }
      },
      sourceConversation: {
        include: {
          messages: {
            orderBy: { createdAt: 'asc' }
          }
        }
      },
      comments: {
        include: {
          sender: {
            select: { id: true, name: true, email: true, avatarUrl: true, role: true }
          }
        },
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  return ticket;
}

export async function markTicketAsRead(ticketId: number, role: string) {
  if (role === 'admin') {
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { assigneeUnreadCount: 0 }
    });
  } else {
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { creatorUnreadCount: 0 }
    });
  }
}

/**
 * 4. Service thêm phản hồi (comment) vào Ticket
 */
export async function addTicketComment(
  ticketId: number,
  senderId: number,
  role: string,
  input: AddTicketCommentInput
) {
  const comment = await prisma.supportTicketComment.create({
    data: {
      ticketId,
      senderId,
      content: input.content ? input.content.trim() : '',
      attachments: input.attachments ? input.attachments : undefined
    },
    include: {
      sender: {
        select: { id: true, name: true, email: true, avatarUrl: true, role: true }
      }
    }
  });

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, title: true, code: true, creatorId: true, status: true, assigneeId: true }
  });

  // Tự động chuyển trạng thái Ticket:
  // - Nếu Admin trả lời khi đang OPEN hoặc PENDING_USER -> IN_PROGRESS
  // - Nếu User phản hồi khi đang PENDING_USER hoặc RESOLVED -> IN_PROGRESS để Supporter xử lý tiếp
  let nextStatus: TicketStatus = ticket?.status || TICKET_STATUS.OPEN;
  if (role === 'admin' && (ticket?.status === TICKET_STATUS.OPEN || ticket?.status === TICKET_STATUS.PENDING_USER)) {
    nextStatus = TICKET_STATUS.IN_PROGRESS;
  } else if (role !== 'admin' && (ticket?.status === TICKET_STATUS.PENDING_USER || ticket?.status === TICKET_STATUS.RESOLVED)) {
    nextStatus = TICKET_STATUS.IN_PROGRESS;
  }

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      status: nextStatus,
      updatedAt: new Date(),
      creatorUnreadCount: role === 'admin' ? { increment: 1 } : undefined,
      assigneeUnreadCount: role !== 'admin' ? { increment: 1 } : undefined
    }
  });

  // Trigger Notification
  if (ticket) {
    if (role === 'admin' && ticket.creatorId) {
      createAndSendNotification({
        userId: ticket.creatorId,
        title: `Phản hồi mới cho yêu cầu hỗ trợ ${ticket.title}`,
        content: `Bộ phận CSKH vừa trả lời: "${input?.content?.slice(0, 80)}"`,
        type: NOTIFICATION_TYPE.TICKET_REPLIED,
        link: `${TICKET_LINKS.CUSTOMER_SUPPORT}?ticketId=${ticket.id}`
      }).catch((err) => console.error('[Notification] Error sending comment notification to user:', err));
    } else if (role !== 'admin') {
      if (ticket.assigneeId) {
        createAndSendNotification({
          userId: ticket.assigneeId,
          title: `Phản hồi từ khách hàng ở yêu cầu hỗ trợ ${ticket.code}`,
          content: `Khách hàng vừa phản hồi: "${input?.content?.slice(0, 80)}"`,
          type: NOTIFICATION_TYPE.TICKET_REPLIED,
          link: `${TICKET_LINKS.ADMIN_SUPPORT}?tab=tickets&ticketId=${ticket.id}`
        }).catch((err) => console.error('[Notification] Error sending comment notification to assignee admin:', err));
      } else {
        notifyAllAdmins({
          title: `Phản hồi từ khách hàng ở yêu cầu hỗ trợ ${ticket.code}`,
          content: `Khách hàng vừa phản hồi: "${input?.content?.slice(0, 80)}"`,
          type: NOTIFICATION_TYPE.TICKET_REPLIED,
          link: `${TICKET_LINKS.ADMIN_SUPPORT}?tab=tickets&ticketId=${ticket.id}`,
          excludeUserId: senderId
        }).catch((err) => console.error('[Notification] Error sending comment notification to admins:', err));
      }
    }
  }

  // Broadcast Realtime Socket Events bằng HẰNG SỐ CHUẨN
  try {
    const io = getIO();
    if (io) {
      io.to(`ticket_${ticketId}`).emit(TICKET_SOCKET_EVENTS.COMMENT_ADDED, {
        ticketId,
        comment
      });
      io.to(`ticket_${ticketId}`).emit(TICKET_SOCKET_EVENTS.STATUS_CHANGED, {
        ticketId,
        status: nextStatus
      });
      io.to('admin_agents').emit(TICKET_SOCKET_EVENTS.UPDATED, { ticketId, status: nextStatus, comment });

      if (ticket?.creatorId) {
        io.to(`user_${ticket.creatorId}`).emit(TICKET_SOCKET_EVENTS.UPDATED, { ticketId, status: nextStatus, comment });
      }
    }
  } catch (err) {
    console.error('[Socket] Broadcast add ticket comment error:', err);
  }

  return comment;
}

/**
 * 5. Service cập nhật trạng thái của Ticket (Admin)
 */
export async function updateTicketStatus(ticketId: number, input: UpdateTicketStatusInput) {
  const updateData: any = {
    status: input.status as TicketStatus,
    updatedAt: new Date()
  };

  if (input.status === TICKET_STATUS.RESOLVED || input.status === TICKET_STATUS.CLOSED) {
    updateData.resolvedAt = new Date();
  }

  const updatedTicket = await prisma.supportTicket.update({
    where: { id: ticketId },
    data: updateData,
    include: {
      creator: {
        select: { id: true, name: true, email: true, avatarUrl: true }
      },
      assignee: {
        select: { id: true, name: true, email: true, avatarUrl: true }
      },
      comments: {
        include: {
          sender: {
            select: { id: true, name: true, email: true, avatarUrl: true, role: true }
          }
        },
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  // Trigger Notification tới Creator
  if (updatedTicket && updatedTicket.creatorId) {
    const statusText = TICKET_STATUS_LABELS[updatedTicket.status as TicketStatusType] || updatedTicket.status;
    createAndSendNotification({
      userId: updatedTicket.creatorId,
      title: `Trạng thái Ticket #${updatedTicket.title} đã cập nhật`,
      content: `Trạng thái mới: ${statusText}`,
      type: NOTIFICATION_TYPE.TICKET_STATUS_CHANGED,
      link: `${TICKET_LINKS.CUSTOMER_SUPPORT}?ticketId=${updatedTicket.id}`
    }).catch((err) => console.error('[Notification] Error sending status update notification:', err));
  }

  // Broadcast Realtime Socket Events bằng HẰNG SỐ CHUẨN
  try {
    const io = getIO();
    if (io && updatedTicket) {
      io.to(`ticket_${ticketId}`).emit(TICKET_SOCKET_EVENTS.STATUS_CHANGED, updatedTicket);
      io.to('admin_agents').emit(TICKET_SOCKET_EVENTS.UPDATED, updatedTicket);
      if (updatedTicket.creatorId) {
        io.to(`user_${updatedTicket.creatorId}`).emit(TICKET_SOCKET_EVENTS.UPDATED, updatedTicket);
      }
    }
  } catch (err) {
    console.error('[Socket] Broadcast update ticket status error:', err);
  }

  return updatedTicket;
}

/**
 * 6. Service cập nhật thông tin chung của Ticket (Admin)
 */
export async function updateTicket(ticketId: number, input: UpdateTicketInput) {
  const updateData: any = {};
  if (input.priority) updateData.priority = input.priority as TicketPriority;
  if (input.category) updateData.category = input.category as TicketCategory;
  if (input.assigneeId !== undefined) updateData.assigneeId = input.assigneeId;

  const updatedTicket = await prisma.supportTicket.update({
    where: { id: ticketId },
    data: updateData,
    include: {
      creator: {
        select: { id: true, name: true, email: true, avatarUrl: true }
      },
      assignee: {
        select: { id: true, name: true, email: true, avatarUrl: true }
      },
      comments: {
        include: {
          sender: {
            select: { id: true, name: true, email: true, avatarUrl: true, role: true }
          }
        },
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  try {
    const io = getIO();
    if (io && updatedTicket) {
      io.to('admin_agents').emit(TICKET_SOCKET_EVENTS.UPDATED, updatedTicket);
    }
  } catch (err) {
    console.error('[Socket] Broadcast update ticket error:', err);
  }

  return updatedTicket;
}
