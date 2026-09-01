import prisma from '../../config/db';
import { generateSubscriptionCode } from './utils';
import { getStartOfToday, getYesterdayEndOfDay, isSubscriptionActive } from '../../utils/dateHelpers';
import { USER_ROLES } from '../auth/constants';
import { BILLING_CYCLES, CREATED_TYPES, SUBSCRIPTION_STATUS } from './constants';
import type { GetSubscriptionsQueryInput } from './zodSchemas';

/**
 * 1. Service lấy lịch sử đăng ký cá nhân của User
 */
export async function getMySubscriptionsService(userId: number) {
  const subscriptions = await prisma.userSubscription.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      plan: {
        include: {
          planFeatures: {
            include: {
              feature: true,
            },
          },
        },
      },
    },
  });

  // Lấy gói đang có hiệu lực (chưa hết hạn theo ngày)
  const activeSubscriptionRaw =
    subscriptions.find((sub) => isSubscriptionActive(sub.endDate)) || null;

  const formattedSubscriptions = subscriptions.map((sub) => ({
    ...sub,
    status: isSubscriptionActive(sub.endDate)
      ? SUBSCRIPTION_STATUS.ACTIVE
      : SUBSCRIPTION_STATUS.EXPIRED,
  }));

  const activeSubscription = activeSubscriptionRaw
    ? {
        ...activeSubscriptionRaw,
        status: SUBSCRIPTION_STATUS.ACTIVE,
      }
    : null;

  return {
    subscriptions: formattedSubscriptions,
    activeSubscription,
  };
}

/**
 * 2. Service lấy chi tiết 1 đơn đăng ký theo ID
 */
export async function getSubscriptionByIdService(subscription: any) {
  return subscription;
}

/**
 * 3. Service tạo mới đăng ký gói hội viên (Admin cấp hoặc User mua)
 */
export async function createSubscriptionService(
  reqUser: { id?: number; role?: string } | undefined,
  validData: {
    targetUserId: number;
    planId: number;
    plan: any;
    billingCycle?: string;
    paymentMethod?: string | null;
    paymentRef?: string | null;
    status?: string;
    notes?: string | null;
    proofUrls?: string[] | null;
    customStartDate?: string | null;
    customEndDate?: string | null;
  }
) {
  const {
    targetUserId,
    planId,
    plan,
    billingCycle = BILLING_CYCLES.MONTHLY,
    paymentMethod,
    paymentRef,
    notes,
    proofUrls,
    customStartDate,
    customEndDate,
  } = validData;

  // Tính toán thời gian bắt đầu và hết hạn
  const startDate = customStartDate ? new Date(customStartDate) : new Date();
  const endDate = customEndDate ? new Date(customEndDate) : new Date(startDate);

  if (!customEndDate) {
    if (billingCycle === BILLING_CYCLES.YEARLY) {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }
  }

  // Xác định nguồn tạo gói (admin cấp thủ công hoặc system tự động)
  const isAdminCreated = reqUser?.role === USER_ROLES.ADMIN;
  const createdType = isAdminCreated ? CREATED_TYPES.ADMIN : CREATED_TYPES.SYSTEM;
  const createdBy = isAdminCreated && reqUser ? reqUser.id : null;

  // Xử lý danh sách ảnh minh chứng (tối đa 5 ảnh)
  const safeProofUrls = Array.isArray(proofUrls) ? proofUrls.slice(0, 5) : null;

  // Xác định số tiền thanh toán dựa trên chu kỳ đã chọn
  const pricePaid = billingCycle === BILLING_CYCLES.YEARLY ? plan.yearlyPrice : plan.monthlyPrice;

  // Tự động kết thúc thời hạn (chuyển endDate về ngày hôm qua) cho các gói cũ còn hạn của User
  await prisma.userSubscription.updateMany({
    where: {
      userId: targetUserId,
      endDate: { gte: getStartOfToday() },
    },
    data: {
      endDate: getYesterdayEndOfDay(),
    },
  });

  // Bước 1: Tạo bản ghi với mã tạm
  const tempSub = await prisma.userSubscription.create({
    data: {
      code: `SUB-TEMP-${Date.now()}`,
      userId: targetUserId,
      planId,
      billingCycle: billingCycle === BILLING_CYCLES.YEARLY ? BILLING_CYCLES.YEARLY : BILLING_CYCLES.MONTHLY,
      startDate,
      endDate,
      pricePaid,
      paymentMethod: paymentMethod
        ? String(paymentMethod).trim().toUpperCase()
        : isAdminCreated
        ? 'ADMIN_ASSIGNED'
        : null,
      paymentRef: paymentRef ? String(paymentRef).trim() : null,
      createdType,
      createdBy,
      notes: notes ? String(notes).trim() : null,
      proofUrls: safeProofUrls as any,
    },
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
          name: true,
        },
      },
    },
  });

  return subscription;
}

/**
 * 4. Service lấy danh sách hội viên (Admin only)
 */
