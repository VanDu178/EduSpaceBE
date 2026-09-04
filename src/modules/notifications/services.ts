import prisma from '../../config/db';
import { io } from '../../config/socket/socketManager';

export async function getUserNotifications(userId: number, page: number = 1, limit: number = 20) {
  const skip = (page - 1) * limit;

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return {
    notifications,
    unreadCount,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function markNotificationAsRead(userId: number, notificationId?: number) {
  if (notificationId) {
    await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  } else {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  const unreadCount = await prisma.notification.count({
    where: { userId, isRead: false },
  });

  return { unreadCount };
}

export async function createAndSendNotification(data: {
  userId: number;
  title: string;
  content: string;
  type?: 'TICKET_CREATED' | 'TICKET_REPLIED' | 'TICKET_STATUS_CHANGED' | 'SYSTEM';
  link?: string;
}) {
  const notification = await prisma.notification.create({
    data: {
      userId: data.userId,
      title: data.title,
      content: data.content,
      type: data.type || 'SYSTEM',
      link: data.link,
    },
  });

  if (io) {
    const unreadCount = await prisma.notification.count({
      where: { userId: data.userId, isRead: false },
    });

    io.to(`user_${data.userId}`).emit('notification:new', {
      notification,
      unreadCount,
    });
  }

  return notification;
}

export async function notifyAllAdmins(data: {
  title: string;
  content: string;
  type?: 'TICKET_CREATED' | 'TICKET_REPLIED' | 'TICKET_STATUS_CHANGED' | 'SYSTEM';
  link?: string;
  excludeUserId?: number;
}) {
  const admins = await prisma.user.findMany({
    where: { role: 'admin' },
    select: { id: true },
  });

  const targetAdmins = admins.filter((a) => a.id !== data.excludeUserId);

  for (const admin of targetAdmins) {
    await createAndSendNotification({
      userId: admin.id,
      title: data.title,
      content: data.content,
      type: data.type,
      link: data.link,
    });
  }
}
