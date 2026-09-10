import prisma from '../config/db';

const NOTIFICATION_RETENTION_DAYS = 15;

/**
 * Cronjob tự động dọn dẹp các tin nhắn/thông báo đã đọc (isRead = true) sau 15 ngày kể từ khi đọc.
 */
export async function runCleanupReadNotificationsJob(): Promise<{ purgedCount: number; errorsCount: number }> {
  console.log('[CRONJOB NOTIFICATION CLEANUP] Bắt đầu kiểm tra & dọn dẹp thông báo đã đọc...');

  let purgedCount = 0;
  let errorsCount = 0;

  try {
    const cutoffDate = new Date(Date.now() - NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    // Xóa các thông báo đã đọc (isRead = true) mà thời điểm readAt (hoặc createdAt nếu readAt chưa được ghi nhận) cũ hơn 15 ngày
    const deleteResult = await prisma.notification.deleteMany({
      where: {
        isRead: true,
        OR: [
          {
            readAt: {
              lt: cutoffDate,
            },
          },
          {
            readAt: null,
            createdAt: {
              lt: cutoffDate,
            },
          },
        ],
      },
    });

    purgedCount = deleteResult.count;
    if (purgedCount > 0) {
      console.log(`[CRONJOB NOTIFICATION CLEANUP] Đã xóa thành công ${purgedCount} thông báo đã đọc (> 15 ngày) khỏi CSDL.`);
    } else {
      console.log('[CRONJOB NOTIFICATION CLEANUP] Không có thông báo đã đọc nào (> 15 ngày) cần dọn dẹp.');
    }
  } catch (error) {
    console.error('[CRONJOB NOTIFICATION CLEANUP] Lỗi khi giải phóng thông báo đã đọc cũ:', error);
    errorsCount++;
  }

  console.log(`[CRONJOB NOTIFICATION CLEANUP] Hoàn tất tiến trình: ${purgedCount} thông báo đã xóa, ${errorsCount} lỗi.`);
  return { purgedCount, errorsCount };
}

/**
 * Khởi chạy Cronjob định kỳ theo chu kỳ millisecond (mặc định 12 giờ 1 lần)
 */
export function initCleanupReadNotificationsCron(intervalMs: number = 12 * 60 * 60 * 1000) {
  // Chạy lần đầu tiên sau 1 phút khi server vừa khởi động
  setTimeout(() => {
    runCleanupReadNotificationsJob().catch((err) =>
      console.error('[CRONJOB NOTIFICATION INIT ERROR]', err)
    );
  }, 60 * 1000);

  // Định kỳ lặp lại theo chu kỳ
  setInterval(() => {
    runCleanupReadNotificationsJob().catch((err) =>
      console.error('[CRONJOB NOTIFICATION INTERVAL ERROR]', err)
    );
  }, intervalMs);

  console.log('[CRONJOB NOTIFICATION CLEANUP] Đã đăng ký Cronjob dọn dẹp thông báo đã đọc cũ > 15 ngày (Chu kỳ 12 giờ).');
}
