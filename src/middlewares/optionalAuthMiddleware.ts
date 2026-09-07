import type { Response, NextFunction } from 'express';
import { verifyAccessToken } from '../modules/auth/utils';
import { asyncHandler } from '../utils/asyncHandler';
import { getUserWithSubscription, AuthenticatedRequest } from './authMiddleware';

/**
 * Middleware xác thực tùy chọn (Optional Auth).
 * Tự động trích xuất thông tin User nếu có Token hợp lệ, nhưng KHÔNG chặn lỗi 401 nếu thiếu Token.
 * Dùng cho các Endpoint Client công khai hỗ trợ xem thử (Teaser) hoặc hiển thị nội dung tùy thuộc quyền đăng nhập.
 */
export const optionalAuthMiddleware = asyncHandler(
  async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = undefined;
      return next();
    }

    const token = authHeader.split(' ')[1];
    let decoded: any = null;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      req.user = undefined;
      return next();
    }

    if (!decoded || !decoded.userId) {
      req.user = undefined;
      return next();
    }

    try {
      const userWithSub = await getUserWithSubscription(decoded.userId);
      if (!userWithSub || userWithSub.status === 'locked') {
        req.user = undefined;
        return next();
      }
      req.user = userWithSub;
    } catch {
      req.user = undefined;
    }

    next();
  }
);
