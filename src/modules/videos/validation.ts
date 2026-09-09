import { PrismaClient } from '@prisma/client';
import { AppError } from '../../utils/appError';
import {
  createVideoSchema,
  updateVideoSchema,
  updateVideoStatusSchema,
  updateVideoAccessSchema,
  queryVideoSchema,
} from './zodSchemas';
import { VIDEO_ERROR_CODES } from './constants';
import { generateVideoCode, generateVideoSlug, extractYoutubeVideoId, fetchYoutubeMetadata } from './utils';

const prisma = new PrismaClient();

/**
 * TẦNG 2: Kiểm tra dữ liệu DB & Quyền sở hữu / Ràng buộc logic
 * Sắp xếp thứ tự 1-1 tương ứng với các handler function trong controller.ts
 */

/**
 * 1. Validate tham số truy vấn danh sách Video
 */
export async function validateGetVideosQuery(query: any, isClient: boolean = false) {
  const result = queryVideoSchema.safeParse(query);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new AppError(issue.message, 400, VIDEO_ERROR_CODES.VALIDATION_ERROR);
  }

  const validatedData = result.data;
  if (isClient) {
    validatedData.status = 'published';
  }

  return validatedData;
}

/**
 * 2. Validate lấy chi tiết Video cho Admin theo ID
 */
export async function validateGetVideoByIdAdmin(id: string) {
  if (!id || typeof id !== 'string') {
    throw new AppError('ID video không hợp lệ', 400, VIDEO_ERROR_CODES.VALIDATION_ERROR);
  }

  const existingVideo = await prisma.video.findUnique({
    where: { id },
    include: {
      videoType: true,
      creator: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
    },
  });

  if (!existingVideo) {
    throw new AppError('Không tìm thấy thông tin video', 404, VIDEO_ERROR_CODES.NOT_FOUND);
  }

  return existingVideo;
}

/**
 * 3. Validate lấy chi tiết Video cho Client theo ID
 */
export async function validateGetVideoByClient(id: string) {
  if (!id || typeof id !== 'string') {
    throw new AppError('ID video không hợp lệ', 400, VIDEO_ERROR_CODES.VALIDATION_ERROR);
  }

  const existingVideo = await prisma.video.findUnique({
    where: { id },
    include: {
      videoType: true,
      creator: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
    },
  });

  if (!existingVideo) {
    throw new AppError('Không tìm thấy thông tin video', 404, VIDEO_ERROR_CODES.NOT_FOUND);
  }

  return existingVideo;
}

/**
 * 4. Validate lấy chi tiết Video cho Client theo Slug
 */
export async function validateGetVideoBySlug(slug: string) {
  if (!slug || typeof slug !== 'string') {
    throw new AppError('Slug video không hợp lệ', 400, VIDEO_ERROR_CODES.VALIDATION_ERROR);
  }

  return slug;
}


/**
 * 3. Validate dữ liệu đầu vào khi tạo mới Video
 */
