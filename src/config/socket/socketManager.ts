import { Server as SocketIOServer, Socket } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { verifyAccessToken } from '../../modules/auth/utils';
import prisma from '../db';
import { registerSupportSocketHandlers } from './handlers/supportSocketHandler';
import { CHAT_SOCKET_EVENTS } from '../../modules/chatSupport/constants';

export let io: SocketIOServer | null = null;

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  const allowedOrigins = [
    process.env.CLIENT_FE_URL,
    process.env.ADMIN_FE_URL,
  ].filter(Boolean) as string[];

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true
    }
  });

  // Socket Authentication Middleware
  io.use(async (socket: Socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication token is missing'));
      }

      const decoded = verifyAccessToken(token);
      if (!decoded || !decoded.userId) {
        return next(new Error('Invalid or expired token'));
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, name: true, email: true, role: true }
      });

      if (!user) {
        return next(new Error('User not found'));
      }

      (socket as any).user = user;
      next();
    } catch (err) {
      next(new Error('Socket authentication error'));
    }
  });

  // Helper broadcast trạng thái Trực CSKH tự động dựa trên số Admin sockets active
  const checkAndBroadcastAdminPresence = () => {
    if (!io) return;
    const adminRoom = io.sockets.adapter.rooms.get('admin_agents');
    const activeAdminCount = adminRoom ? adminRoom.size : 0;
    const isOnline = activeAdminCount > 0;

    io.emit(CHAT_SOCKET_EVENTS.ADMIN_PRESENCE_UPDATED, {
      isOnline,
      activeAdminCount
    });
  };

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;

    // Join cá nhân user room
    socket.join(`user_${user.id}`);

    // Nếu là Admin, join vào room `admin_agents` và cập nhật Presence
    if (user.role === 'admin') {
      socket.join('admin_agents');
      checkAndBroadcastAdminPresence();
    }

    // Đăng ký các Handler phân hệ Support Chat
    registerSupportSocketHandlers(socket);

    socket.on('disconnect', () => {
      if (user.role === 'admin') {
        setTimeout(() => {
          checkAndBroadcastAdminPresence();
        }, 100);
      }
    });
  });

  // Schedule auto-escalate timeout worker cứ 2 phút quét 1 lần
  setInterval(async () => {
    try {
      const chatSupportService = await import('../../modules/chatSupport/services');
      const escalatedCount = await chatSupportService.autoEscalateTimeoutConversations(5);
      if (escalatedCount > 0 && io) {
        io.to('admin_agents').emit(CHAT_SOCKET_EVENTS.CONVERSATIONS_AUTO_ESCALATED, { count: escalatedCount });
      }
    } catch (err) {
      console.error('[SocketManager] Auto escalation error:', err);
    }
  }, 2 * 60 * 1000);

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.io server chưa được khởi tạo!');
  }
  return io;
}

export function isAgentAvailable(): boolean {
  if (!io) return false;
  const adminRoom = io.sockets.adapter.rooms.get('admin_agents');
  return Boolean(adminRoom && adminRoom.size > 0);
}
