import prisma from '../config/db';

/**
 * Kiểm tra xem người dùng có quyền sử dụng một tính năng cụ thể dựa trên gói hội viên đang hoạt động của họ hay không.
 * @param userId ID của người dùng
 * @param featureCode Mã tính năng (ví dụ: 'blog:read_premium')
 */
export const checkUserFeatureAccess = async (
  userId: number,
  featureCode: string
): Promise<{ hasAccess: boolean; reason?: string }> => {
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
    (pf) => pf.feature.code === featureCode && pf.isAvailable === true
  );

  if (!planFeature) {
    return { hasAccess: false, reason: 'FEATURE_NOT_IN_PLAN' };
  }

  return { hasAccess: true };
};
