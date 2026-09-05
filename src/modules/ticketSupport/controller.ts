import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../middlewares/authMiddleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/responseHelper';
import * as validation from './validation';
import * as ticketService from './services';

/**
 * 1. Handler tạo Ticket mới
 */
export const createTicketHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId, input } = validation.validateCreateTicket(req);
  const ticket = await ticketService.createTicket(userId, input);

  return sendSuccess(res, ticket, 'Tạo yêu cầu hỗ trợ (Ticket) thành công', 201);
});

/**
 * 2. Handler lấy danh sách Ticket kèm lọc & phân trang
 */
export const getTicketsHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId, role, query } = validation.validateGetTickets(req);
  const result = await ticketService.getTickets(userId, role, query);

  // Giữ cấu trúc phẳng data và pagination để 100% tương thích với FE Client & FE Admin
  return res.status(200).json({
    success: true,
    message: 'Lấy danh sách Ticket thành công',
    data: result.tickets,
    pagination: result.pagination
  });
});

/**
 * 3. Handler lấy chi tiết Ticket theo ID
 */
export const getTicketByIdHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { ticketId } = await validation.validateGetTicketById(req);
  const ticket = await ticketService.getTicketById(ticketId);

  return sendSuccess(res, ticket, 'Lấy chi tiết Ticket thành công');
});

/**
 * 4. Handler thêm phản hồi (comment) vào Ticket
 */
export const addTicketCommentHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { ticketId, userId, role, input } = await validation.validateAddTicketComment(req);
  const comment = await ticketService.addTicketComment(ticketId, userId, role, input);

  return sendSuccess(res, comment, 'Thêm phản hồi thành công', 201);
});

/**
 * 5. Handler cập nhật trạng thái Ticket (Admin)
 */
export const updateTicketStatusHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { ticketId, input } = await validation.validateUpdateTicketStatus(req);
  const updatedTicket = await ticketService.updateTicketStatus(ticketId, input);

  return sendSuccess(res, updatedTicket, 'Cập nhật trạng thái Ticket thành công');
});

/**
 * 6. Handler cập nhật thông tin Ticket (Admin)
 */
export const updateTicketHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { ticketId, input } = await validation.validateUpdateTicket(req);
  const updatedTicket = await ticketService.updateTicket(ticketId, input);

  return sendSuccess(res, updatedTicket, 'Cập nhật thông tin Ticket thành công');
});
