import express from 'express';
import multer from 'multer';
import { UPLOAD_CONFIG } from './constants';
import { uploadSingleFile, uploadMultipleFiles, deleteFile } from './controller';

/**
 * TẦNG ĐỊNH TUYẾN ENDPOINT HTTP & MIDDLEWARE
 */
const uploadRoutes = express.Router();

// Cấu hình Multer lưu file tạm trong Memory (Buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: UPLOAD_CONFIG.MAX_FILE_SIZE_BYTES,
  },
});

// Route upload 1 file (field key mặc định là 'file')
uploadRoutes.post(
  '/single',
  upload.single(UPLOAD_CONFIG.SINGLE_FILE_FIELD_KEY),
  uploadSingleFile
);

// Route upload nhiều file (field key mặc định là 'files', tối đa MAX_FILES_COUNT file 1 lần)
uploadRoutes.post(
  '/multiple',
  upload.array(UPLOAD_CONFIG.MULTIPLE_FILES_FIELD_KEY, UPLOAD_CONFIG.MAX_FILES_COUNT),
  uploadMultipleFiles
);

// Route xóa file
uploadRoutes.delete('/', deleteFile);

export default uploadRoutes;
