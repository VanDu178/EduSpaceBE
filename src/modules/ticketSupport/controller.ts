import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../middlewares/authMiddleware';
import { asyncHandler } from '../../utils/asyncHandler';
import * as validation from './validation';
import * as ticketService from './services';
import { getIO } from '../../config/socket/socketManager';
import prisma from '../../config/db';

export const createTicketHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId, input } = validation.validateCreateTicket(req);
  const ticket = await ticketService.createTicket(userId, input);

  res.status(201).json({
    success: true,
    message: 'Tạo yêu cầu hỗ trợ (Ticket) thành công',
    data: ticket
  });
});

export const getTicketsHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId, role, query } = validation.validateGetTickets(req);
  const result = await ticketService.getTickets(userId, role, query);

  res.status(200).json({
    success: true,
    message: 'Lấy danh sách Ticket thành công',
    data: result.tickets,
    pagination: result.pagination
  });
});

export const getTicketByIdHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { ticketId } = await validation.validateGetTicketById(req);
  const ticket = await ticketService.getTicketById(ticketId);

  res.status(200).json({
    success: true,
    data: ticket
  });
});

export const addTicketCommentHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { ticketId, userId, role, input } = await validation.validateAddTicketComment(req);
  const comment = await ticketService.addTicketComment(ticketId, userId, role, input);

  // Realtime Socket Broadcast
  try {
    const io = getIO();
    if (io) {
      io.to(`ticket_${ticketId}`).emit('ticket_comment_added', {
        ticketId,
        comment
      });

      const ticket = await prisma.supportTicket.findUnique({
        where: { id: ticketId },
        select: { id: true, code: true, creatorId: true, status: true }
      });

      if (ticket) {
        io.to(`ticket_${ticketId}`).emit('ticket_status_updated', {
          ticketId,
          status: ticket.status
        });

        const targetRoom = role === 'admin' ? `user_${ticket.creatorId}` : 'admin_agents';
        io.to(targetRoom).emit('ticket_comment_notice', {
          ticketId: ticket.id,
          ticketCode: ticket.code,
          senderName: comment.sender?.name || 'Hệ thống hỗ trợ',
          content: comment.content
        });
      }
    }
  } catch (err) {
    console.error('[Socket] Broadcast ticket comment error:', err);
  }

  res.status(201).json({
    success: true,
    message: 'Thêm phản hồi thành công',
    data: comment
  });
});

export const updateTicketStatusHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { ticketId, input } = await validation.validateUpdateTicketStatus(req);
  const updatedTicket = await ticketService.updateTicketStatus(ticketId, input);

  // Realtime Socket Broadcast cho trạng thái mới
  try {
    const io = getIO();
    if (io && updatedTicket) {
      io.to(`ticket_${ticketId}`).emit('ticket_status_updated', {
        ticketId,
        status: updatedTicket.status
      });

      io.to(`user_${updatedTicket.creatorId}`).emit('ticket_status_updated', {
        ticketId,
        status: updatedTicket.status
      });
    }
  } catch (err) {
    console.error('[Socket] Broadcast update ticket status error:', err);
  }

  res.status(200).json({
    success: true,
    message: 'Cập nhật trạng thái Ticket thành công',
    data: updatedTicket
  });
});

export const updateTicketHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { ticketId, input } = await validation.validateUpdateTicket(req);
  const updatedTicket = await ticketService.updateTicket(ticketId, input);

  res.status(200).json({
    success: true,
    message: 'Cập nhật thông tin Ticket thành công',
    data: updatedTicket
  });
});
