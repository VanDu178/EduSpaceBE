import type { Request, Response } from 'express';
import prisma from '../config/db';
import { AppError } from '../utils/appError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/responseHelper';
import { generateSubscriptionCode } from '../utils/codeGenerator';
import type { AuthenticatedRequest } from '../middlewares/authMiddleware';

/**
 * Lấy danh sách lịch sử đăng ký & thanh toán (Chỉ Admin).
 * Hỗ trợ phân trang, lọc theo userId, status, và tìm kiếm từ khóa email/mã đơn.
 */
export const getSubscriptions = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 10;
  const skip = (page - 1) * limit;

  const { userId, status, search } = req.query;

  const whereClause: any = {};

  // Lọc theo người dùng cụ thể
  if (userId) {
    const parsedUserId = parseInt(userId as string, 10);
    if (!isNaN(parsedUserId)) {
      whereClause.userId = parsedUserId;
    }
  }

  // Lọc theo trạng thái gói (active, expired, cancelled, pending_payment)
  if (status && status !== 'all') {
    whereClause.status = status as string;
  }

  // Tìm kiếm theo từ khóa (Mã đơn đăng ký, Email người dùng, Tên người dùng)
  if (search && (search as string).trim() !== '') {
    const keyword = (search as string).trim();
    whereClause.OR = [
      { code: { contains: keyword } },
      { user: { email: { contains: keyword } } },
      { user: { name: { contains: keyword } } },
      { plan: { name: { contains: keyword } } }
    ];
  }

  // Đếm tổng số bản ghi
  const totalItems = await prisma.userSubscription.count({
    where: whereClause
  });

  // Lấy dữ liệu phân trang
  const subscriptions = await prisma.userSubscription.findMany({
    where: whereClause,
    skip,
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          code: true,
          email: true,
          name: true,
          avatarUrl: true
        }
      },
      plan: {
        select: {
          id: true,
          code: true,
          name: true,
          monthlyPrice: true,
          yearlyPrice: true,
          popularBadge: true
        }
      }
    }
  });

  const totalPages = Math.ceil(totalItems / limit);

  return sendSuccess(res, {
    items: subscriptions,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems,
      itemsPerPage: limit
    }
  }, 'Lấy danh sách hội viên thành công');
});


/**
 * User đang đăng nhập tự lấy lịch sử đăng ký của chính mình.
 */
export const getMySubscriptions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError('Bạn chưa đăng nhập', 401, 'UNAUTHORIZED');
  }

  const subscriptions = await prisma.userSubscription.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      plan: {
        include: {
          planFeatures: {
            include: {
              feature: true
            }
          }
        }
      }
    }
  });

  // Lấy gói đang có hiệu lực (active và chưa hết hạn)
  const now = new Date();
  const activeSubscription = subscriptions.find(
    sub => sub.status === 'active' && new Date(sub.endDate) >= now
  ) || null;

  return sendSuccess(res, {
    subscriptions,
    activeSubscription
  }, 'Lấy thông tin đăng ký cá nhân thành công');
});

/**
 * Xem chi tiết 1 đơn đăng ký theo ID.
 */
export const getSubscriptionById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const subId = parseInt(id as string, 10);

  if (isNaN(subId)) {
    throw new AppError('Mã đăng ký không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const subscription = await prisma.userSubscription.findUnique({
    where: { id: subId },
    include: {
      user: {
        select: {
          id: true,
          code: true,
          email: true,
          name: true,
          avatarUrl: true
        }
      },
      plan: true
    }
  });

  if (!subscription) {
    throw new AppError('Đơn đăng ký không tồn tại', 404, 'NOT_FOUND');
  }

  // Kiểm tra quyền: Chỉ Admin hoặc chính chủ sở hữu đơn mới được xem
  if (req.user?.role !== 'admin' && req.user?.id !== subscription.userId) {
    throw new AppError('Bạn không có quyền xem thông tin đơn đăng ký này', 403, 'FORBIDDEN');
  }

  return sendSuccess(res, subscription, 'Lấy chi tiết đơn đăng ký thành công');
});

/**
 * Tạo mới một đăng ký gói hội viên (Admin cấp gói hoặc User mua gói).
 */
