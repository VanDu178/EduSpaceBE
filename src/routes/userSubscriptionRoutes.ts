import { Router } from 'express';
import {
  getSubscriptions,
  getMySubscriptions,
  getSubscriptionById,
  createSubscription,
  updateSubscriptionStatus
} from '../controllers/userSubscriptionController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { adminMiddleware } from '../middlewares/adminMiddleware';

const router = Router();

// Tất cả các route bên dưới bắt buộc phải đăng nhập
router.use(authMiddleware as any);

// User đang đăng nhập tự xem danh sách đăng ký cá nhân
router.get('/my-subscriptions', getMySubscriptions as any);

// Xem chi tiết 1 đơn đăng ký (Chính chủ sở hữu hoặc Admin)
router.get('/:id', getSubscriptionById as any);

// Tạo mới đăng ký (User tự mua hoặc Admin gán gói)
router.post('/', createSubscription as any);

// Các Route dành riêng cho Admin
router.get('/', adminMiddleware as any, getSubscriptions as any);
router.patch('/:id/status', adminMiddleware as any, updateSubscriptionStatus as any);


export default router;
