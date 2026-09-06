import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/responseHelper';
import {
  validateGetVideosQuery,
  validateGetVideoById,
  validateCreateVideo,
  validateUpdateVideo,
  validateUpdateVideoStatus,
  validateUpdateVideoAccess,
  validateDeleteVideo,
} from './validation';
import {
  getVideosListService,
  getVideoByIdService,
  createVideoService,
  updateVideoService,
  updateVideoStatusService,
  updateVideoAccessService,
  deleteVideoService,
  getVideoTypesService,
} from './services';

/**
 * TẦNG Thin Controller (Videos)
 * Phân luồng Request / Response. Tuân thủ đúng 4 bước và thứ tự 1-1 với Validation và Services.
 */

/**
 * 1. Lấy danh sách Video (Có phân trang, lọc theo loại, nguồn, trạng thái, premium)
 */
export const getVideosList = asyncHandler(async (req: Request, res: Response) => {
  const validatedQuery = await validateGetVideosQuery(req.query);
  const result = await getVideosListService(validatedQuery);
  return sendSuccess(res, result, 'Lấy danh sách video thành công');
});

/**
 * 2. Lấy chi tiết 1 Video theo ID
 */
export const getVideoById = asyncHandler(async (req: Request, res: Response) => {
  const existingVideo = await validateGetVideoById(req.params.id as string);
  const result = await getVideoByIdService(existingVideo);
  return sendSuccess(res, { video: result }, 'Lấy thông tin chi tiết video thành công');
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
