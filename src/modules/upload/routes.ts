import express from 'express';
import multer from 'multer';
import { UPLOAD_CONFIG } from './constants';
import {
  uploadSingleFile,
  uploadMultipleFiles,
  deleteFile,
  initR2Multipart,
  getR2PresignedUrls,
  completeR2Multipart,
  singleR2Presigned,
} from './controller';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { adminMiddleware } from '../../middlewares/adminMiddleware';

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

/**
 * Các Route Upload dành riêng cho Cloudflare R2 Direct Upload (Admin Only)
 */
uploadRoutes.post('/r2/init-multipart', authMiddleware as express.RequestHandler, adminMiddleware as express.RequestHandler, initR2Multipart as express.RequestHandler);
uploadRoutes.post('/r2/presigned-urls', authMiddleware as express.RequestHandler, adminMiddleware as express.RequestHandler, getR2PresignedUrls as express.RequestHandler);
uploadRoutes.post('/r2/complete-multipart', authMiddleware as express.RequestHandler, adminMiddleware as express.RequestHandler, completeR2Multipart as express.RequestHandler);
uploadRoutes.post('/r2/single-presigned', authMiddleware as express.RequestHandler, adminMiddleware as express.RequestHandler, singleR2Presigned as express.RequestHandler);

export default uploadRoutes;

