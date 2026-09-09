import { PrismaClient } from '@prisma/client';
import { deleteBunnyVideo } from '../services/bunnyStreamService';

const prisma = new PrismaClient();

const ORPHAN_CUTOFF_HOURS = 24; // Session PENDING > 24h được coi là mồ côi
const SESSION_RETENTION_DAYS = 7; // Xóa các bản ghi UploadSession cũ > 7 ngày khỏi DB

/**
 * Cronjob tự động dọn dẹp các tệp Video mồ côi trên Bunny Stream & giải phóng bản ghi UploadSession cũ.
 */
export async function runCleanupBunnyUploadsJob(): Promise<{ cleanedCount: number; purgedSessionsCount: number; errorsCount: number }> {
  console.log('[CRONJOB CLEANUP] Bắt đầu tiến trình kiểm tra & dọn dẹp UploadSession...');

  let cleanedCount = 0;
  let purgedSessionsCount = 0;
  let errorsCount = 0;

  // 1. Dọn dẹp Video mồ côi trên Bunny Stream cho các session PENDING > 24h
  const orphanCutoffTime = new Date(Date.now() - ORPHAN_CUTOFF_HOURS * 60 * 60 * 1000);

  try {
    const expiredSessions = await prisma.uploadSession.findMany({
      where: {
        status: 'PENDING',
        createdAt: {
          lt: orphanCutoffTime,
        },
      },
    });

    if (expiredSessions.length > 0) {
      console.log(`[CRONJOB CLEANUP] Phát hiện ${expiredSessions.length} phiên upload PENDING mồ côi (> 24h). Bắt đầu xóa trên Bunny...`);

      for (const session of expiredSessions) {
        try {
          console.log(`[CRONJOB CLEANUP] Đang xóa video mồ côi ${session.bunnyVideoId} trên Bunny Stream...`);
          const deleted = await deleteBunnyVideo(session.bunnyVideoId);

          if (deleted) {
            await prisma.uploadSession.update({
              where: { id: session.id },
              data: { status: 'FAILED' },
            });
            cleanedCount++;
            console.log(`[CRONJOB CLEANUP] Đã dọn dẹp xong video ${session.bunnyVideoId} trên Bunny Stream`);
          } else {
            errorsCount++;
            console.warn(`[CRONJOB CLEANUP] Xóa video ${session.bunnyVideoId} thất bại từ phía Bunny Stream API`);
          }
        } catch (err) {
          errorsCount++;
          console.error(`[CRONJOB CLEANUP] Lỗi xử lý session ${session.id}:`, err);
        }
      }
    } else {
      console.log('[CRONJOB CLEANUP] Không có video mồ côi PENDING nào cần dọn dẹp trên Bunny Stream.');
    }
  } catch (error) {
    console.error('[CRONJOB CLEANUP] Lỗi khi dọn dẹp video mồ côi Bunny:', error);
    errorsCount++;
  }

  // 2. Dọn dẹp bản ghi UploadSession cũ (> 7 ngày) khỏi cơ sở dữ liệu
  try {
    const retentionCutoffTime = new Date(Date.now() - SESSION_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const deletedResult = await prisma.uploadSession.deleteMany({
      where: {
        createdAt: {
          lt: retentionCutoffTime,
        },
      },
    });

    purgedSessionsCount = deletedResult.count;
    if (purgedSessionsCount > 0) {
      console.log(`[CRONJOB CLEANUP] Đã xóa thành công ${purgedSessionsCount} bản ghi UploadSession cũ (> 7 ngày) khỏi CSDL.`);
    } else {
      console.log('[CRONJOB CLEANUP] Không có bản ghi UploadSession cũ (> 7 ngày) nào cần xóa khỏi CSDL.');
    }
  } catch (error) {
    console.error('[CRONJOB CLEANUP] Lỗi khi giải phóng bản ghi UploadSession cũ:', error);
    errorsCount++;
  }

  console.log(`[CRONJOB CLEANUP] Hoàn tất tiến trình: ${cleanedCount} video mồ côi được dọn dẹp, ${purgedSessionsCount} session cũ được xóa, ${errorsCount} lỗi.`);
  return { cleanedCount, purgedSessionsCount, errorsCount };
}

/**
 * Khởi chạy Cronjob định kỳ theo chu kỳ millisecond (mặc định mỗi 6 giờ 1 lần)
 */
export function initCleanupBunnyUploadsCron(intervalMs: number = 6 * 60 * 60 * 1000) {
  // Chạy lần đầu tiên sau 1 phút khi server vừa khởi động
  setTimeout(() => {
    runCleanupBunnyUploadsJob().catch((err) =>
      console.error('[CRONJOB INIT ERROR]', err)
    );
  }, 60 * 1000);

  // Định kỳ lặp lại theo chu kỳ
  setInterval(() => {
    runCleanupBunnyUploadsJob().catch((err) =>
      console.error('[CRONJOB INTERVAL ERROR]', err)
    );
  }, intervalMs);

  console.log('[CRONJOB CLEANUP] Đã đăng ký Cronjob dọn dẹp Bunny Uploads mồ côi & Log cũ (Chu kỳ 6 giờ).');
}
