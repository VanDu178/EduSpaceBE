/**
 * HẰNG SỐ VÀ CẤU HÌNH CHO MODULE UPLOAD FILE (SUPABASE STORAGE)
 */

export const UPLOAD_CONFIG = {
  DEFAULT_FOLDER: 'blogs',
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024, // 50MB (hỗ trợ cả video và ảnh dung lượng lớn)
  MAX_FILES_COUNT: 10, // Tối đa 10 file 1 lần upload
  SINGLE_FILE_FIELD_KEY: 'file',
  MULTIPLE_FILES_FIELD_KEY: 'files',
} as const;

export const UPLOAD_ERROR_CODES = {
  FILE_REQUIRED: 'FILE_REQUIRED',
  INVALID_PATH: 'INVALID_PATH',
  DELETE_FAILED: 'DELETE_FAILED',
} as const;
