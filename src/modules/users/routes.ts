import { Router } from 'express';
import { getUsers, createUser, updateUser, resetPassword, toggleUserStatus } from './controller';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { adminMiddleware } from '../../middlewares/adminMiddleware';

const router = Router();

// Đảm bảo tất cả các route bên dưới đều cần đăng nhập và có quyền Admin
router.use(authMiddleware as any);
router.use(adminMiddleware as any);


// Định nghĩa các endpoints
router.get('/', getUsers as any);
router.post('/', createUser as any);
router.put('/:id', updateUser as any);
router.put('/:id/status', toggleUserStatus as any);
router.post('/:id/reset-password', resetPassword as any);

export default router;