export async function validateCreateVideo(body: any, userId?: number) {
  // SafeParse tầng 1 Zod
  const result = createVideoSchema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new AppError(issue.message, 400, VIDEO_ERROR_CODES.VALIDATION_ERROR);
  }

  const data = result.data;

  // Kiểm tra VideoType có tồn tại trong DB không
  const videoType = await prisma.videoType.findUnique({
    where: { id: data.videoTypeId },
  });

  if (!videoType) {
    throw new AppError('Loại video được chọn không tồn tại', 404, VIDEO_ERROR_CODES.INVALID_TYPE);
  }

  // TỰ ĐỘNG SINH MÃ CODE (Không cho phép nhập thủ công)
  let finalCode = generateVideoCode();
  let codeExists = await prisma.video.findUnique({ where: { code: finalCode } });

  while (codeExists) {
    finalCode = generateVideoCode();
    codeExists = await prisma.video.findUnique({ where: { code: finalCode } });
  }

  // Chuẩn hóa Slug SEO & xử lý trùng lặp slug
  let finalSlug = data.slug ? generateVideoSlug(data.slug) : generateVideoSlug(data.title);
  if (!finalSlug) {
    finalSlug = `video-${Date.now()}`;
  }

  const slugExists = await prisma.video.findUnique({ where: { slug: finalSlug } });
  if (slugExists) {
    finalSlug = `${finalSlug}-${Math.floor(100 + Math.random() * 900)}`;
  }

  // Xử lý YouTube ID & Tự động lấy Thumbnail nếu nguồn là YouTube
  let cleanYoutubeId = data.youtubeVideoId ? extractYoutubeVideoId(data.youtubeVideoId) : null;
  let finalThumbnailUrl = data.thumbnailUrl || null;

  if (data.sourceType === 'youtube') {
    if (!cleanYoutubeId) {
      throw new AppError('Vui lòng nhập 11 ký tự YouTube Video ID', 400, VIDEO_ERROR_CODES.VALIDATION_ERROR);
    }

    // Gọi API oEmbed kiểm tra sự tồn tại của ID video và lấy Thumbnail
    const ytMeta = await fetchYoutubeMetadata(cleanYoutubeId);
    if (!ytMeta.isValid) {
      throw new AppError('ID Video YouTube không tồn tại hoặc ở chế độ riêng tư', 400, VIDEO_ERROR_CODES.VALIDATION_ERROR);
    }

    // Tự động gán Thumbnail thu thập từ YouTube
    if (ytMeta.thumbnailUrl) {
      finalThumbnailUrl = ytMeta.thumbnailUrl;
    }
  }

  return {
    ...data,
    code: finalCode,
    slug: finalSlug,
    youtubeVideoId: cleanYoutubeId,
    thumbnailUrl: finalThumbnailUrl,
    createdBy: userId || null,
  };
}

/**
 * 4. Validate dữ liệu đầu vào khi cập nhật Video
 */
export async function validateUpdateVideo(id: string, body: any) {
  if (!id || typeof id !== 'string') {
    throw new AppError('ID video không hợp lệ', 400, VIDEO_ERROR_CODES.VALIDATION_ERROR);
  }

  const existingVideo = await prisma.video.findUnique({
    where: { id },
  });

  if (!existingVideo) {
    throw new AppError('Video không tồn tại hoặc đã bị xóa', 404, VIDEO_ERROR_CODES.NOT_FOUND);
  }

  const result = updateVideoSchema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new AppError(issue.message, 400, VIDEO_ERROR_CODES.VALIDATION_ERROR);
  }

  const data = result.data;

  // Nếu cập nhật videoTypeId, kiểm tra tính tồn tại
  if (data.videoTypeId) {
    const videoType = await prisma.videoType.findUnique({
      where: { id: data.videoTypeId },
    });
    if (!videoType) {
      throw new AppError('Loại video được chọn không tồn tại', 404, VIDEO_ERROR_CODES.INVALID_TYPE);
    }
  }

  // Kiểm tra trùng Mã Code nếu có thay đổi
  if (data.code && data.code.toUpperCase() !== existingVideo.code) {
    const upperCode = data.code.toUpperCase();
    const codeExists = await prisma.video.findUnique({ where: { code: upperCode } });
    if (codeExists) {
      throw new AppError(`Mã video "${upperCode}" đã tồn tại trên hệ thống`, 400, VIDEO_ERROR_CODES.CODE_EXISTS);
    }
  }

  // Kiểm tra trùng Slug nếu có thay đổi
  let updatedSlug = existingVideo.slug;
  if (data.slug || data.title) {
    const baseSlug = data.slug ? generateVideoSlug(data.slug) : generateVideoSlug(data.title || existingVideo.title);
    if (baseSlug !== existingVideo.slug) {
      const slugExists = await prisma.video.findFirst({
        where: { slug: baseSlug, NOT: { id } },
      });
      updatedSlug = slugExists ? `${baseSlug}-${Math.floor(100 + Math.random() * 900)}` : baseSlug;
    }
  }

  // Clean YouTube Video ID nếu có
  let cleanYoutubeId = data.youtubeVideoId !== undefined ? extractYoutubeVideoId(data.youtubeVideoId) : existingVideo.youtubeVideoId;

  return {
    existingVideo,
    validatedData: {
      ...data,
      code: data.code ? data.code.toUpperCase() : undefined,
      slug: updatedSlug,
      youtubeVideoId: cleanYoutubeId,
    },
  };
}

