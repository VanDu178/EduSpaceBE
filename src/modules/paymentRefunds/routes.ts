import { Router } from 'express';
import { createRefund, getRefunds, updateRefund } from './controller';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { adminMiddleware } from '../../middlewares/adminMiddleware';

const router = Router();

// Các route dành riêng cho Admin / CSKH
router.get('/', authMiddleware as any, adminMiddleware as any, getRefunds as any);
router.post('/', authMiddleware as any, adminMiddleware as any, createRefund as any);
router.put('/:id', authMiddleware as any, adminMiddleware as any, updateRefund as any);

export default router;
