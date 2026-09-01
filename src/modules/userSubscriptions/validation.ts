import prisma from '../../config/db';
import { AppError } from '../../utils/appError';
import { USER_ROLES } from '../auth/constants';
import { BILLING_CYCLES, SUBSCRIPTION_STATUS } from './constants';
import {
  getSubscriptionByIdParamsSchema,
  createSubscriptionSchema,
  getSubscriptionsQuerySchema,
  updateSubscriptionStatusSchema,
  deleteSubscriptionParamsSchema,
} from './zodSchemas';

/**
 * 1. Validate cho getMySubscriptions
 * (Lưu ý: authMiddleware ở route đã xác thực req.user 100%, tầng này chỉ làm nhiệm vụ trích xuất tham số)
 */
export async function validateGetMySubscriptionsData(reqUser: { id: number }) {
  return { userId: reqUser.id };
}

/**
 * 2. Validate cho getSubscriptionById
 */
export async function validateGetSubscriptionByIdData(
  reqUser: { id?: number; role?: string } | undefined,
  params: unknown
) {
  const parseResult = getSubscriptionByIdParamsSchema.safeParse(params);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0] as any;
    const message = firstIssue?.message || 'Mã đăng ký không hợp lệ';
    const errorCode = firstIssue?.params?.errorCode || 'VALIDATION_ERROR';
    const statusCode = firstIssue?.params?.statusCode || 400;
    throw new AppError(message, statusCode, errorCode);
  }

  const subId = parseResult.data.id;

  const subscription = await prisma.userSubscription.findUnique({
    where: { id: subId },
    include: {
      user: {
        select: {
          id: true,
          code: true,
          email: true,
          name: true,
          avatarUrl: true,
        },
      },
      plan: true,
    },
  });

  if (!subscription) {
    throw new AppError('Đơn đăng ký không tồn tại', 404, 'NOT_FOUND');
  }

  // Kiểm tra quyền: Chỉ Admin hoặc chính chủ sở hữu đơn mới được xem
  if (reqUser?.role !== USER_ROLES.ADMIN && reqUser?.id !== subscription.userId) {
    throw new AppError('Bạn không có quyền xem thông tin đơn đăng ký này', 403, 'FORBIDDEN');
  }

  return { subId, subscription };
}

/**
 * 3. Validate cho createSubscription
 */
export async function validateCreateSubscriptionData(
  reqUser: { id?: number; role?: string } | undefined,
  body: any
) {
  const parseResult = createSubscriptionSchema.safeParse(body);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0] as any;
    const message = firstIssue?.message || 'Dữ liệu đăng ký không hợp lệ';
    const errorCode = firstIssue?.params?.errorCode || 'VALIDATION_ERROR';
    const statusCode = firstIssue?.params?.statusCode || 400;
    throw new AppError(message, statusCode, errorCode);
  }

  const {
    userId: bodyUserId,
    planId,
    billingCycle = BILLING_CYCLES.MONTHLY,
    paymentMethod,
    paymentRef,
    status = SUBSCRIPTION_STATUS.ACTIVE,
    notes,
    proofUrls,
    startDate: customStartDate,
    endDate: customEndDate,
  } = body || {};

  // Xác định người dùng nhận gói
  const targetUserId =
    reqUser?.role === USER_ROLES.ADMIN && bodyUserId ? parseInt(bodyUserId, 10) : reqUser?.id;

  if (!targetUserId || isNaN(targetUserId)) {
    throw new AppError('Người dùng không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  // Kiểm tra sự tồn tại của User
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
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
    where: { id: parsedPlanId },
  });

  if (!plan) {
    throw new AppError('Gói hội viên không tồn tại', 404, 'NOT_FOUND');
  }

  if (!plan.isActive) {
    throw new AppError('Gói hội viên này hiện đang tạm ẩn, không thể đăng ký', 400, 'VALIDATION_ERROR');
  }

  // Kiểm tra phương thức thanh toán nếu được cung cấp
  if (paymentMethod && String(paymentMethod).trim()) {
    const normalizedCode = String(paymentMethod).trim().toUpperCase();
    const existingMethod = await prisma.paymentMethod.findUnique({
      where: { code: normalizedCode },
    });
    if (!existingMethod) {
      throw new AppError('Phương thức thanh toán không tồn tại trong hệ thống.', 400, 'VALIDATION_ERROR');
    }
    if (!existingMethod.isActive) {
      throw new AppError('Phương thức thanh toán đã chọn hiện đang tạm ngưng.', 400, 'VALIDATION_ERROR');
    }
  }

  return {
    targetUserId,
    planId: parsedPlanId,
    plan,
    billingCycle,
    paymentMethod,
    paymentRef,
    status,
    notes,
    proofUrls,
    customStartDate,
    customEndDate,
  };
}

/**
 * 4. Validate cho getSubscriptions (Admin only)
 */
