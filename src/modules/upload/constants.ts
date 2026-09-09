/**
 * HẰNG SỐ VÀ CẤU HÌNH CHO MODULE UPLOAD FILE (SUPABASE STORAGE & BUNNY STREAM)
 */

export const UPLOAD_CONFIG = {
  DEFAULT_FOLDER: 'blogs',
  MAX_FILE_SIZE_BYTES: 1024 * 1024 * 1024, // 1GB (hỗ trợ video bài giảng độ dài 1-2 tiếng)
  MAX_THUMBNAIL_SIZE_BYTES: 10 * 1024 * 1024, // 10MB cho Thumbnail
  MAX_FILES_COUNT: 10, // Tối đa 10 file 1 lần upload
  SINGLE_FILE_FIELD_KEY: 'file',
  MULTIPLE_FILES_FIELD_KEY: 'files',
} as const;

export const UPLOAD_ERROR_CODES = {
  FILE_REQUIRED: 'FILE_REQUIRED',
  INVALID_PATH: 'INVALID_PATH',
  DELETE_FAILED: 'DELETE_FAILED',
} as const;


