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

/**
 * 4. Service khởi tạo Multipart Upload trên Cloudflare R2
 */
export async function initR2MultipartService(key: string, fileType: string) {
  const { initR2MultipartUpload } = await import('../../services/r2StorageService');
  const result = await initR2MultipartUpload(key, fileType);
  return result;
}

/**
 * 5. Service tạo danh sách Presigned URLs cho từng part tệp
 */
export async function getR2PresignedUrlsService(
  key: string,
  uploadId: string,
  partsCount: number
) {
  const { generateR2UploadPartPresignedUrls } = await import('../../services/r2StorageService');
  const presignedUrls = await generateR2UploadPartPresignedUrls(key, uploadId, partsCount);
  return {
    key,
    uploadId,
    partsCount,
    presignedUrls,
  };
}

/**
 * 6. Service hoàn tất ghép các Part trên Cloudflare R2
 */
export async function completeR2MultipartService(
  key: string,
  uploadId: string,
  parts: Array<{ PartNumber: number; ETag: string }>
) {
  const { completeR2MultipartUpload } = await import('../../services/r2StorageService');
  const result = await completeR2MultipartUpload(key, uploadId, parts);
  return result;
}

/**
 * 7. Service sinh Single Presigned PUT URL cho Thumbnail (hoặc file nhỏ)
 */
export async function singleR2PresignedService(key: string, fileType: string) {
  const { generateR2SinglePresignedUrl } = await import('../../services/r2StorageService');
  const result = await generateR2SinglePresignedUrl(key, fileType);
  return result;
}

