import { PrismaClient } from '@prisma/client';
import { AppError } from '../../utils/appError';
import { uploadToSupabase, deleteFromSupabase } from '../../services/supabaseStorageService';
import { deleteBunnyVideo } from '../../services/bunnyStreamService';
import { UPLOAD_ERROR_CODES } from './constants';
import { getIO } from '../../config/socket/socketManager';
import { VIDEO_SOCKET_EVENTS } from '../videos/constants';

const prisma = new PrismaClient();

/**
 * TẦNG 3: Xử lý nghiệp vụ & Giao tiếp Supabase Storage / Bunny Stream
 */

/**
 * 1. Service upload 1 file đơn lẻ lên Supabase Storage
 */
export async function uploadSingleFileService(
  file: Express.Multer.File,
  folder: string
) {
  const result = await uploadToSupabase(
    file.buffer,
    file.originalname,
    file.mimetype,
    { folder }
  );

  return result;
}

/**
 * 2. Service upload nhiều file đồng thời lên Supabase Storage
 */
export async function uploadMultipleFilesService(
  files: Express.Multer.File[],
  folder: string
) {
  const uploadPromises = files.map((file) =>
    uploadToSupabase(file.buffer, file.originalname, file.mimetype, { folder })
  );

  const results = await Promise.all(uploadPromises);
  return results;
}

/**
 * 3. Service xóa 1 file khỏi Supabase Storage
 */
export async function deleteFileService(filePath: string) {
  const success = await deleteFromSupabase(filePath);
  if (!success) {
    throw new AppError('Xóa tệp thất bại!', 500, UPLOAD_ERROR_CODES.DELETE_FAILED);
  }

  return { path: filePath };
}

/**
 * 4. Service khởi tạo phiên upload Bunny Stream và ghi vết UploadSession (PENDING)
 */
export async function initBunnyStreamSessionService(title: string, userId?: number) {
  const { createBunnyVideoSession } = await import('../../services/bunnyStreamService');
  const session = await createBunnyVideoSession(title);

  if (session?.videoId) {
    try {
      await prisma.uploadSession.create({
        data: {
          bunnyVideoId: session.videoId,
          title,
          userId: userId || null,
          status: 'PENDING',
        },
      });
    } catch (dbErr) {
      console.warn('[UPLOAD SESSION] Không thể ghi vết phiên upload vào DB:', dbErr);
    }
  }

  return session;
}

/**
 * 5. Service xóa video khỏi Bunny Stream khi dọn dẹp hoặc rollback
 */
export async function deleteBunnyVideoService(videoId: string) {
  const success = await deleteBunnyVideo(videoId);
  if (!success) {
    throw new AppError('Xóa video trên Bunny Stream thất bại!', 500, UPLOAD_ERROR_CODES.DELETE_FAILED);
  }

  try {
    await prisma.uploadSession.updateMany({
      where: { bunnyVideoId: videoId },
      data: { status: 'FAILED' },
    });
  } catch (dbErr) {
    console.warn('[UPLOAD SESSION] Không thể cập nhật trạng thái FAILED:', dbErr);
  }

  return { videoId };
}

/**
 * Service hoàn tất UploadSession khi Video được lưu thành công vào CSDL
 */
export async function completeUploadSessionService(storagePath: string) {
  if (!storagePath) return;
  const match = storagePath.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (match) {
    const videoId = match[0];
    try {
      await prisma.uploadSession.updateMany({
        where: { bunnyVideoId: videoId, status: 'PENDING' },
        data: { status: 'COMPLETED' },
      });
    } catch (dbErr) {
      console.warn('[UPLOAD SESSION] Không thể cập nhật trạng thái COMPLETED:', dbErr);
    }
  }
}

/**
 * 6. Service tiếp nhận Webhook từ Bunny Stream để đồng bộ trạng thái mã hóa HLS (processStatus)
 */
export async function handleBunnyWebhookService(body: any) {
  const videoId = body.VideoId || body.videoId || body.guid || body.VideoGuid;
  const status = body.Status !== undefined ? body.Status : body.status;

  if (!videoId) {
    return { message: 'Bỏ qua Webhook: Không tìm thấy VideoId trong payload' };
  }

  const targetVideo = await prisma.video.findFirst({
    where: {
      storagePath: {
        contains: videoId,
      },
    },
  });

  if (!targetVideo) {
    return { message: `Bỏ qua Webhook: Không tìm thấy bản ghi Video với ID ${videoId} trong DB` };
  }

  let newProcessStatus: 'ready' | 'failed' | 'processing' | null = null;

  if (status === 3) {
    newProcessStatus = 'ready';
  } else if (status === 4 || status === 5) {
    newProcessStatus = 'failed';
  } else if (status === 0 || status === 1 || status === 2) {
    newProcessStatus = 'processing';
  }

  if (newProcessStatus && targetVideo.processStatus !== newProcessStatus) {
    await prisma.video.update({
      where: { id: targetVideo.id },
      data: { processStatus: newProcessStatus },
    });
    console.log(`[BUNNY WEBHOOK] Đã cập nhật processStatus của Video ${targetVideo.id} (${targetVideo.title}) sang "${newProcessStatus}"`);

    try {
      const io = getIO();
      if (io) {
        io.emit(VIDEO_SOCKET_EVENTS.PROCESS_STATUS_UPDATED, {
          videoId: targetVideo.id,
          processStatus: newProcessStatus,
        });
      }
    } catch (sockErr) {
      console.warn('[BUNNY WEBHOOK] Không thể phát sự kiện socket real-time:', sockErr);
    }
  }

  return { videoId, status, processStatus: newProcessStatus };
}