export const createSubscription = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const {
    userId: bodyUserId,
    planId,
    billingCycle = 'monthly',
    paymentMethod,
    paymentRef,
    status = 'active',
    autoRenew = false
  } = req.body;

  // Xác định người dùng nhận gói
  const targetUserId = req.user?.role === 'admin' && bodyUserId ? parseInt(bodyUserId, 10) : req.user?.id;

  if (!targetUserId || isNaN(targetUserId)) {
    throw new AppError('Người dùng không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  // Kiểm tra sự tồn tại của User
  const user = await prisma.user.findUnique({
    where: { id: targetUserId }
  });

  if (!user) {
    throw new AppError('Người dùng không tồn tại', 404, 'NOT_FOUND');
  }

  // Kiểm tra sự tồn tại của Gói hội viên
  const parsedPlanId = parseInt(planId, 10);
  if (isNaN(parsedPlanId)) {
    throw new AppError('Gói hội viên không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const plan = await prisma.membershipPlan.findUnique({
    where: { id: parsedPlanId }
  });

  if (!plan) {
    throw new AppError('Gói hội viên không tồn tại', 404, 'NOT_FOUND');
  }

  if (!plan.isActive) {
    throw new AppError('Gói hội viên này hiện đang tạm ẩn, không thể đăng ký', 400, 'VALIDATION_ERROR');
  }

  // Tính toán thời gian bắt đầu và hết hạn
  const startDate = new Date();
  const endDate = new Date(startDate);

  if (billingCycle === 'yearly') {
    endDate.setFullYear(endDate.getFullYear() + 1);
  } else {
    endDate.setMonth(endDate.getMonth() + 1);
  }

  // Xác định số tiền thanh toán dựa trên chu kỳ đã chọn
  const pricePaid = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;

  // Nếu tạo gói ở trạng thái 'active', tự động hủy/chuyển trạng thái gói active cũ của User (đảm bảo chỉ 1 gói active tại một thời điểm)
  if (status === 'active') {
    await prisma.userSubscription.updateMany({
      where: {
        userId: targetUserId,
        status: 'active'
      },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelReason: 'Chuyển sang gói mới'
      }
    });
  }

  // Bước 1: Tạo bản ghi với mã tạm
  const tempSub = await prisma.userSubscription.create({
    data: {
      code: `SUB-TEMP-${Date.now()}`,
      userId: targetUserId,
      planId: parsedPlanId,
      billingCycle: billingCycle === 'yearly' ? 'yearly' : 'monthly',
      startDate,
      endDate,
      status: status as any,
      pricePaid,
      paymentMethod: paymentMethod ? String(paymentMethod).trim().toUpperCase() : null,
      paymentRef: paymentRef ? String(paymentRef).trim() : null,
      autoRenew: Boolean(autoRenew)
    }
  });

  // Bước 2: Sinh mã chuẩn SUB-XXXXXX và cập nhật
  const code = generateSubscriptionCode(tempSub.id);
  const subscription = await prisma.userSubscription.update({
    where: { id: tempSub.id },
    data: { code },
    include: {
      plan: true,
      user: {
        select: {
          id: true,
          code: true,
          email: true,
          name: true
        }
      }
    }
  });

  return sendSuccess(res, subscription, 'Đăng ký gói hội viên thành công', 201);
});

/**
 * Cập nhật trạng thái đơn đăng ký (Chỉ Admin duyệt/hủy/gia hạn).
 */
export const updateSubscriptionStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const subId = parseInt(id as string, 10);
  const { status, cancelReason, endDate } = req.body;

  if (isNaN(subId)) {
    throw new AppError('Mã đăng ký không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const existing = await prisma.userSubscription.findUnique({
    where: { id: subId }
  });

  if (!existing) {
    throw new AppError('Đơn đăng ký không tồn tại', 404, 'NOT_FOUND');
  }

  const updateData: any = {};

  if (status) {
    updateData.status = status;

    // Nếu đổi sang active, hủy các gói active khác của cùng user đó
    if (status === 'active') {
      await prisma.userSubscription.updateMany({
        where: {
          userId: existing.userId,
          status: 'active',
          id: { not: subId }
        },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelReason: 'Chuyển sang gói mới'
        }
      });
    }

    if (status === 'cancelled') {
      updateData.cancelledAt = new Date();
      updateData.cancelReason = cancelReason ? String(cancelReason).trim() : 'Admin hủy gói';
    }
  }

  if (endDate) {
    updateData.endDate = new Date(endDate);
  }

  const updated = await prisma.userSubscription.update({
    where: { id: subId },
    data: updateData,
    include: {
      plan: true,
      user: {
        select: {
          id: true,
          code: true,
          email: true,
          name: true
        }
      }
    }
  });

  return sendSuccess(res, updated, 'Cập nhật trạng thái đăng ký thành công');
});
