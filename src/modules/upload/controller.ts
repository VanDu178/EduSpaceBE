import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/responseHelper';
import {
  validateUploadSingleFileData,
  validateUploadMultipleFilesData,
  validateDeleteFileData,
  validateInitBunnyStreamData,
} from './validation';
import {
  uploadSingleFileService,
  uploadMultipleFilesService,
  deleteFileService,
  initBunnyStreamSessionService,
  deleteBunnyVideoService,
  handleBunnyWebhookService,
} from './services';

/**
 * TẦNG THIN CONTROLLER: Phân luồng Request / Response
 */

/**
 * 1. Controller xử lý upload 1 file đơn lẻ
 * Route: POST /api/v1/upload/single
 */
export const uploadSingleFile = asyncHandler(async (req: Request, res: Response) => {
  const { file, folder } = await validateUploadSingleFileData(req.file, req.body);
  const result = await uploadSingleFileService(file, folder);
  return sendSuccess(res, result, 'Tải file lên hệ thống thành công!', 201);
});

/**
 * 2. Controller xử lý upload nhiều file cùng lúc
 * Route: POST /api/v1/upload/multiple
 */
export const uploadMultipleFiles = asyncHandler(async (req: Request, res: Response) => {
  const { files, folder } = await validateUploadMultipleFilesData(
    req.files as Express.Multer.File[],
    req.body
  );
  const results = await uploadMultipleFilesService(files, folder);
  return sendSuccess(res, results, `Đã tải lên thành công ${results.length} file!`, 201);
});

/**
 * 3. Controller xử lý xóa file khỏi Supabase Storage
 * Route: DELETE /api/v1/upload
 */
export const deleteFile = asyncHandler(async (req: Request, res: Response) => {
  const { filePath } = await validateDeleteFileData(req.body, req.query);
  const result = await deleteFileService(filePath);
  return sendSuccess(res, result, 'Xóa tệp khỏi hệ thống thành công!');
});

/**
 * 4. Controller khởi tạo phiên upload Bunny Stream
 * Route: POST /api/v1/upload/bunny/create-session
 */
export const initBunnyStreamSession = asyncHandler(async (req: Request, res: Response) => {
  const { title } = await validateInitBunnyStreamData(req.body);
  const userId = (req as any).user?.id ? Number((req as any).user.id) : undefined;
  const result = await initBunnyStreamSessionService(title, userId);
  return sendSuccess(res, result, 'Khởi tạo phiên upload Bunny Stream thành công!', 201);
});

/**
 * 5. Controller dọn dẹp/xóa tệp video trên Bunny Stream
 * Route: DELETE /api/v1/upload/bunny/:videoId
 */
export const deleteBunnyVideo = asyncHandler(async (req: Request, res: Response) => {
  const videoId = String(req.params.videoId);
  const result = await deleteBunnyVideoService(videoId);
  return sendSuccess(res, result, 'Xóa tệp video trên Bunny Stream thành công!');
});

/**
 * 6. Controller xử lý Webhook thông báo từ Bunny Stream CDN
 * Route: POST /api/v1/upload/bunny/webhook
 */
export const handleBunnyWebhook = asyncHandler(async (req: Request, res: Response) => {
  const result = await handleBunnyWebhookService(req.body);
  return sendSuccess(res, result, 'Xử lý Webhook Bunny Stream thành công!');
});

