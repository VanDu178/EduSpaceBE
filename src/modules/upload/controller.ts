import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/responseHelper';
import { AppError } from '../../utils/appError';
import { uploadToSupabase } from '../../utils/supabaseStorage';

/**
 * Controller xử lý upload 1 file đơn lẻ
 * Route: POST /api/upload/single
 */
export const uploadSingleFile = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    throw new AppError('Vui lòng chọn file cần tải lên!', 400);
  }

  // Lấy thuộc tính folder từ body nếu có (mặc định 'blogs')
  const folder = (req.body.folder as string) || 'blogs';

  const result = await uploadToSupabase(
    file.buffer,
    file.originalname,
    file.mimetype,
    { folder }
  );

  return sendSuccess(res, result, 'Tải file lên hệ thống thành công!', 201);
});

/**
 * Controller xử lý upload nhiều file cùng lúc
 * Route: POST /api/upload/multiple
 */
export const uploadMultipleFiles = asyncHandler(async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    throw new AppError('Vui lòng chọn ít nhất 1 file để tải lên!', 400);
  }

  const folder = (req.body.folder as string) || 'blogs';

  const uploadPromises = files.map(file =>
    uploadToSupabase(file.buffer, file.originalname, file.mimetype, { folder })
  );

  const results = await Promise.all(uploadPromises);

  return sendSuccess(res, results, `Đã tải lên thành công ${results.length} file!`, 201);
});

/**
 * Controller xử lý xóa file khỏi Supabase Storage
 * Route: DELETE /api/v1/upload
 */
export const deleteFile = asyncHandler(async (req: Request, res: Response) => {
  const urlOrPath = req.body?.url || req.body?.path || (req.query?.url as string);

  if (!urlOrPath) {
    throw new AppError('Vui lòng cung cấp đường dẫn tệp cần xóa!', 400);
  }

  const { extractStoragePath, deleteFromSupabase } = await import('../../utils/supabaseStorage');
  const filePath = extractStoragePath(urlOrPath);

  if (!filePath) {
    throw new AppError('Đường dẫn tệp không hợp lệ!', 400);
  }

  const success = await deleteFromSupabase(filePath);
  if (!success) {
    throw new AppError('Xóa tệp thất bại!', 500);
  }

  return sendSuccess(res, { path: filePath }, 'Xóa tệp khỏi hệ thống thành công!');
});

