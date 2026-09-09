import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/responseHelper';
import {
  validateUploadSingleFileData,
  validateUploadMultipleFilesData,
  validateDeleteFileData,
  validateInitR2MultipartData,
  validateGetR2PresignedUrlsData,
  validateCompleteR2MultipartData,
  validateSingleR2PresignedData,
} from './validation';
import {
  uploadSingleFileService,
  uploadMultipleFilesService,
  deleteFileService,
  initR2MultipartService,
  getR2PresignedUrlsService,
  completeR2MultipartService,
  singleR2PresignedService,
} from './services';

/**
 * TẦNG THIN CONTROLLER: Phân luồng Request / Response
 */

/**
 * 1. Controller xử lý upload 1 file đơn lẻ
 * Route: POST /api/v1/upload/single
 */
export const uploadSingleFile = asyncHandler(async (req: Request, res: Response) => {
  // Step 1 & 2: Validate dữ liệu đầu vào
  const { file, folder } = await validateUploadSingleFileData(req.file, req.body);

  // Step 3: Gọi Service xử lý nghiệp vụ
  const result = await uploadSingleFileService(file, folder);

  // Step 4: Trả phản hồi về cho client
  return sendSuccess(res, result, 'Tải file lên hệ thống thành công!', 201);
});

/**
 * 2. Controller xử lý upload nhiều file cùng lúc
 * Route: POST /api/v1/upload/multiple
 */
export const uploadMultipleFiles = asyncHandler(async (req: Request, res: Response) => {
  // Step 1 & 2: Validate dữ liệu đầu vào
  const { files, folder } = await validateUploadMultipleFilesData(
    req.files as Express.Multer.File[],
    req.body
  );

  // Step 3: Gọi Service xử lý nghiệp vụ
  const results = await uploadMultipleFilesService(files, folder);

  // Step 4: Trả phản hồi về cho client
  return sendSuccess(res, results, `Đã tải lên thành công ${results.length} file!`, 201);
});

/**
 * 3. Controller xử lý xóa file khỏi Supabase Storage
 * Route: DELETE /api/v1/upload
 */
export const deleteFile = asyncHandler(async (req: Request, res: Response) => {
  // Step 1 & 2: Validate dữ liệu đầu vào
  const { filePath } = await validateDeleteFileData(req.body, req.query);

  // Step 3: Gọi Service xử lý nghiệp vụ
  const result = await deleteFileService(filePath);

  // Step 4: Trả phản hồi về cho client
  return sendSuccess(res, result, 'Xóa tệp khỏi hệ thống thành công!');
});

/**
 * 4. Controller khởi tạo Cloudflare R2 Multipart Upload
 * Route: POST /api/v1/upload/r2/init-multipart
 */
export const initR2Multipart = asyncHandler(async (req: Request, res: Response) => {
  const { key, fileType } = await validateInitR2MultipartData(req.body);
  const result = await initR2MultipartService(key, fileType);
  return sendSuccess(res, result, 'Khởi tạo Multipart Upload R2 thành công!', 201);
});

/**
 * 5. Controller sinh danh sách Presigned URLs cho các Part trên R2
 * Route: POST /api/v1/upload/r2/presigned-urls
 */
export const getR2PresignedUrls = asyncHandler(async (req: Request, res: Response) => {
  const { key, uploadId, partsCount } = await validateGetR2PresignedUrlsData(req.body);
  const result = await getR2PresignedUrlsService(key, uploadId, partsCount);
  return sendSuccess(res, result, 'Lấy danh sách Presigned URLs R2 thành công!');
});

/**
 * 6. Controller hoàn tất ghép các Part (Complete Multipart Upload) trên R2
 * Route: POST /api/v1/upload/r2/complete-multipart
 */
export const completeR2Multipart = asyncHandler(async (req: Request, res: Response) => {
  const { key, uploadId, parts } = await validateCompleteR2MultipartData(req.body);
  const result = await completeR2MultipartService(key, uploadId, parts);
  return sendSuccess(res, result, 'Hoàn tất Multipart Upload trên R2 thành công!');
});

/**
 * 7. Controller sinh Presigned PUT URL đơn lẻ cho Thumbnail trên R2
 * Route: POST /api/v1/upload/r2/single-presigned
 */
export const singleR2Presigned = asyncHandler(async (req: Request, res: Response) => {
  const { key, fileType } = await validateSingleR2PresignedData(req.body);
  const result = await singleR2PresignedService(key, fileType);
  return sendSuccess(res, result, 'Sinh Single Presigned URL R2 thành công!', 201);
});