export async function getSubscriptionsService(queryData: GetSubscriptionsQueryInput) {
  const page = queryData.page || 1;
  const limit = queryData.limit || 10;
  const skip = (page - 1) * limit;

  const { userId, status, search } = queryData;

  const whereClause: any = {};

  // Lọc theo người dùng cụ thể
  if (userId) {
    whereClause.userId = userId;
  }

  // Lọc theo trạng thái gói (active, expired) dựa theo endDate
  if (status && status !== 'all') {
    const startOfToday = getStartOfToday();
    if (status === SUBSCRIPTION_STATUS.ACTIVE) {
      whereClause.endDate = { gte: startOfToday };
    } else if (status === SUBSCRIPTION_STATUS.EXPIRED) {
      whereClause.endDate = { lt: startOfToday };
    }
  }

  // Tìm kiếm theo từ khóa (Mã đơn đăng ký, Email người dùng, Tên người dùng)
  if (search && search.trim() !== '') {
    const keyword = search.trim();
    whereClause.OR = [
      { code: { contains: keyword } },
      { user: { email: { contains: keyword } } },
      { user: { name: { contains: keyword } } },
      { plan: { name: { contains: keyword } } },
    ];
  }

  // Đếm tổng số bản ghi
  const totalItems = await prisma.userSubscription.count({
    where: whereClause,
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
          avatarUrl: true,
        },
      },
      createdByUser: {
        select: {
          id: true,
          code: true,
          email: true,
          name: true,
          avatarUrl: true,
        },
      },
      plan: {
        select: {
          id: true,
          code: true,
          name: true,
          monthlyPrice: true,
          yearlyPrice: true,
          popularBadge: true,
        },
      },
    },
  });

  const formattedItems = subscriptions.map((sub) => ({
    ...sub,
    status: isSubscriptionActive(sub.endDate)
      ? SUBSCRIPTION_STATUS.ACTIVE
      : SUBSCRIPTION_STATUS.EXPIRED,
  }));

  const totalPages = Math.ceil(totalItems / limit);

  return {
    items: formattedItems,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems,
      itemsPerPage: limit,
    },
  };
}

/**
 * 5. Service cập nhật trạng thái đơn đăng ký (Admin only)
 */
export async function updateSubscriptionStatusService(
  subId: number,
  existing: any,
  body: any
) {
  const {
    userId,
    planId,
    billingCycle,
    status,
    paymentMethod,
    paymentRef,
    endDate,
    notes,
    proofUrls,
  } = body || {};

  const updateData: any = {};

  // Xử lý cập nhật Người dùng nhận gói (userId)
  if (userId !== undefined && userId !== null) {
    const parsedUserId = parseInt(userId, 10);
    updateData.userId = parsedUserId;
  }

  // Xử lý cập nhật Gói hội viên
  let planToUse = existing.plan;
  if (planId !== undefined && planId !== null) {
    const parsedPlanId = parseInt(planId, 10);
    const plan = await prisma.membershipPlan.findUnique({
      where: { id: parsedPlanId },
    });
    updateData.planId = parsedPlanId;
    if (plan) {
      planToUse = plan;
    }
  }

  // Xử lý Chu kỳ thanh toán & tính lại Giá tiền
  if (billingCycle !== undefined) {
    updateData.billingCycle =
      billingCycle === BILLING_CYCLES.YEARLY ? BILLING_CYCLES.YEARLY : BILLING_CYCLES.MONTHLY;
  }

  if (planId !== undefined || billingCycle !== undefined) {
    const effectiveCycle = updateData.billingCycle || existing.billingCycle;
    updateData.pricePaid =
      effectiveCycle === BILLING_CYCLES.YEARLY ? planToUse.yearlyPrice : planToUse.monthlyPrice;
  }

  // Xử lý Phương thức thanh toán
  if (paymentMethod !== undefined) {
    if (paymentMethod && String(paymentMethod).trim()) {
      const normalizedCode = String(paymentMethod).trim().toUpperCase();
      updateData.paymentMethod = normalizedCode;
    } else {
      updateData.paymentMethod = null;
    }
  }

  if (paymentRef !== undefined) {
    updateData.paymentRef = paymentRef ? String(paymentRef).trim() : null;
  }

  if (status === SUBSCRIPTION_STATUS.EXPIRED) {
    updateData.endDate = getYesterdayEndOfDay();
  } else if (endDate) {
    updateData.endDate = new Date(endDate);
  }

  const effectiveEndDate = updateData.endDate || existing.endDate;

  if (new Date(effectiveEndDate) >= getStartOfToday()) {
    await prisma.userSubscription.updateMany({
      where: {
        userId: existing.userId,
        endDate: { gte: getStartOfToday() },
        id: { not: subId },
      },
      data: {
        endDate: getYesterdayEndOfDay(),
      },
    });
  }

  if (notes !== undefined) {
    updateData.notes = notes ? String(notes).trim() : null;
  }

  // Dọn dẹp các ảnh bị gỡ bỏ khỏi Supabase Storage để chống rác
  if (proofUrls !== undefined && Array.isArray(proofUrls)) {
    const oldUrls: string[] = Array.isArray(existing.proofUrls)
      ? (existing.proofUrls as string[])
      : [];
    const removedUrls = oldUrls.filter((url) => !proofUrls.includes(url));
    if (removedUrls.length > 0) {
      const { cleanupProofImages } = await import('../../services/supabaseStorageService');
      await cleanupProofImages(removedUrls);
    }
    updateData.proofUrls = proofUrls.slice(0, 5);
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
          name: true,
        },
      },
      createdByUser: {
        select: {
          id: true,
          code: true,
          email: true,
          name: true,
        },
      },
    },
  });

  return updated;
}

/**
 * 6. Service xóa đơn đăng ký gói hội viên (Admin only)
 */
export async function deleteSubscriptionService(subId: number, existing: any) {
  // Dọn dẹp toàn bộ file ảnh minh chứng trên Supabase Storage trước khi xóa khỏi DB
  const oldUrls: string[] = Array.isArray(existing.proofUrls)
    ? (existing.proofUrls as string[])
    : [];
  if (oldUrls.length > 0) {
    const { cleanupProofImages } = await import('../../services/supabaseStorageService');
    await cleanupProofImages(oldUrls);
  }

  await prisma.userSubscription.delete({
    where: { id: subId },
  });

  return { deletedId: subId };
}
