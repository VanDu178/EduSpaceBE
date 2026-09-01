import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/responseHelper';
import {
  validateUploadSingleFileData,
  validateUploadMultipleFilesData,
  validateDeleteFileData,
} from './validation';
import {
  uploadSingleFileService,
  uploadMultipleFilesService,
  deleteFileService,
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
