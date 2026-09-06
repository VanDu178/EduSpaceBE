import express from 'express';
import {
  getVideosList,
  getVideoById,
  createVideo,
  updateVideo,
  updateVideoStatus,
  updateVideoAccess,
  deleteVideo,
  getVideoTypes,
} from './controller';
import { authMiddleware } from '../../middlewares/authMiddleware';

const router = express.Router();

// Lấy danh sách 2 Loại Video cố định hệ thống (Public)
router.get('/types', getVideoTypes as express.RequestHandler);

// Lấy danh sách tất cả các Video (Public/Admin filter)
router.get('/', getVideosList as express.RequestHandler);

// Lấy chi tiết 1 Video theo ID
router.get('/:id', getVideoById as express.RequestHandler);

// Tạo mới Video (Cần đăng nhập)
router.post('/', authMiddleware as express.RequestHandler, createVideo as express.RequestHandler);

// Cập nhật thông tin Video (Cần đăng nhập)
router.put('/:id', authMiddleware as express.RequestHandler, updateVideo as express.RequestHandler);

// Cập nhật nhanh trạng thái Video (draft / published / archived) (Cần đăng nhập)
router.patch('/:id/status', authMiddleware as express.RequestHandler, updateVideoStatus as express.RequestHandler);

// Cập nhật nhanh quyền truy cập Premium (isPremium) (Cần đăng nhập)
router.patch('/:id/access', authMiddleware as express.RequestHandler, updateVideoAccess as express.RequestHandler);

// Xóa Video (Cần đăng nhập)
router.delete('/:id', authMiddleware as express.RequestHandler, deleteVideo as express.RequestHandler);

export default router;
