import type { Socket } from 'socket.io';

export function registerSupportSocketHandlers(socket: Socket) {
  // Tham gia phòng trò chuyện cụ thể
  socket.on('join_conversation', ({ conversationId }: { conversationId: number }) => {
    if (conversationId) {
      socket.join(`conversation_${conversationId}`);
    }
  });

  // Rời phòng trò chuyện
  socket.on('leave_conversation', ({ conversationId }: { conversationId: number }) => {
    if (conversationId) {
      socket.leave(`conversation_${conversationId}`);
    }
  });

  // Tham gia phòng ticket cụ thể
  socket.on('join_ticket', ({ ticketId }: { ticketId: number }) => {
    if (ticketId) {
      socket.join(`ticket_${ticketId}`);
    }
  });

  // Rời phòng ticket
  socket.on('leave_ticket', ({ ticketId }: { ticketId: number }) => {
    if (ticketId) {
      socket.leave(`ticket_${ticketId}`);
    }
  });
}
