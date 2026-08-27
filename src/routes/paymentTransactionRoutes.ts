import { Router } from 'express';
import {
  createTransaction,
  getTransactionStatus,
  cancelTransaction,
  approveTransaction,
  getTransactions
} from '../controllers/paymentTransactionController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { adminMiddleware } from '../middlewares/adminMiddleware';

const router = Router();

// Route công khai kiểm tra trạng thái đơn (Client polling)
router.get('/status/:code', getTransactionStatus as any);

// Các route yêu cầu đăng nhập User
router.post('/', authMiddleware as any, createTransaction as any);
router.post('/cancel/:code', authMiddleware as any, cancelTransaction as any);

// Các route dành riêng cho Admin
router.get('/', authMiddleware as any, adminMiddleware as any, getTransactions as any);
router.post('/:id/approve', authMiddleware as any, adminMiddleware as any, approveTransaction as any);

export default router;
