import { Router } from 'express';
import {
  createTransaction,
  getTransactionStatus,
  cancelTransaction,
  approveTransaction,
  handleWebhook,
  getTransactions,
  getMyTransactions,
  downloadInvoicePdf,
} from './controller';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { adminMiddleware } from '../../middlewares/adminMiddleware';

const router = Router();

// Route công khai kiểm tra trạng thái đơn (Client polling) & Xử lý Webhook ngân hàng
router.get('/status/:code', getTransactionStatus as any);
router.post('/webhook', handleWebhook as any);

// Các route yêu cầu đăng nhập User
router.get('/my-transactions', authMiddleware as any, getMyTransactions as any);
router.get('/:code/pdf', authMiddleware as any, downloadInvoicePdf as any);
router.post('/', authMiddleware as any, createTransaction as any);
router.post('/cancel/:code', authMiddleware as any, cancelTransaction as any);

// Các route dành riêng cho Admin
router.get('/', authMiddleware as any, adminMiddleware as any, getTransactions as any);
router.post('/:id/approve', authMiddleware as any, adminMiddleware as any, approveTransaction as any);

export default router;

