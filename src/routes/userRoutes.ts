import { Router } from 'express';
import { getUsers, createUser, updateUser, resetPassword } from '../controllers/userController';
import { authMiddleware } from '../middlewares/authMiddleware';
import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { AppError } from '../utils/appError';

const router = Router();

// Middleware kiểm tra quyền Admin
const adminOnly = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin') {
    return next(new AppError('Quyền truy cập bị từ chối. Chỉ dành cho Admin.', 403, 'FORBIDDEN'));
  }
  next();
};

// Đảm bảo tất cả các route bên dưới đều cần đăng nhập và có quyền Admin
router.use(authMiddleware as any);
router.use(adminOnly as any);

// Định nghĩa các endpoints
router.get('/', getUsers as any);
router.post('/', createUser as any);
router.put('/:id', updateUser as any);
router.post('/:id/reset-password', resetPassword as any);

export default router;
