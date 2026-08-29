import express from 'express';
import {
  getVietqrBanks,
  getVietqrBankById,
  syncVietqrBanks,
  toggleVietqrBankStatus,
} from './controller';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { adminMiddleware } from '../../middlewares/adminMiddleware';

const router = express.Router();

// Yêu cầu tất cả các route bên dưới phải đăng nhập và có quyền Admin
router.use(authMiddleware as any);
router.use(adminMiddleware as any);

// Lấy danh sách ngân hàng VietQR
router.get('/', getVietqrBanks as any);

// Lấy chi tiết thông tin 1 ngân hàng
router.get('/:id', getVietqrBankById as any);

// Đồng bộ danh sách ngân hàng từ VietQR API
router.post('/sync', syncVietqrBanks as any);

// Bật/tắt trạng thái kích hoạt của ngân hàng
router.patch('/:id/status', toggleVietqrBankStatus as any);

export default router;
