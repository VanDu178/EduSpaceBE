import type { Response, NextFunction } from 'express';
import type { User } from '@prisma/client';
import prisma from '../config/db';
import { verifyAccessToken } from '../utils/authHelper';
import { AppError } from '../utils/appError';
import { asyncHandler } from '../utils/asyncHandler';
import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: Omit<User, 'password'>;
}

/**
 * Middleware kiểm tra Access Token hợp lệ.
 */
export const authMiddleware = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(
        'Unauthorized: Access token is missing or invalid',
        401,
        'UNAUTHORIZED'
      );
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    if (!decoded) {
      throw new AppError(
        'Unauthorized: Access token has expired or is invalid',
        401,
        'UNAUTHORIZED'
      );
    }

    // Lấy thông tin user từ database để bảo đảm user vẫn tồn tại
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      throw new AppError(
        'Unauthorized: User not found',
        401,
        'UNAUTHORIZED'
      );
    }

    // Gán thông tin user (loại bỏ password) vào request
    const { password, ...userWithoutPassword } = user;
    req.user = userWithoutPassword;

    next();
  }
);
