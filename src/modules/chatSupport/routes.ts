import { Router } from 'express';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { adminMiddleware } from '../../middlewares/adminMiddleware';
import * as chatController from './controller';

const router = Router();

router.use(authMiddleware as any);

router.post('/chat/start', chatController.startConversationHandler as any);
router.post('/chat/message', chatController.sendMessageHandler as any);
router.get('/chat/conversations', chatController.getConversationsHandler as any);
router.get('/chat/conversations/:id', chatController.getConversationDetailHandler as any);
router.post('/chat/conversations/:id/read', chatController.markConversationAsReadHandler as any);

// Admin-only Chat Actions
router.post('/chat/conversations/:id/accept', adminMiddleware as any, chatController.acceptConversationHandler as any);
router.post('/chat/convert-to-ticket', adminMiddleware as any, chatController.convertChatToTicketHandler as any);
router.post('/chat/conversations/:id/resolve', adminMiddleware as any, chatController.resolveConversationHandler as any);

// Admin Presence Status Routes
router.get('/admin/status', chatController.getAdminStatusHandler as any);
router.patch('/admin/status', adminMiddleware as any, chatController.setAdminStatusHandler as any);

export default router;
