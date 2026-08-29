import type { Request, Response } from 'express';
import prisma from '../config/db';
import { AppError } from '../utils/appError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/responseHelper';
import { generatePlanCode } from '../utils/codeGenerator';

/**
 * Lấy danh sách gói hội viên kèm danh sách các tính năng.
 * - Client xem (Public): CHỈ lấy các gói isActive = true
 * - Admin xem: Lấy tất cả hoặc lọc theo query parameter isActive
 */
export const getMembershipPlans = asyncHandler(async (req: Request, res: Response) => {
  const { isActive } = req.query;

  const whereClause: any = {};
  if (isActive === 'true') {
    whereClause.isActive = true;
  } else if (isActive === 'false') {
    whereClause.isActive = false;
  }

  const plans = await prisma.membershipPlan.findMany({
    where: whereClause,
    include: {
      planFeatures: {
        include: {
          feature: true
        }
      },
      _count: {
        select: {
          subscriptions: true,
          paymentTransactions: true
        }
      }
    },
    orderBy: [
      { tierLevel: 'asc' },
      { createdAt: 'asc' }
    ]
  });

  const mappedPlans = plans.map((plan) => ({
    ...plan,
    subscriberCount: (plan._count?.subscriptions || 0) + (plan._count?.paymentTransactions || 0),
    hasSubscribers: ((plan._count?.subscriptions || 0) + (plan._count?.paymentTransactions || 0)) > 0
  }));

  return sendSuccess(res, mappedPlans, 'Lấy danh sách gói hội viên thành công');
});

/**
 * Lấy chi tiết gói hội viên theo ID hoặc mã Code.
 */
export const getMembershipPlanById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const planId = parseInt(id as string, 10);

  let plan;
  if (!isNaN(planId)) {
    plan = await prisma.membershipPlan.findUnique({
      where: { id: planId },
      include: {
        planFeatures: {
          include: {
            feature: true
          }
        }
      }
    });
  } else {
    plan = await prisma.membershipPlan.findUnique({
      where: { code: (id as string).toUpperCase() },
      include: {
        planFeatures: {
          include: {
            feature: true
          }
        }
      }
    });
  }

  if (!plan) {
    throw new AppError('Gói hội viên không tồn tại', 404, 'NOT_FOUND');
  }

  return sendSuccess(res, plan, 'Lấy thông tin gói hội viên thành công');
});

/**
 * Tạo mới gói hội viên (Chỉ Admin).
 * - Mã code được tự động sinh theo format PLN-XXXXXX
 * - planFeatures: [{ featureId: number, isAvailable: boolean }]
 */
