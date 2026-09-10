import { Router } from 'express';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { adminMiddleware } from '../../middlewares/adminMiddleware';
import * as ticketController from './controller';

const router = Router();

// Tất cả các route ticketSupport đều bắt buộc đăng nhập (Auth Middleware)
router.use(authMiddleware as any);

router.post('/tickets', ticketController.createTicketHandler as any);
router.get('/tickets', ticketController.getTicketsHandler as any);
router.get('/tickets/:id', ticketController.getTicketByIdHandler as any);
router.post('/tickets/:id/read', ticketController.markTicketAsReadHandler as any);
router.post('/tickets/:id/comments', ticketController.addTicketCommentHandler as any);

// Các route yêu cầu quyền Admin
router.patch('/tickets/:id/status', adminMiddleware as any, ticketController.updateTicketStatusHandler as any);
router.patch('/tickets/:id', adminMiddleware as any, ticketController.updateTicketHandler as any);

export default router;
