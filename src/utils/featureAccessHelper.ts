import prisma from '../config/db';

/**
 * Kiểm tra xem người dùng có quyền sử dụng một tính năng cụ thể dựa trên gói hội viên đang hoạt động của họ hay không.
 * @param userId ID của người dùng
 * @param featureCode Mã tính năng (ví dụ: 'blog:read_premium')
 */
export const checkUserFeatureAccess = async (
  userId: number,
  featureCode: string
): Promise<{ hasAccess: boolean; reason?: string; message?: string }> => {
  const activeSub = await prisma.userSubscription.findFirst({
    where: {
      userId,
      status: 'active',
      endDate: { gte: new Date() }
    },
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

  if (!activeSub) {
    return { hasAccess: false, reason: 'NO_ACTIVE_SUBSCRIPTION' };
  }

  const planFeature = activeSub.plan.planFeatures.find(
    (pf) => pf.feature.code === featureCode
  );

  if (!planFeature || !planFeature.isAvailable) {
    return { hasAccess: false, reason: 'FEATURE_NOT_IN_PLAN' };
  }

  if (!planFeature.feature.isActive) {
    return {
      hasAccess: false,
      reason: 'FEATURE_DISABLED_SYSTEM',
      message: 'Tính năng này hiện đang tạm dừng ở cấp hệ thống.'
    };
  }

  if (planFeature.disabledAt && new Date() >= new Date(planFeature.disabledAt)) {
    return {
      hasAccess: false,
      reason: 'FEATURE_EXPIRED_GRACE_PERIOD',
      message: 'Tính năng này đã chính thức ngưng hỗ trợ sau thời gian thông báo.'
    };
  }

  return { hasAccess: true };
};
