import type { Socket } from 'socket.io';
import { CHAT_SOCKET_EVENTS } from '../../../modules/chatSupport/constants';
import { TICKET_SOCKET_EVENTS } from '../../../modules/ticketSupport/constants';

export function registerSupportSocketHandlers(socket: Socket) {
  // Tham gia phòng trò chuyện cụ thể
  socket.on(CHAT_SOCKET_EVENTS.JOIN_CONVERSATION, ({ conversationId }: { conversationId: number }) => {
    if (conversationId) {
      socket.join(`conversation_${conversationId}`);
    }
  });

  // Rời phòng trò chuyện
  socket.on(CHAT_SOCKET_EVENTS.LEAVE_CONVERSATION, ({ conversationId }: { conversationId: number }) => {
    if (conversationId) {
      socket.leave(`conversation_${conversationId}`);
    }
  });

  // Tham gia phòng ticket cụ thể
  socket.on(TICKET_SOCKET_EVENTS.JOIN_TICKET, ({ ticketId }: { ticketId: number }) => {
    if (ticketId) {
      socket.join(`ticket_${ticketId}`);
    }
  });

  // Rời phòng ticket
  socket.on(TICKET_SOCKET_EVENTS.LEAVE_TICKET, ({ ticketId }: { ticketId: number }) => {
    if (ticketId) {
      socket.leave(`ticket_${ticketId}`);
    }
  });
}
