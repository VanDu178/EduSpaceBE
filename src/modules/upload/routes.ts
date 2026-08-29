import express from 'express';
import multer from 'multer';
import { uploadSingleFile, uploadMultipleFiles } from './controller';

const uploadRoutes = express.Router();

// Cấu hình Multer lưu file tạm trong Memory (Buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // Tối đa 50MB mỗi file (hỗ trợ cả video)
  }
});

// Route upload 1 file (field key là 'file')
uploadRoutes.post('/single', upload.single('file'), uploadSingleFile);

// Route upload nhiều file (field key là 'files', tối đa 10 file 1 lần)
uploadRoutes.post('/multiple', upload.array('files', 10), uploadMultipleFiles);

export default uploadRoutes;
