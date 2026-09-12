import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/responseHelper';
import {
  validateGetVideosQuery,
  validateGetVideoByIdAdmin,
  validateGetVideoByClient,
  validateGetVideoBySlug,
  validateCreateVideo,
  validateUpdateVideo,
  validateUpdateVideoStatus,
  validateUpdateVideoAccess,
  validateDeleteVideo,
  validateGetHlsPlaylist,
} from './validation';
import {
  getVideosListService,
  getAdminVideosListService,
  getVideoByIdAdminService,
  getVideoByClientService,
  getVideoBySlugService,
  createVideoService,
  updateVideoService,
  updateVideoStatusService,
  updateVideoAccessService,
  deleteVideoService,
  getVideoTypesService,
  getDynamicHlsPlaylistService,
  syncVideoProcessStatusService,
} from './services';


/**
 * TẦNG Thin Controller (Videos)
 * Phân luồng Request / Response. Tuân thủ đúng 4 bước và thứ tự 1-1 với Validation và Services.
 */

/**
 * 1. Lấy danh sách Video dành cho Client (Chỉ trạng thái published, loại bỏ storagePath/youtubeVideoId/processStatus)
 */
export const getVideosList = asyncHandler(async (req: Request, res: Response) => {
  const validatedQuery = await validateGetVideosQuery(req.query, true);
  const result = await getVideosListService(validatedQuery);
  return sendSuccess(res, result, 'Lấy danh sách video thành công');
});

/**
 * 1b. Lấy danh sách Video dành cho Admin (Đầy đủ thuộc tính quản trị)
 */
export const getAdminVideosList = asyncHandler(async (req: Request, res: Response) => {
  const validatedQuery = await validateGetVideosQuery(req.query, false);
  const result = await getAdminVideosListService(validatedQuery);
  return sendSuccess(res, result, 'Lấy danh sách video cho Admin thành công');
});

/**
 * 2. Lấy chi tiết Video cho Admin theo ID (Bắt buộc đăng nhập Admin)
 */
export const getVideoByIdAdmin = asyncHandler(async (req: Request, res: Response) => {
  const existingVideo = await validateGetVideoByIdAdmin(req.params.id as string);
  const result = await getVideoByIdAdminService(existingVideo);
  return sendSuccess(res, { video: result }, 'Lấy thông tin chi tiết video thành công');
});

/**
 * 3. Lấy chi tiết Video cho Client theo ID (Dynamic Auth Check & Policy Engine)
 */
export const getVideoByClient = asyncHandler(async (req: Request, res: Response) => {
  const existingVideo = await validateGetVideoByClient(req.params.id as string);
  const result = await getVideoByClientService(existingVideo, (req as any).user);
  return sendSuccess(res, { video: result }, 'Lấy thông tin chi tiết video thành công');
});

/**
 * 4. Lấy chi tiết Video cho Client theo Slug (Dynamic Auth Check & Policy Engine)
 */
export const getVideoBySlug = asyncHandler(async (req: Request, res: Response) => {
  const slug = await validateGetVideoBySlug(req.params.slug as string);
  const result = await getVideoBySlugService(slug, (req as any).user);
  return sendSuccess(res, { video: result }, 'Lấy thông tin chi tiết video theo Slug thành công');
});

/**
 * 3. Tạo mới Video
 */
export const createVideo = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const validatedData = await validateCreateVideo(req.body, userId);
  const newVideo = await createVideoService(validatedData);
  return sendSuccess(res, { video: newVideo }, 'Tạo mới video thành công', 201);
});

/**
 * 4. Cập nhật thông tin Video
 */
export const updateVideo = asyncHandler(async (req: Request, res: Response) => {
  const { existingVideo, validatedData } = await validateUpdateVideo(req.params.id as string, req.body);
  const updatedVideo = await updateVideoService(existingVideo, validatedData);
  return sendSuccess(res, { video: updatedVideo }, 'Cập nhật thông tin video thành công');
});

/**
 * 5. Cập nhật nhanh trạng thái Video (draft / published / archived)
 */
export const updateVideoStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = await validateUpdateVideoStatus(req.params.id as string, req.body);
  const updatedVideo = await updateVideoStatusService(req.params.id as string, status);
  return sendSuccess(res, { video: updatedVideo }, 'Cập nhật trạng thái video thành công');
});

/**
 * 6. Cập nhật nhanh quyền truy cập Premium (isPremium)
 */
export const updateVideoAccess = asyncHandler(async (req: Request, res: Response) => {
  const { isPremium, teaserDuration } = await validateUpdateVideoAccess(req.params.id as string, req.body);
  const updatedVideo = await updateVideoAccessService(req.params.id as string, isPremium, teaserDuration);
  return sendSuccess(res, { video: updatedVideo }, 'Cập nhật quyền truy cập video thành công');
});

/**
 * 7. Xóa Video
 */
export const deleteVideo = asyncHandler(async (req: Request, res: Response) => {
  const existingVideo = await validateDeleteVideo(req.params.id as string);
  const result = await deleteVideoService(existingVideo);
  return sendSuccess(res, result, 'Xóa video thành công');
});

/**
 * 8. Lấy danh sách Loại Video cố định (Học thuật & Nhận định thị trường)
 */
export const getVideoTypes = asyncHandler(async (_req: Request, res: Response) => {
  const videoTypes = await getVideoTypesService();
  return sendSuccess(res, { videoTypes }, 'Lấy danh sách loại video thành công');
});

/**
 * 9. Lấy Dynamic HLS Playlist theo ID Video
 */
export const getDynamicHlsPlaylist = asyncHandler(async (req: Request, res: Response) => {
  const { existingVideo, variant } = await validateGetHlsPlaylist(
    req.params.id as string,
    req.params.variant as string,
    false,
    (req as any).user
  );
  const result = await getDynamicHlsPlaylistService(existingVideo, variant, (req as any).user);

  if (result.playlistUrl && (result.playlistUrl.startsWith('http://') || result.playlistUrl.startsWith('https://'))) {
    return res.redirect(302, result.playlistUrl);
  }

  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.send(result.content);
});

/**
 * 10. Lấy Dynamic HLS Playlist theo Slug Video
 */
export const getDynamicHlsPlaylistBySlug = asyncHandler(async (req: Request, res: Response) => {
  const { existingVideo, variant } = await validateGetHlsPlaylist(
    req.params.slug as string,
    req.params.variant as string,
    true,
    (req as any).user
  );
  const result = await getDynamicHlsPlaylistService(existingVideo, variant, (req as any).user);

  if (result.playlistUrl && (result.playlistUrl.startsWith('http://') || result.playlistUrl.startsWith('https://'))) {
    return res.redirect(302, result.playlistUrl);
  }

  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.send(result.content);
});

/**
 * 11. Đồng bộ thủ công trạng thái xử lý HLS (processStatus) của Video từ Bunny Stream
 */
export const syncVideoProcessStatus = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const updatedVideo = await syncVideoProcessStatusService(id);
  return sendSuccess(res, { video: updatedVideo }, 'Đồng bộ trạng thái xử lý video với Bunny Stream thành công');
});


