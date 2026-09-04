import { Router } from 'express';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { adminMiddleware } from '../../middlewares/adminMiddleware';
import * as ticketController from './controller';

const router = Router();

router.use(authMiddleware as any);

router.post('/tickets', ticketController.createTicketHandler as any);
router.get('/tickets', ticketController.getTicketsHandler as any);
router.get('/tickets/:id', ticketController.getTicketByIdHandler as any);
router.post('/tickets/:id/comments', ticketController.addTicketCommentHandler as any);
router.patch('/tickets/:id/status', adminMiddleware as any, ticketController.updateTicketStatusHandler as any);
router.patch('/tickets/:id', adminMiddleware as any, ticketController.updateTicketHandler as any);

export default router;
