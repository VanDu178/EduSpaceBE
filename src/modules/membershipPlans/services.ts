import prisma from '../../config/db';
import { AppError } from '../../utils/appError';
import { generatePlanCode } from './utils';
import type { GetMembershipPlansQuery, CreateMembershipPlanBody, UpdateMembershipPlanBody } from './zodSchemas';

/**
 * 1. Service Lấy danh sách gói hội viên kèm số lượt người dùng đăng ký
 */
export const getMembershipPlansService = async (query: GetMembershipPlansQuery) => {
  const { isActive } = query;

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
          subscriptions: {
            where: {
              endDate: { gte: new Date() }
            }
          }
        }
      }
    },
    orderBy: [
      { tierLevel: 'asc' },
      { createdAt: 'asc' }
    ]
  });

  return plans.map((plan) => ({
    ...plan,
    subscriberCount: plan._count?.subscriptions || 0,
    hasSubscribers: (plan._count?.subscriptions || 0) > 0
  }));
};

/**
 * 2. Service Lấy chi tiết gói hội viên theo ID hoặc Mã Code
 */
export const getMembershipPlanByIdService = async (params: { id: string }) => {
  const { id } = params;
  const planId = parseInt(id, 10);

  const plan = !isNaN(planId)
    ? await prisma.membershipPlan.findUnique({
        where: { id: planId },
        include: {
          planFeatures: {
            include: {
              feature: true
            }
          },
          _count: {
            select: {
              subscriptions: {
                where: {
                  endDate: { gte: new Date() }
                }
              }
            }
          }
        }
      })
    : await prisma.membershipPlan.findUnique({
        where: { code: id.toUpperCase() },
        include: {
          planFeatures: {
            include: {
              feature: true
            }
          },
          _count: {
            select: {
              subscriptions: {
                where: {
                  endDate: { gte: new Date() }
                }
              }
            }
          }
        }
      });

  if (!plan) {
    throw new AppError('Gói hội viên không tồn tại', 404, 'NOT_FOUND');
  }

  return {
    ...plan,
    subscriberCount: plan._count?.subscriptions || 0,
    hasSubscribers: (plan._count?.subscriptions || 0) > 0
  };
};

/**
 * 3. Service Tạo gói hội viên mới (Admin)
 */
export const createMembershipPlanService = async (body: CreateMembershipPlanBody) => {
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
  } = body;

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

  return plan;
};

/**
 * 4. Service Cập nhật gói hội viên (Admin)
 */
export const updateMembershipPlanService = async (
  planId: number,
  existing: any,
  body: UpdateMembershipPlanBody
) => {
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
  } = body;

  const updateData: any = {};

  if (name !== undefined) {
    updateData.name = name.trim();
  }
  if (tagLine !== undefined) updateData.tagLine = tagLine ? tagLine.trim() : null;
  if (monthlyPrice !== undefined) updateData.monthlyPrice = Number(monthlyPrice);
  if (yearlyDiscountPercent !== undefined) updateData.yearlyDiscountPercent = Number(yearlyDiscountPercent);

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
          isAvailable: Boolean(pf.isAvailable),
          disabledAt: null
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
      },
      _count: {
        select: {
          subscriptions: {
            where: {
              endDate: { gte: new Date() }
            }
          }
        }
      }
    }
  });

  return {
    ...updatedPlan,
    subscriberCount: updatedPlan?._count?.subscriptions || 0,
    hasSubscribers: (updatedPlan?._count?.subscriptions || 0) > 0
  };
};

/**
 * 5. Service Bật/Tắt nhanh trạng thái hoạt động gói hội viên (Admin)
 */
export const toggleMembershipPlanStatusService = async (planId: number, existing: any) => {
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

  return {
    data: updated,
    message
  };
};

/**
 * 6. Service Xóa gói hội viên (Admin)
 */
export const deleteMembershipPlanService = async (planId: number) => {
  await prisma.membershipPlan.delete({
    where: { id: planId }
  });
};