/**
 * 5. Validate cập nhật nhanh trạng thái (status)
 */
export async function validateUpdateVideoStatus(id: string, body: any) {
  const existingVideo = await prisma.video.findUnique({ where: { id } });
  if (!existingVideo) {
    throw new AppError('Video không tồn tại', 404, VIDEO_ERROR_CODES.NOT_FOUND);
  }

  const result = updateVideoStatusSchema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new AppError(issue.message, 400, VIDEO_ERROR_CODES.VALIDATION_ERROR);
  }

  return { existingVideo, status: result.data.status };
}

/**
 * 6. Validate cập nhật nhanh quyền truy cập (isPremium)
 */
export async function validateUpdateVideoAccess(id: string, body: any) {
  const existingVideo = await prisma.video.findUnique({ where: { id } });
  if (!existingVideo) {
    throw new AppError('Video không tồn tại', 404, VIDEO_ERROR_CODES.NOT_FOUND);
  }

  const result = updateVideoAccessSchema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new AppError(issue.message, 400, VIDEO_ERROR_CODES.VALIDATION_ERROR);
  }

  const { isPremium, teaserDuration } = result.data;

  if (isPremium && typeof teaserDuration === 'number') {
    if (existingVideo.duration > 0 && teaserDuration >= existingVideo.duration) {
      throw new AppError('Thời gian xem thử phải nhỏ hơn thời lượng video', 400, VIDEO_ERROR_CODES.VALIDATION_ERROR);
    }
  }

  return { existingVideo, isPremium, teaserDuration };
}

/**
 * 7. Validate xóa 1 Video theo ID
 */
export async function validateDeleteVideo(id: string) {
  const existingVideo = await prisma.video.findUnique({ where: { id } });
  if (!existingVideo) {
    throw new AppError('Video không tồn tại hoặc đã bị xóa', 404, VIDEO_ERROR_CODES.NOT_FOUND);
  }
  return existingVideo;
}

/**
 * 8. Validate yêu cầu Dynamic HLS Playlist (theo ID hoặc Slug)
 */
export async function validateGetHlsPlaylist(identifier: string, variant?: string, isSlug: boolean = false) {
  if (!identifier || typeof identifier !== 'string') {
    throw new AppError('Mã định danh video không hợp lệ', 400, VIDEO_ERROR_CODES.VALIDATION_ERROR);
  }

  const whereClause = isSlug ? { slug: identifier } : { id: identifier };
  const existingVideo = await prisma.video.findUnique({
    where: whereClause as any,
  });

  if (!existingVideo) {
    throw new AppError('Không tìm thấy thông tin video', 404, VIDEO_ERROR_CODES.NOT_FOUND);
  }

  // Kiểm tra trạng thái transcode video
  if (existingVideo.processStatus === 'processing') {
    throw new AppError(
      'Bài giảng đang được hệ thống xử lý luồng phát HLS Multi-bitrate (Vui lòng thử lại sau 1-2 phút)',
      400,
      VIDEO_ERROR_CODES.PROCESSING
    );
  }

  if (existingVideo.processStatus !== 'ready' || !existingVideo.storagePath) {
    throw new AppError('Video chưa sẵn sàng để phát HLS', 400, VIDEO_ERROR_CODES.NOT_READY);
  }

  return { existingVideo, variant };
}

