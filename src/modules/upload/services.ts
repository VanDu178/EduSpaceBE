import { AppError } from '../../utils/appError';
import { uploadToSupabase, deleteFromSupabase } from '../../services/supabaseStorageService';
import { UPLOAD_ERROR_CODES } from './constants';

/**
 * TẦNG 3: Xử lý nghiệp vụ & Giao tiếp Supabase Storage
 * Sắp xếp thứ tự 1-1 tương ứng với các handler function trong controller.ts
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