export async function validateGetSubscriptionsData(query: unknown) {
  const parseResult = getSubscriptionsQuerySchema.safeParse(query);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0] as any;
    const message = firstIssue?.message || 'Tham số tìm kiếm không hợp lệ';
    const errorCode = firstIssue?.params?.errorCode || 'VALIDATION_ERROR';
    const statusCode = firstIssue?.params?.statusCode || 400;
    throw new AppError(message, statusCode, errorCode);
  }

  return parseResult.data;
}

/**
 * 5. Validate cho updateSubscriptionStatus (Admin only)
 */
export async function validateUpdateSubscriptionStatusData(params: any, body: any) {
  const parseResult = updateSubscriptionStatusSchema.safeParse({ ...(params || {}), ...(body || {}) });
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0] as any;
    const message = firstIssue?.message || 'Dữ liệu không hợp lệ';
    const errorCode = firstIssue?.params?.errorCode || 'VALIDATION_ERROR';
    const statusCode = firstIssue?.params?.statusCode || 400;
    throw new AppError(message, statusCode, errorCode);
  }

  const subId = parseResult.data.id;
  const {
    userId,
    planId,
    paymentMethod,
  } = body || {};

  const existing = await prisma.userSubscription.findUnique({
    where: { id: subId },
    include: { plan: true },
  });

  if (!existing) {
    throw new AppError('Đơn đăng ký không tồn tại', 404, 'NOT_FOUND');
  }

  // BẢO VỆ DỮ LIỆU: Bản ghi do Hệ thống (system) tự động kích hoạt KHÔNG CHO PHÉP chỉnh sửa
  if (existing.createdType === 'system') {
    throw new AppError(
      'Gói dịch vụ kích hoạt tự động từ hệ thống thanh toán không được phép chỉnh sửa',
      403,
      'FORBIDDEN'
    );
  }

  // Xử lý cập nhật Người dùng nhận gói (userId)
  if (userId !== undefined && userId !== null) {
    const parsedUserId = parseInt(userId, 10);
    if (isNaN(parsedUserId)) {
      throw new AppError('Người dùng không hợp lệ', 400, 'VALIDATION_ERROR');
    }
    const user = await prisma.user.findUnique({
      where: { id: parsedUserId },
    });
    if (!user) {
      throw new AppError('Người dùng không tồn tại', 404, 'NOT_FOUND');
    }
  }

  // Xử lý cập nhật Gói hội viên (planId)
  if (planId !== undefined && planId !== null) {
    const parsedPlanId = parseInt(planId, 10);
    if (isNaN(parsedPlanId)) {
      throw new AppError('Gói hội viên không hợp lệ', 400, 'VALIDATION_ERROR');
    }
    const plan = await prisma.membershipPlan.findUnique({
      where: { id: parsedPlanId },
    });
    if (!plan) {
      throw new AppError('Gói hội viên không tồn tại', 404, 'NOT_FOUND');
    }
  }

  // Xử lý Phương thức thanh toán (paymentMethod)
  if (paymentMethod !== undefined && paymentMethod && String(paymentMethod).trim()) {
    const normalizedCode = String(paymentMethod).trim().toUpperCase();
    const existingMethod = await prisma.paymentMethod.findUnique({
      where: { code: normalizedCode },
    });
    if (!existingMethod) {
      throw new AppError('Phương thức thanh toán không tồn tại trong hệ thống.', 400, 'VALIDATION_ERROR');
    }
    if (!existingMethod.isActive) {
      throw new AppError('Phương thức thanh toán đã chọn hiện đang tạm ngưng.', 400, 'VALIDATION_ERROR');
    }
  }

  return { subId, existing, body };
}

/**
 * 6. Validate cho deleteSubscription (Admin only)
 */
export async function validateDeleteSubscriptionData(params: unknown) {
  const parseResult = deleteSubscriptionParamsSchema.safeParse(params);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0] as any;
    const message = firstIssue?.message || 'Mã đăng ký không hợp lệ';
    const errorCode = firstIssue?.params?.errorCode || 'VALIDATION_ERROR';
    const statusCode = firstIssue?.params?.statusCode || 400;
    throw new AppError(message, statusCode, errorCode);
  }

  const subId = parseResult.data.id;

  const existing = await prisma.userSubscription.findUnique({
    where: { id: subId },
  });

  if (!existing) {
    throw new AppError('Đơn đăng ký không tồn tại', 404, 'NOT_FOUND');
  }

  // BẢO VỆ DỮ LIỆU: Bản ghi do Hệ thống (system) tự động tạo KHÔNG CHO PHÉP xóa
  if (existing.createdType === 'system') {
    throw new AppError(
      'Gói dịch vụ kích hoạt tự động từ hệ thống thanh toán không được phép xóa',
      403,
      'FORBIDDEN'
    );
  }

  return { subId, existing };
}
