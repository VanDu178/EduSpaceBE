import { z } from 'zod';
import { UPLOAD_CONFIG } from './constants';

/**
 * Helper định nghĩa thông điệp lỗi kèm Mã lỗi đặc thù (errorCode) và Status Code
 */
export const err = (
  message: string,
  errorCode: string = 'VALIDATION_ERROR',
  statusCode: number = 400
) => ({
  message,
  params: { errorCode, statusCode },
});

/**
 * TẦNG 1: Zod Schemas kiểm tra cú pháp & tham số truyền vào
 */

export const uploadSingleBodySchema = z.object({
  folder: z.string().optional().default(UPLOAD_CONFIG.DEFAULT_FOLDER),
});

export const uploadMultipleBodySchema = z.object({
  folder: z.string().optional().default(UPLOAD_CONFIG.DEFAULT_FOLDER),
});

export const deleteFileQueryOrBodySchema = z.object({
  url: z.string().optional().nullable(),
  path: z.string().optional().nullable(),
});

export type UploadSingleBodyInput = z.infer<typeof uploadSingleBodySchema>;
export type UploadMultipleBodyInput = z.infer<typeof uploadMultipleBodySchema>;
export type DeleteFileQueryOrBodyInput = z.infer<typeof deleteFileQueryOrBodySchema>;

/**
 * Zod Schemas cho Cloudflare R2 Upload
 */
export const initR2MultipartSchema = z.object({
  fileName: z.string().min(1, 'Tên file không được để trống'),
  fileType: z.string().min(1, 'Loại tệp không được để trống'),
  fileSize: z.number().positive('Dung lượng file phải lớn hơn 0'),
  folderType: z.enum(['videos', 'thumbnails'], err('Thư mục lưu trữ R2 chỉ chấp nhận "videos" hoặc "thumbnails"', 'R2_INVALID_FOLDER', 400)),
});

export const getR2PresignedUrlsSchema = z.object({
  uploadId: z.string().min(1, 'Upload ID không được để trống'),
  key: z.string().min(1, 'Key tệp R2 không được để trống'),
  partsCount: z.number().int().positive('Số lượng chunk phải lớn hơn 0'),
});

export const completeR2MultipartSchema = z.object({
  uploadId: z.string().min(1, 'Upload ID không được để trống'),
  key: z.string().min(1, 'Key tệp R2 không được để trống'),
  parts: z.array(
    z.object({
      PartNumber: z.number().int().positive(),
      ETag: z.string().min(1),
    })
  ).min(1, 'Danh sách part ETag không được để trống'),
});

export const singleR2PresignedSchema = z.object({
  fileName: z.string().min(1, 'Tên file không được để trống'),
  fileType: z.string().min(1, 'Loại tệp không được để trống'),
  folderType: z.enum(['videos', 'thumbnails'], err('Thư mục lưu trữ R2 chỉ chấp nhận "videos" hoặc "thumbnails"', 'R2_INVALID_FOLDER', 400)).optional().default('thumbnails'),
});

export type InitR2MultipartInput = z.infer<typeof initR2MultipartSchema>;
export type GetR2PresignedUrlsInput = z.infer<typeof getR2PresignedUrlsSchema>;
export type CompleteR2MultipartInput = z.infer<typeof completeR2MultipartSchema>;
export type SingleR2PresignedInput = z.infer<typeof singleR2PresignedSchema>;


