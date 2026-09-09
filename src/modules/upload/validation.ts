import { AppError } from '../../utils/appError';
import { extractStoragePath } from '../../services/supabaseStorageService';
import { UPLOAD_ERROR_CODES, UPLOAD_CONFIG } from './constants';
import {
  uploadSingleBodySchema,
  uploadMultipleBodySchema,
  deleteFileQueryOrBodySchema,
  initR2MultipartSchema,
  getR2PresignedUrlsSchema,
  completeR2MultipartSchema,
  singleR2PresignedSchema,
} from './zodSchemas';


/**
 * TẦNG 2: Kiểm tra tính hợp lệ dữ liệu và file upload
 * Sắp xếp thứ tự 1-1 tương ứng với các handler function trong controller.ts
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
 * 4. Validate cho R2 Init Multipart Upload
 */
export async function validateInitR2MultipartData(body: unknown) {
  const parseResult = initR2MultipartSchema.safeParse(body);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0] as any;
    const message = firstIssue?.message || 'Thông tin khởi tạo upload R2 không hợp lệ';
    const errorCode = firstIssue?.params?.errorCode || 'VALIDATION_ERROR';
    const statusCode = firstIssue?.params?.statusCode || 400;
    throw new AppError(message, statusCode, errorCode);
  }

  const { fileName, fileType, fileSize, folderType } = parseResult.data;

  // Kiểm tra kích thước giới hạn
  if (folderType === 'videos' && fileSize > UPLOAD_CONFIG.MAX_FILE_SIZE_BYTES) {
    throw new AppError(
      'Dung lượng tệp video vượt quá giới hạn 1GB cho phép!',
      400,
      UPLOAD_ERROR_CODES.R2_FILE_TOO_LARGE
    );
  }

  if (folderType === 'thumbnails' && fileSize > UPLOAD_CONFIG.MAX_THUMBNAIL_SIZE_BYTES) {
    throw new AppError(
      'Dung lượng tệp thumbnail vượt quá giới hạn 10MB cho phép!',
      400,
      UPLOAD_ERROR_CODES.R2_FILE_TOO_LARGE
    );
  }

  const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const key = `${folderType}/${timestamp}_${randomSuffix}_${cleanFileName}`;

  return {
    fileName,
    fileType,
    fileSize,
    folderType,
    key,
  };
}

/**
 * 5. Validate cho R2 Get Presigned URLs
 */
export async function validateGetR2PresignedUrlsData(body: unknown) {
  const parseResult = getR2PresignedUrlsSchema.safeParse(body);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0] as any;
    const message = firstIssue?.message || 'Thông tin lấy presigned URLs R2 không hợp lệ';
    const errorCode = firstIssue?.params?.errorCode || 'VALIDATION_ERROR';
    const statusCode = firstIssue?.params?.statusCode || 400;
    throw new AppError(message, statusCode, errorCode);
  }

  return parseResult.data;
}

/**
 * 6. Validate cho R2 Complete Multipart Upload
 */
export async function validateCompleteR2MultipartData(body: unknown) {
  const parseResult = completeR2MultipartSchema.safeParse(body);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0] as any;
    const message = firstIssue?.message || 'Thông tin hoàn tất multipart R2 không hợp lệ';
    const errorCode = firstIssue?.params?.errorCode || 'VALIDATION_ERROR';
    const statusCode = firstIssue?.params?.statusCode || 400;
    throw new AppError(message, statusCode, errorCode);
  }

  return parseResult.data;
}

/**
 * 7. Validate cho R2 Single Presigned URL (Thumbnail)
 */
export async function validateSingleR2PresignedData(body: unknown) {
  const parseResult = singleR2PresignedSchema.safeParse(body);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0] as any;
    const message = firstIssue?.message || 'Thông tin lấy single presigned URL không hợp lệ';
    const errorCode = firstIssue?.params?.errorCode || 'VALIDATION_ERROR';
    const statusCode = firstIssue?.params?.statusCode || 400;
    throw new AppError(message, statusCode, errorCode);
  }

  const { fileName, fileType, folderType } = parseResult.data;
  const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const key = `${folderType}/${timestamp}_${randomSuffix}_${cleanFileName}`;

  return {
    fileName,
    fileType,
    folderType,
    key,
  };
}

