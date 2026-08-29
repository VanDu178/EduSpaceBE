import prisma from '../config/db';

/**
 * Tự động chuyển isAvailable = false đối với các tính năng có mốc disabledAt đã qua.
 */
export const cleanupExpiredFeatures = async (): Promise<number> => {
  try {
    const result = await prisma.membershipPlanFeature.updateMany({
      where: {
        disabledAt: { lte: new Date() },
        isAvailable: true
      },
      data: {
        isAvailable: false
      }
    });
    return result.count;
  } catch (error) {
    console.error('Lỗi khi cleanup expired features:', error);
    return 0;
  }
};

/**
 * Hàm lên lịch chạy dọn dẹp định kỳ vào mốc 00:00 nửa đêm hàng ngày.
 */
export const scheduleDailyCleanup = (): void => {
  // Chạy dọn dẹp một lần ngay khi server boot
  cleanupExpiredFeatures();

  const now = new Date();
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0, 0, 0, 0
  );
  const timeUntilMidnight = nextMidnight.getTime() - now.getTime();

  // Chờ đến mốc 00:00 nửa đêm nay để chạy, sau đó lập lại mỗi 24 giờ
  setTimeout(() => {
    cleanupExpiredFeatures();
    setInterval(() => {
      cleanupExpiredFeatures();
    }, 24 * 60 * 60 * 1000);
  }, timeUntilMidnight);
};
