import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './authMiddleware';
import { AppError } from '../utils/appError';

/**
 * Middleware kiểm tra quyền Admin của người dùng.
 * Yêu cầu người dùng phải đăng nhập trước (chạy sau authMiddleware).
 */
export const adminMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'admin') {
    return next(new AppError('Quyền truy cập bị từ chối. Chỉ dành cho Admin.', 403, 'FORBIDDEN'));
  }
  next();
};

// Alias alias adminOnly để thuận tiện và tương thích
export const adminOnly = adminMiddleware;
