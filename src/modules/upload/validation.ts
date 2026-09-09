import { AppError } from '../../utils/appError';
import { extractStoragePath } from '../../services/supabaseStorageService';
import { UPLOAD_ERROR_CODES } from './constants';
import {
  uploadSingleBodySchema,
  uploadMultipleBodySchema,
  deleteFileQueryOrBodySchema,
  initBunnyStreamSchema,
} from './zodSchemas';

/**
 * TẦNG 2: Kiểm tra tính hợp lệ dữ liệu và file upload
 */

/**
 * 1. Validate cho uploadSingleFile
 */
export async function validateUploadSingleFileData(
  file: Express.Multer.File | undefined,
  body: unknown
) {
  if (!file) {
    throw new AppError(
      'Vui lòng chọn file cần tải lên!',
      400,
      UPLOAD_ERROR_CODES.FILE_REQUIRED
    );
  }

  const parseResult = uploadSingleBodySchema.safeParse(body || {});
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0] as any;
    const message = firstIssue?.message || 'Thông tin tải file không hợp lệ';
    const errorCode = firstIssue?.params?.errorCode || 'VALIDATION_ERROR';
    const statusCode = firstIssue?.params?.statusCode || 400;
    throw new AppError(message, statusCode, errorCode);
  }

  return {
    file,
    folder: parseResult.data.folder,
  };
}

/**
 * 2. Validate cho uploadMultipleFiles
 */
export async function validateUploadMultipleFilesData(
  files: Express.Multer.File[] | undefined,
  body: unknown
) {
  if (!files || files.length === 0) {
    throw new AppError(
      'Vui lòng chọn ít nhất 1 file để tải lên!',
      400,
      UPLOAD_ERROR_CODES.FILE_REQUIRED
    );
  }

  const parseResult = uploadMultipleBodySchema.safeParse(body || {});
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0] as any;
    const message = firstIssue?.message || 'Thông tin tải nhiều file không hợp lệ';
    const errorCode = firstIssue?.params?.errorCode || 'VALIDATION_ERROR';
    const statusCode = firstIssue?.params?.statusCode || 400;
    throw new AppError(message, statusCode, errorCode);
  }

  return {
    files,
    folder: parseResult.data.folder,
  };
}

/**
 * 3. Validate cho deleteFile
 */
export async function validateDeleteFileData(body: any, query: any) {
  const parseResult = deleteFileQueryOrBodySchema.safeParse({
    url: body?.url || query?.url,
    path: body?.path,
  });

  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0] as any;
    const message = firstIssue?.message || 'Đường dẫn tệp không hợp lệ';
    const errorCode = firstIssue?.params?.errorCode || 'VALIDATION_ERROR';
    const statusCode = firstIssue?.params?.statusCode || 400;
    throw new AppError(message, statusCode, errorCode);
  }

  const urlOrPath =
    body?.url || body?.path || (query?.url as string) || null;

  if (!urlOrPath) {
    throw new AppError(
      'Vui lòng cung cấp đường dẫn tệp cần xóa!',
      400,
      UPLOAD_ERROR_CODES.FILE_REQUIRED
    );
  }

  const filePath = extractStoragePath(urlOrPath);
  if (!filePath) {
    throw new AppError(
      'Đường dẫn tệp không hợp lệ!',
      400,
      UPLOAD_ERROR_CODES.INVALID_PATH
    );
  }

  return { filePath };
}

/**
 * 4. Validate dữ liệu khởi tạo phiên upload Bunny Stream
 */
export async function validateInitBunnyStreamData(body: unknown) {
  const parseResult = initBunnyStreamSchema.safeParse(body);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0] as any;
    const message = firstIssue?.message || 'Thông tin khởi tạo upload Bunny Stream không hợp lệ';
    const errorCode = firstIssue?.params?.errorCode || 'VALIDATION_ERROR';
    const statusCode = firstIssue?.params?.statusCode || 400;
    throw new AppError(message, statusCode, errorCode);
  }

  return parseResult.data;
}