export const createMembershipPlan = asyncHandler(async (req: Request, res: Response) => {
  const {
    name,
    tagLine,
    monthlyPrice,
    yearlyPrice,
    yearlyDiscountPercent,
    popularBadge,
    buttonText,
    planFeatures,
    tierLevel,
    isActive
  } = req.body;

  if (!name || name.trim() === '') {
    throw new AppError(
      'Tên gói hội viên là bắt buộc.',
      400,
      'VALIDATION_ERROR',
      { name: ['Tên gói hội viên là bắt buộc.'] }
    );
  }

  const mPrice = monthlyPrice !== undefined ? Number(monthlyPrice) : 0;
  const discount = yearlyDiscountPercent !== undefined ? Number(yearlyDiscountPercent) : 0;
  let yPrice = yearlyPrice !== undefined ? Number(yearlyPrice) : 0;
  if (yearlyDiscountPercent !== undefined || (mPrice > 0 && discount > 0)) {
    yPrice = Math.round(mPrice * 12 * (1 - discount / 100));
  }

  // Bước 1: Tạo gói với mã tạm thời
  const tempPlan = await prisma.membershipPlan.create({
    data: {
      code: `PLN-TEMP-${Date.now()}`,
      name: name.trim(),
      tagLine: tagLine ? tagLine.trim() : null,
      monthlyPrice: mPrice,
      yearlyPrice: yPrice,
      yearlyDiscountPercent: discount,
      popularBadge: popularBadge ? popularBadge.trim() : null,
      buttonText: buttonText ? buttonText.trim() : null,
      tierLevel: tierLevel !== undefined ? Number(tierLevel) : 1,
      isActive: isActive !== undefined ? Boolean(isActive) : true
    }
  });

  // Bước 2: Thêm liên kết tính năng (planFeatures) nếu có
  if (Array.isArray(planFeatures) && planFeatures.length > 0) {
    await prisma.membershipPlanFeature.createMany({
      data: planFeatures.map((pf: { featureId: number; isAvailable: boolean }) => ({
        planId: tempPlan.id,
        featureId: Number(pf.featureId),
        isAvailable: Boolean(pf.isAvailable)
      }))
    });
  }

  // Bước 3: Sinh mã định danh chuẩn PLN-XXXXXX và cập nhật
  const code = generatePlanCode(tempPlan.id);
  const plan = await prisma.membershipPlan.update({
    where: { id: tempPlan.id },
    data: { code },
    include: {
      planFeatures: {
        include: {
          feature: true
        }
      }
    }
  });

  return sendSuccess(res, plan, 'Tạo gói hội viên thành công', 201);
});

/**
 * Cập nhật gói hội viên (Chỉ Admin).
 */
export const updateMembershipPlan = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const planId = parseInt(id as string, 10);

  if (isNaN(planId)) {
    throw new AppError('Mã gói hội viên không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const existing = await prisma.membershipPlan.findUnique({
    where: { id: planId }
  });

  if (!existing) {
    throw new AppError('Gói hội viên không tồn tại', 404, 'NOT_FOUND');
  }

  // Chặn cập nhật nếu gói đã có lượt đăng ký/giao dịch
  const subCount = await prisma.userSubscription.count({ where: { planId } });
  const txCount = await prisma.paymentTransaction.count({ where: { planId } });
  if (subCount > 0 || txCount > 0) {
    throw new AppError('Gói hội viên đã có người đăng ký hoặc có lịch sử giao dịch. Không thể cập nhật gói này.', 400, 'VALIDATION_ERROR');
  }

  const {
    name,
    tagLine,
    monthlyPrice,
    yearlyPrice,
    yearlyDiscountPercent,
    popularBadge,
    buttonText,
    planFeatures,
    tierLevel,
    isActive
  } = req.body;

  const updateData: any = {};

  if (name !== undefined) {
    if (!name.trim()) {
      throw new AppError('Tên gói hội viên không được để trống', 400, 'VALIDATION_ERROR');
    }
    updateData.name = name.trim();
  }
  if (tagLine !== undefined) updateData.tagLine = tagLine ? tagLine.trim() : null;
  if (monthlyPrice !== undefined) updateData.monthlyPrice = Number(monthlyPrice);
  if (yearlyDiscountPercent !== undefined) updateData.yearlyDiscountPercent = Number(yearlyDiscountPercent);
  
  // Tính toán lại yearlyPrice khi có monthlyPrice hoặc yearlyDiscountPercent
  const targetMonthlyPrice = monthlyPrice !== undefined ? Number(monthlyPrice) : Number(existing.monthlyPrice);
  const targetDiscountPercent = yearlyDiscountPercent !== undefined ? Number(yearlyDiscountPercent) : Number(existing.yearlyDiscountPercent);

  if (monthlyPrice !== undefined || yearlyDiscountPercent !== undefined) {
    updateData.yearlyPrice = Math.round(targetMonthlyPrice * 12 * (1 - targetDiscountPercent / 100));
  } else if (yearlyPrice !== undefined) {
    updateData.yearlyPrice = Number(yearlyPrice);
  }

  if (popularBadge !== undefined) updateData.popularBadge = popularBadge ? popularBadge.trim() : null;
  if (buttonText !== undefined) updateData.buttonText = buttonText ? buttonText.trim() : null;
  if (tierLevel !== undefined) updateData.tierLevel = Number(tierLevel);
  if (isActive !== undefined) updateData.isActive = Boolean(isActive);

  // Cập nhật thông tin gói
  await prisma.membershipPlan.update({
    where: { id: planId },
    data: updateData
  });

  // Cập nhật liên kết planFeatures nếu được truyền lên
  if (Array.isArray(planFeatures)) {
    await prisma.membershipPlanFeature.deleteMany({
      where: { planId }
    });

    if (planFeatures.length > 0) {
      await prisma.membershipPlanFeature.createMany({
        data: planFeatures.map((pf: { featureId: number; isAvailable: boolean }) => ({
          planId,
          featureId: Number(pf.featureId),
          isAvailable: Boolean(pf.isAvailable)
        }))
      });
    }
  }

  const updatedPlan = await prisma.membershipPlan.findUnique({
    where: { id: planId },
    include: {
      planFeatures: {
        include: {
          feature: true
        }
      }
    }
  });

  return sendSuccess(res, updatedPlan, 'Cập nhật gói hội viên thành công');
});

