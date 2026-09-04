import prisma from '../../config/db';
import { generateTicketCode } from './utils';
import type { CreateTicketInput, UpdateTicketStatusInput, UpdateTicketInput, AddTicketCommentInput } from './zodSchemas';
import type { TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';
import { notifyAllAdmins, createAndSendNotification } from '../notifications/services';
import { io } from '../../config/socket/socketManager';

export async function createTicket(userId: number, input: CreateTicketInput) {
  const code = generateTicketCode();

  const defaultAdmin = await prisma.user.findFirst({
    where: { role: 'admin', status: 'active' }
  });

  const ticket = await prisma.supportTicket.create({
    data: {
      code,
      title: input.title,
      description: input.description,
      category: input.category as TicketCategory,
      priority: input.priority as TicketPriority,
      status: 'OPEN',
      creatorId: userId,
      assigneeId: defaultAdmin?.id || null
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

  if (input.attachments && input.attachments.length > 0) {
    await prisma.supportTicketComment.create({
      data: {
        ticketId: ticket.id,
        senderId: userId,
        content: 'Hình ảnh/Tệp đính kèm khi khởi tạo Ticket',
        attachments: input.attachments
      }
    });
  }

  // Trigger notification tới tất cả Admins
  notifyAllAdmins({
    title: 'Yêu cầu hỗ trợ mới',
    content: `Khách hàng ${ticket.creator?.name} đã gửi yêu cầu hỗ trợ mới`,
    type: 'TICKET_CREATED',
    link: `admin/support`,
    excludeUserId: userId
  }).catch((err) => console.error('[Notification] Error in createTicket notifyAllAdmins:', err));

  // Broadcast realtime socket event tới Admin & Creator
  if (io) {
    io.to('admin_agents').emit('ticket:created', ticket);
    io.to(`user_${userId}`).emit('ticket:created', ticket);
  }

  return ticket;
}

export async function getTickets(
  userId: number,
  role: string,
  query: {
    status?: string;
    category?: string;
    priority?: string;
    search?: string;
    page?: number;
    limit?: number;
  }
) {
  const page = Math.max(1, query.page || 1);
  const limit = Math.max(1, Math.min(100, query.limit || 20));
  const skip = (page - 1) * limit;

  const whereCondition: any = {};

  if (role !== 'admin') {
    whereCondition.creatorId = userId;
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
      { code: { contains: query.search } },
      { title: { contains: query.search } },
      { description: { contains: query.search } }
    ];
  }

  const [total, tickets] = await Promise.all([
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
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit
    })
  ]);

  return {
    tickets,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
}

export async function getTicketById(ticketId: number) {
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
      content: input.content,
      attachments: input.attachments ? input.attachments : undefined
    },
    include: {
      sender: {
        select: { id: true, name: true, email: true, avatarUrl: true, role: true }
      }
    }
  });

  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId }, select: { code: true, creatorId: true, status: true } });

  let nextStatus: TicketStatus = ticket?.status || 'OPEN';
  if (role === 'admin' && (ticket?.status === 'OPEN' || ticket?.status === 'PENDING_USER')) {
    nextStatus = 'IN_PROGRESS';
  } else if (role !== 'admin' && ticket?.status === 'PENDING_USER') {
    nextStatus = 'IN_PROGRESS';
  }

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      status: nextStatus,
      updatedAt: new Date()
    }
  });

  // Trigger Notification
  if (ticket) {
    if (role === 'admin' && ticket.creatorId) {
      createAndSendNotification({
        userId: ticket.creatorId,
        title: `Phản hồi mới cho Ticket #${ticket.code}`,
        content: `Supporter vừa trả lời: "${input.content.slice(0, 80)}"`,
        type: 'TICKET_REPLIED',
        link: `/ticket-support?ticketId=${ticketId}`
      }).catch((err) => console.error('[Notification] Error sending comment notification to user:', err));
    } else if (role !== 'admin') {
      notifyAllAdmins({
        title: `Phản hồi từ khách hàng ở Ticket #${ticket.code}`,
        content: `Khách hàng vừa phản hồi: "${input.content.slice(0, 80)}"`,
        type: 'TICKET_REPLIED',
        link: `/admin/ticket-support?ticketId=${ticketId}`,
        excludeUserId: senderId
      }).catch((err) => console.error('[Notification] Error sending comment notification to admins:', err));
    }
  }

  // Broadcast realtime socket events
  if (io) {
    io.to(`ticket_${ticketId}`).emit('ticket:comment_added', comment);
    io.to('admin_agents').emit('ticket:updated', { ticketId, status: nextStatus, comment });
    if (ticket?.creatorId) {
      io.to(`user_${ticket.creatorId}`).emit('ticket:updated', { ticketId, status: nextStatus, comment });
    }
  }

  return comment;
}

export async function updateTicketStatus(ticketId: number, input: UpdateTicketStatusInput) {
  const updateData: any = {
    status: input.status as TicketStatus,
    updatedAt: new Date()
  };

  if (input.status === 'RESOLVED' || input.status === 'CLOSED') {
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
    const statusMap: Record<string, string> = {
      OPEN: 'Mở',
      IN_PROGRESS: 'Đang xử lý',
      PENDING_USER: 'Chờ phản hồi từ khách',
      RESOLVED: 'Đã giải quyết',
      CLOSED: 'Đã đóng'
    };
    createAndSendNotification({
      userId: updatedTicket.creatorId,
      title: `Trạng thái Ticket #${updatedTicket.code} đã cập nhật`,
      content: `Trạng thái mới: ${statusMap[updatedTicket.status] || updatedTicket.status}`,
      type: 'TICKET_STATUS_CHANGED',
      link: `/ticket-support?ticketId=${ticketId}`
    }).catch((err) => console.error('[Notification] Error sending status update notification:', err));
  }

  // Broadcast realtime socket events
  if (io) {
    io.to(`ticket_${ticketId}`).emit('ticket:status_changed', updatedTicket);
    io.to('admin_agents').emit('ticket:updated', updatedTicket);
    if (updatedTicket.creatorId) {
      io.to(`user_${updatedTicket.creatorId}`).emit('ticket:updated', updatedTicket);
    }
  }

  return updatedTicket;
}

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

  return updatedTicket;
}
