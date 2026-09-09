import { PrismaClient, Prisma } from '@prisma/client';
import { AppError } from '../../utils/appError';
import { deleteFromSupabase, extractStoragePath } from '../../services/supabaseStorageService';
import { VIDEO_ERROR_CODES, STREAM_ACCESS_LEVELS, StreamAccessLevel, SOURCE_TYPES } from './constants';
import { evaluateResourceAccess } from '../../services/resourceAccessEngine';
import { deleteBunnyVideo, getBunnyHlsUrl, getBunnyVideoDetails } from '../../services/bunnyStreamService';
import { truncateHlsVariantPlaylist } from './utils';
import { completeUploadSessionService } from '../upload/services';

const prisma = new PrismaClient();

/**
 * TẦNG 3: Xử lý Nghiệp vụ & Giao tiếp Database (Prisma)
 * Sắp xếp thứ tự 1-1 tương ứng với các handler function trong controller.ts
 */

/**
 * 1a. Service lấy danh sách Video dành cho Client (BẢO MẬT - Chỉ lấy video published, loại bỏ dữ liệu nhạy cảm)
 */
export async function getVideosListService(queryData: any) {
  const { page, limit, search, videoTypeId, sourceType, isPremium, sortBy, sortOrder } = queryData;
  const skip = (page - 1) * limit;

  // Bắt buộc Client chỉ được xem danh sách video ở trạng thái 'published'
  const where: Prisma.VideoWhereInput = {
    status: 'published',
  };

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

  // Điều kiện lọc theo chế độ Premium
  if (typeof isPremium === 'boolean') {
    where.isPremium = isPremium;
  }

  // Truy vấn song song dữ liệu và tổng số lượng bản ghi (Chỉ select thông tin công khai)
  const [videos, total] = await Promise.all([
    prisma.video.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        code: true,
        title: true,
        slug: true,
        description: true,
        sourceType: true,
        duration: true,
        teaserDuration: true,
        thumbnailUrl: true,
        isPremium: true,
        videoTypeId: true,
        createdAt: true,
        updatedAt: true,
        videoType: {
          select: { id: true, code: true, name: true },
        },
        creator: {
          select: { id: true, name: true, avatarUrl: true },
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
 * 1b. Service lấy danh sách Video dành cho Admin (Đầy đủ thông tin cho Quản trị)
 */
export async function getAdminVideosListService(queryData: any) {
  const { page, limit, search, videoTypeId, sourceType, status, processStatus, isPremium, sortBy, sortOrder } = queryData;
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

  // Điều kiện lọc theo Trạng thái xử lý HLS (processing / ready / failed)
  if (processStatus) {
    where.processStatus = processStatus;
  }

  // Điều kiện lọc theo chế độ Premium
  if (typeof isPremium === 'boolean') {
    where.isPremium = isPremium;
  }

  // Truy vấn song song dữ liệu và tổng số lượng bản ghi cho Admin (Đầy đủ thuộc tính)
  const [videos, total] = await Promise.all([
    prisma.video.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        code: true,
        title: true,
        slug: true,
        description: true,
        sourceType: true,
        youtubeVideoId: true,
        storagePath: true,
        duration: true,
        teaserDuration: true,
        thumbnailUrl: true,
        isPremium: true,
        status: true,
        processStatus: true,
        videoTypeId: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
        videoType: {
          select: { id: true, code: true, name: true },
        },
        creator: {
          select: { id: true, name: true, avatarUrl: true },
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
 * 2. Service lấy chi tiết Video cho Admin theo ID (Đầy đủ thông tin)
 */
export async function getVideoByIdAdminService(existingVideo: any) {
  return {
    ...existingVideo,
    hasFullAccess: true,
  };
}

/**
 * 3. Service lấy chi tiết Video cho Client theo ID (Dynamic Access Control & Policy Engine)
 */
export async function getVideoByClientService(existingVideo: any, user?: any) {
  const result = await evaluateResourceAccess({
    resourceType: 'video',
    resource: existingVideo,
    featureCode: 'video:watch_premium',
    user,
    behaviorOnDenied: 'teaser',
  });

  return result.data;
}

/**
 * 4. Service lấy chi tiết Video cho Client theo Slug (Dynamic Access Control & Policy Engine)
 */
export async function getVideoBySlugService(slug: string, user?: any) {
  const existingVideo = await prisma.video.findUnique({
    where: { slug },
    include: {
      videoType: {
        select: { id: true, code: true, name: true },
      },
      creator: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
    },
  });

  if (!existingVideo) {
    throw new AppError('Không tìm thấy thông tin video', 404, VIDEO_ERROR_CODES.NOT_FOUND);
  }

  return getVideoByClientService(existingVideo, user);
}

export async function createVideoService(validatedData: any) {
  try {
    const isDirectWithStorage = validatedData.sourceType === SOURCE_TYPES.DIRECT_UPLOAD && validatedData.storagePath;
    const finalData = {
      ...validatedData,
      processStatus: isDirectWithStorage ? 'processing' : (validatedData.processStatus || 'ready'),
    };

    const newVideo = await prisma.video.create({
      data: finalData,
      include: {
        videoType: {
          select: { id: true, code: true, name: true },
        },
        creator: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    if (newVideo.storagePath) {
      await completeUploadSessionService(newVideo.storagePath);
    }

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
    // Không cho phép thay đổi file video mới khi video đang trong tiến trình transcode ngầm
    if (existingVideo.processStatus === 'processing' && validatedData.storagePath) {
      throw new AppError(
        'Video đang trong tiến trình xử lý HLS ngầm, không thể tải đè tệp video mới vào lúc này!',
        400,
        VIDEO_ERROR_CODES.PROCESSING
      );
    }

    // Nếu chuyển sang nguồn YouTube hoặc tải đè storagePath mới, dọn dẹp tệp video cũ trên Bunny / Supabase
    const isSwitchingToYoutube = validatedData.sourceType === SOURCE_TYPES.YOUTUBE && existingVideo.storagePath;
    const isChangingStoragePath =
      validatedData.storagePath &&
      existingVideo.storagePath &&
      validatedData.storagePath !== existingVideo.storagePath;

    if (isSwitchingToYoutube || isChangingStoragePath) {
      const bunnyMatch = existingVideo.storagePath.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      if (
        existingVideo.storagePath.includes('bunny://') ||
        existingVideo.storagePath.includes('b-cdn.net') ||
        bunnyMatch
      ) {
        const videoId = bunnyMatch ? bunnyMatch[0] : existingVideo.storagePath.replace(/^bunny:\/\//, '').split('/')[0];
        await deleteBunnyVideo(videoId);
      } else {
        await deleteFromSupabase(existingVideo.storagePath);
      }
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

    const currentSourceType = validatedData.sourceType || existingVideo.sourceType;
    const isNewVideoUploaded =
      (isChangingStoragePath || (validatedData.storagePath && !existingVideo.storagePath)) &&
      currentSourceType === SOURCE_TYPES.DIRECT_UPLOAD;

    const finalData = {
      ...validatedData,
    };

    if (isSwitchingToYoutube) {
      finalData.processStatus = 'ready';
    } else if (isNewVideoUploaded || (currentSourceType === SOURCE_TYPES.DIRECT_UPLOAD && validatedData.processStatus)) {
      finalData.processStatus = validatedData.processStatus || 'processing';
    }

    const updatedVideo = await prisma.video.update({
      where: { id: existingVideo.id },
      data: finalData,
      include: {
        videoType: {
          select: { id: true, code: true, name: true },
        },
        creator: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    if (updatedVideo.storagePath) {
      await completeUploadSessionService(updatedVideo.storagePath);
    }

    return updatedVideo;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
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
    // Không cho phép xóa video khi đang trong tiến trình transcode ngầm
    if (existingVideo.processStatus === 'processing') {
      throw new AppError(
        'Video đang trong tiến trình xử lý, không thể xóa vào lúc này. Vui lòng chờ hoàn tất!',
        400,
        VIDEO_ERROR_CODES.PROCESSING
      );
    }

    // 1. Tự động dọn dẹp file video trên Bunny Stream hoặc Supabase
    if (existingVideo.storagePath) {
      const bunnyMatch = existingVideo.storagePath.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      if (
        existingVideo.storagePath.includes('bunny://') ||
        existingVideo.storagePath.includes('b-cdn.net') ||
        bunnyMatch
      ) {
        const videoId = bunnyMatch ? bunnyMatch[0] : existingVideo.storagePath.replace(/^bunny:\/\//, '').split('/')[0];
        await deleteBunnyVideo(videoId);
      } else {
        await deleteFromSupabase(existingVideo.storagePath);
      }
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
    if (error instanceof AppError) throw error;
    console.error('Lỗi khi xóa Video:', error);
    throw new AppError('Xóa Video thất bại: ' + (error?.message || ''), 500, VIDEO_ERROR_CODES.DELETE_FAILED);
  }
}

/**
 * 8. Service xử lý Dynamic HLS Playlist (Master / Variant) & Phân quyền Teaser Năng Động
 */
export async function getDynamicHlsPlaylistService(
  existingVideo: any,
  variant?: string,
  user?: any
) {
  // 0. Fallback Sync: Nếu video đang kẹt ở trạng thái 'processing', kiểm tra trực tiếp với Bunny REST API
  if (existingVideo.processStatus === 'processing' && existingVideo.storagePath) {
    const match = existingVideo.storagePath.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (match) {
      const details = await getBunnyVideoDetails(match[0]);
      if (details && (details.status === 3 || details.encodeProgress === 100)) {
        existingVideo.processStatus = 'ready';
        await prisma.video.update({
          where: { id: existingVideo.id },
          data: { processStatus: 'ready' },
        });
        console.log(`[LIVE SYNC FALLBACK] Đã tự động chuyển Video ${existingVideo.id} sang 'ready' khi học viên phát HLS!`);
      } else if (details && (details.status === 4 || details.status === 5)) {
        existingVideo.processStatus = 'failed';
        await prisma.video.update({
          where: { id: existingVideo.id },
          data: { processStatus: 'failed' },
        });
      }
    }
  }

  // Kiểm tra lại trạng thái xử lý HLS của video
  if (existingVideo.processStatus === 'processing') {
    throw new AppError(
      'Video đang trong tiến trình xử lý chất lượng cao, vui lòng thử lại sau ít phút!',
      400,
      VIDEO_ERROR_CODES.PROCESSING
    );
  }

  if (existingVideo.processStatus === 'failed') {
    throw new AppError(
      'Video bị lỗi trong quá trình xử lý HLS, vui lòng tải lại tệp video khác!',
      400,
      VIDEO_ERROR_CODES.NOT_READY
    );
  }

  // 1. Phân định quyền truy cập luồng phát (FULL vs TEASER)
  let accessLevel: StreamAccessLevel = STREAM_ACCESS_LEVELS.TEASER;

  if (!existingVideo.isPremium) {
    accessLevel = STREAM_ACCESS_LEVELS.FULL;
  } else if (user?.role === 'admin') {
    accessLevel = STREAM_ACCESS_LEVELS.FULL;
  } else if (user?.id) {
    // Kiểm tra học viên có gói Subscription đang hoạt động không
    const activeSub = await prisma.userSubscription.findFirst({
      where: {
        userId: user.id,
        endDate: { gte: new Date() },
      },
    });

    if (activeSub) {
      accessLevel = STREAM_ACCESS_LEVELS.FULL;
    }
  }

  // 2. Trả về luồng HLS trực tiếp từ Bunny Stream CDN
  const playlistUrl = getBunnyHlsUrl(existingVideo.storagePath || existingVideo.id);

  return {
    content: playlistUrl,
    playlistUrl,
    accessLevel,
  };
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

/**
 * Service đồng bộ thủ công hoặc theo yêu cầu trạng thái mã hóa HLS (processStatus) từ Bunny Stream REST API
 */
export async function syncVideoProcessStatusService(id: string) {
  const existingVideo = await prisma.video.findUnique({
    where: { id },
  });

  if (!existingVideo) {
    throw new AppError('Không tìm thấy thông tin video', 404, VIDEO_ERROR_CODES.NOT_FOUND);
  }

  if (existingVideo.sourceType !== SOURCE_TYPES.DIRECT_UPLOAD || !existingVideo.storagePath) {
    return existingVideo;
  }

  const match = existingVideo.storagePath.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (!match) {
    return existingVideo;
  }

  const videoDetails = await getBunnyVideoDetails(match[0]);
  if (!videoDetails) {
    return existingVideo;
  }

  let newProcessStatus: 'ready' | 'failed' | 'processing' | null = null;
  if (videoDetails.status === 3 || videoDetails.encodeProgress === 100) {
    newProcessStatus = 'ready';
  } else if (videoDetails.status === 4 || videoDetails.status === 5) {
    newProcessStatus = 'failed';
  }

  if (newProcessStatus && existingVideo.processStatus !== newProcessStatus) {
    const updatedVideo = await prisma.video.update({
      where: { id },
      data: { processStatus: newProcessStatus },
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
  }

  return existingVideo;
}

