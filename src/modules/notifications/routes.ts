import { Router } from 'express';
import { authMiddleware } from '../../middlewares/authMiddleware';
import * as notificationController from './controller';

const router = Router();

router.use(authMiddleware as any);

router.get('/', notificationController.getNotificationsHandler as any);
router.patch('/read', notificationController.markAsReadHandler as any);
router.patch('/:id/read', notificationController.markAsReadHandler as any);

export default router;
