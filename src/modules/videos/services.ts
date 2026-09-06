import { PrismaClient, Prisma } from '@prisma/client';
import { AppError } from '../../utils/appError';
import { deleteFromSupabase, extractStoragePath } from '../../services/supabaseStorageService';
import { VIDEO_ERROR_CODES } from './constants';

const prisma = new PrismaClient();

/**
 * TẦNG 3: Xử lý Nghiệp vụ & Giao tiếp Database (Prisma)
 * Sắp xếp thứ tự 1-1 tương ứng với các handler function trong controller.ts
 */

/**
 * 1. Service lấy danh sách Video có lọc, tìm kiếm và phân trang
 */
export async function getVideosListService(queryData: any) {
  const { page, limit, search, videoTypeId, sourceType, status, isPremium, sortBy, sortOrder } = queryData;
  const skip = (page - 1) * limit;

  const where: Prisma.VideoWhereInput = {};

  // Điều kiện tìm kiếm theo từ khóa (tiêu đề, mã code, slug)
  if (search && search.trim() !== '') {
    const keyword = search.trim();
    where.OR = [
      { title: { contains: keyword } },
      { code: { contains: keyword } },
      { slug: { contains: keyword } },
    ];
  }

  // Điều kiện lọc theo Loại Video
  if (videoTypeId) {
    where.videoTypeId = videoTypeId;
  }

  // Điều kiện lọc theo Phân loại Nguồn (direct_upload / youtube)
  if (sourceType) {
    where.sourceType = sourceType;
  }

  // Điều kiện lọc theo Trạng thái (draft / published / archived)
  if (status) {
    where.status = status;
  }

  // Điều kiện lọc theo chế độ Premium
  if (typeof isPremium === 'boolean') {
    where.isPremium = isPremium;
  }

  // Truy vấn song song dữ liệu và tổng số lượng bản ghi
  const [videos, total] = await Promise.all([
    prisma.video.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        videoType: {
          select: { id: true, code: true, name: true },
        },
        creator: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    }),
    prisma.video.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    videos,
    pagination: {
      total,
      page,
      limit,
      totalPages,
    },
  };
}

/**
 * 2. Service lấy chi tiết 1 Video theo ID
 */
export async function getVideoByIdService(existingVideo: any) {
  return existingVideo;
}

/**
 * 3. Service tạo mới Video
 */
export async function createVideoService(validatedData: any) {
  try {
    const newVideo = await prisma.video.create({
      data: validatedData,
      include: {
        videoType: {
          select: { id: true, code: true, name: true },
        },
        creator: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    return newVideo;
  } catch (error: any) {
    console.error('Lỗi khi tạo mới Video:', error);
    throw new AppError('Tạo mới Video thất bại: ' + (error?.message || ''), 500, VIDEO_ERROR_CODES.CREATE_FAILED);
  }
}

/**
 * 4. Service cập nhật thông tin Video
 */
export async function updateVideoService(existingVideo: any, validatedData: any) {
  try {
    // Nếu có cập nhật storagePath mới khác storagePath cũ, dọn dẹp file cũ trên Supabase Storage
    if (
      validatedData.storagePath &&
      existingVideo.storagePath &&
      validatedData.storagePath !== existingVideo.storagePath
    ) {
      await deleteFromSupabase(existingVideo.storagePath);
    }

    // Nếu có cập nhật thumbnailUrl mới khác thumbnailUrl cũ, dọn dẹp file thumbnail cũ nếu thuộc Supabase Storage
    if (
      validatedData.thumbnailUrl &&
      existingVideo.thumbnailUrl &&
      validatedData.thumbnailUrl !== existingVideo.thumbnailUrl
    ) {
      const oldThumbPath = extractStoragePath(existingVideo.thumbnailUrl);
      if (oldThumbPath) {
        await deleteFromSupabase(oldThumbPath);
      }
    }

    const updatedVideo = await prisma.video.update({
      where: { id: existingVideo.id },
      data: validatedData,
      include: {
        videoType: {
          select: { id: true, code: true, name: true },
        },
        creator: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    return updatedVideo;
  } catch (error: any) {
    console.error('Lỗi khi cập nhật Video:', error);
    throw new AppError('Cập nhật Video thất bại: ' + (error?.message || ''), 500, VIDEO_ERROR_CODES.UPDATE_FAILED);
  }
}

/**
 * 5. Service cập nhật nhanh trạng thái Video (draft / published / archived)
 */
export async function updateVideoStatusService(id: string, status: string) {
  const updatedVideo = await prisma.video.update({
    where: { id },
    data: { status },
    include: {
      videoType: {
        select: { id: true, code: true, name: true },
      },
    },
  });

  return updatedVideo;
}

/**
 * 6. Service cập nhật nhanh quyền truy cập (isPremium) và thời lượng xem thử (teaserDuration)
 */
export async function updateVideoAccessService(id: string, isPremium: boolean, teaserDuration?: number) {
  const updateData: Prisma.VideoUpdateInput = { isPremium };
  if (typeof teaserDuration === 'number') {
    updateData.teaserDuration = teaserDuration;
  }

  const updatedVideo = await prisma.video.update({
    where: { id },
    data: updateData,
    include: {
      videoType: {
        select: { id: true, code: true, name: true },
      },
    },
  });

  return updatedVideo;
}

/**
 * 7. Service xóa Video & dọn dẹp tài nguyên Supabase Storage
 */
export async function deleteVideoService(existingVideo: any) {
  try {
    // 1. Tự động dọn dẹp file video gốc trên Supabase nếu có
    if (existingVideo.storagePath) {
      await deleteFromSupabase(existingVideo.storagePath);
    }

    // 2. Tự động dọn dẹp file thumbnail trên Supabase nếu có
    if (existingVideo.thumbnailUrl) {
      const thumbPath = extractStoragePath(existingVideo.thumbnailUrl);
      if (thumbPath) {
        await deleteFromSupabase(thumbPath);
      }
    }

    // 3. Xóa bản ghi trong MySQL DB
    await prisma.video.delete({
      where: { id: existingVideo.id },
    });

    return { id: existingVideo.id, code: existingVideo.code, title: existingVideo.title };
  } catch (error: any) {
    console.error('Lỗi khi xóa Video:', error);
    throw new AppError('Xóa Video thất bại: ' + (error?.message || ''), 500, VIDEO_ERROR_CODES.DELETE_FAILED);
  }
}

/* ==========================================
 * HELPER SERVICES
 * ========================================== */

/**
 * Lấy danh sách 2 Loại Video cố định hệ thống (Học thuật & Nhận định thị trường)
 */
export async function getVideoTypesService() {
  const videoTypes = await prisma.videoType.findMany({
    orderBy: { id: 'asc' },
  });

  return videoTypes;
}