/**
 * Bật/Tắt nhanh trạng thái hoạt động của gói (isActive) (Chỉ Admin).
 */
export const toggleMembershipPlanStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const planId = parseInt(id as string, 10);

  if (isNaN(planId)) {
    throw new AppError('Mã gói hội viên không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const existing = await prisma.membershipPlan.findUnique({
    where: { id: planId }
  });

  if (!existing) {
    throw new AppError('Gói hội viên không tồn tại', 404, 'NOT_FOUND');
  }

  // Chặn chuyển đổi trạng thái nếu gói đã có lượt đăng ký/giao dịch
  const subCount = await prisma.userSubscription.count({ where: { planId } });
  const txCount = await prisma.paymentTransaction.count({ where: { planId } });
  if (subCount > 0 || txCount > 0) {
    throw new AppError('Gói hội viên đã có người đăng ký hoặc có lịch sử giao dịch. Không thể chuyển đổi trạng thái gói này.', 400, 'VALIDATION_ERROR');
  }

  const updated = await prisma.membershipPlan.update({
    where: { id: planId },
    data: { isActive: !existing.isActive },
    include: {
      planFeatures: {
        include: {
          feature: true
        }
      }
    }
  });

  const message = updated.isActive
    ? 'Đã kích hoạt gói hội viên'
    : 'Đã ẩn gói hội viên';

  return sendSuccess(res, updated, message);
});

/**
 * Xóa gói hội viên (Chỉ Admin).
 * - Nếu gói đang có lịch sử đăng ký thì chặn xóa để đảm bảo toàn vẹn dữ liệu.
 */
export const deleteMembershipPlan = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const planId = parseInt(id as string, 10);

  if (isNaN(planId)) {
    throw new AppError('Mã gói hội viên không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const existing = await prisma.membershipPlan.findUnique({
    where: { id: planId }
  });

  if (!existing) {
    throw new AppError('Gói hội viên không tồn tại', 404, 'NOT_FOUND');
  }

  // Kiểm tra xem đã có lượt đăng ký hoặc giao dịch nào liên quan tới gói này chưa
  const subCount = await prisma.userSubscription.count({
    where: { planId }
  });
  const txCount = await prisma.paymentTransaction.count({
    where: { planId }
  });

  if (subCount > 0 || txCount > 0) {
    throw new AppError(
      `Không thể xóa gói "${existing.name}" vì đã có lịch sử đăng ký hoặc giao dịch sử dụng.`,
      400,
      'VALIDATION_ERROR'
    );
  }

  await prisma.membershipPlan.delete({
    where: { id: planId }
  });

  return sendSuccess(res, null, 'Xóa gói hội viên thành công');
});
