import type { Response, NextFunction } from 'express';
import type { User } from '@prisma/client';
import prisma from '../config/db';
import { verifyAccessToken } from '../utils/authHelper';
import { AppError } from '../utils/appError';
import { asyncHandler } from '../utils/asyncHandler';
import type { Request } from 'express';
import { getStartOfToday } from '../utils/dateHelpers';

export interface AuthenticatedRequest extends Request {
  user?: Omit<User, 'password'> & {
    isPremium?: boolean;
    plan?: string | null;
    planName?: string | null;
    subscription?: any;
  };
}

/**
 * Helper lấy thông tin User kèm Gói hội viên (UserSubscription) đang hoạt động.
 */
export const getUserWithSubscription = async (userId: number) => {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) return null;

  const { password, ...userWithoutPassword } = user;

  const activeSub = await prisma.userSubscription.findFirst({
    where: {
      userId,
      endDate: { gte: getStartOfToday() }
    },
    include: {
      plan: true
    }
  });

  const isPremium = Boolean(activeSub && activeSub.plan && activeSub.plan.code !== 'FREE');
  const plan = activeSub?.plan?.code || 'FREE';
  const planName = activeSub?.plan?.name || 'Gói Free';

  return {
    ...userWithoutPassword,
    isPremium,
    plan,
    planName,
    subscription: activeSub
      ? {
          id: activeSub.id,
          code: activeSub.code,
          billingCycle: activeSub.billingCycle,
          startDate: activeSub.startDate,
          endDate: activeSub.endDate,
          status: 'active',
          plan: {
            id: activeSub.plan.id,
            code: activeSub.plan.code,
            name: activeSub.plan.name,
          }
        }
      : null
  };
};

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

    // Lấy thông tin user từ database kèm thông tin gói active
    const userWithSub = await getUserWithSubscription(decoded.userId);

    if (!userWithSub) {
      throw new AppError(
        'Unauthorized: User not found',
        401,
        'UNAUTHORIZED'
      );
    }

    // Kiểm tra tài khoản có bị khóa hay không
    if (userWithSub.status === 'locked') {
      throw new AppError(
        'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.',
        401,
        'UNAUTHORIZED'
      );
    }

    // Gán thông tin user (kèm gói active) vào request
    req.user = userWithSub;

    next();
  }
);
