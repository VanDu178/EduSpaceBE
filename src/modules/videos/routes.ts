import express from 'express';
import {
  getVideosList,
  getAdminVideosList,
  getVideoByIdAdmin,
  getVideoByClient,
  getVideoBySlug,
  createVideo,
  updateVideo,
  updateVideoStatus,
  updateVideoAccess,
  deleteVideo,
  getVideoTypes,
} from './controller';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { optionalAuthMiddleware } from '../../middlewares/optionalAuthMiddleware';
import { adminMiddleware } from '../../middlewares/adminMiddleware';

const router = express.Router();

// Lấy danh sách 2 Loại Video cố định hệ thống (Public)
router.get('/types', getVideoTypes as express.RequestHandler);

// Lấy danh sách tất cả các Video cho Admin (Protected Admin)
router.get('/admin', authMiddleware as express.RequestHandler, adminMiddleware as express.RequestHandler, getAdminVideosList as express.RequestHandler);

// Lấy danh sách tất cả các Video cho Client (Public Client)
router.get('/', getVideosList as express.RequestHandler);

// Lấy chi tiết Video cho Admin theo ID (Bắt buộc xác thực Admin)
router.get('/id/:id', authMiddleware as express.RequestHandler, adminMiddleware as express.RequestHandler, getVideoByIdAdmin as express.RequestHandler);

// Lấy chi tiết Video cho Client theo Slug (Dynamic Auth Check)
router.get('/slug/:slug', optionalAuthMiddleware as express.RequestHandler, getVideoBySlug as express.RequestHandler);

// Lấy chi tiết Video cho Client theo ID (Dynamic Auth Check)
router.get('/client/:id', optionalAuthMiddleware as express.RequestHandler, getVideoByClient as express.RequestHandler);
router.get('/:id', optionalAuthMiddleware as express.RequestHandler, getVideoByClient as express.RequestHandler);

// Tạo mới Video (Cần đăng nhập Admin)
router.post('/', authMiddleware as express.RequestHandler, adminMiddleware as express.RequestHandler, createVideo as express.RequestHandler);

// Cập nhật thông tin Video (Cần đăng nhập Admin)
router.put('/:id', authMiddleware as express.RequestHandler, adminMiddleware as express.RequestHandler, updateVideo as express.RequestHandler);

// Cập nhật nhanh trạng thái Video (draft / published / archived) (Cần đăng nhập Admin)
router.patch('/:id/status', authMiddleware as express.RequestHandler, adminMiddleware as express.RequestHandler, updateVideoStatus as express.RequestHandler);

// Cập nhật nhanh quyền truy cập Premium (isPremium) (Cần đăng nhập Admin)
router.patch('/:id/access', authMiddleware as express.RequestHandler, adminMiddleware as express.RequestHandler, updateVideoAccess as express.RequestHandler);

// Xóa Video (Cần đăng nhập Admin)
router.delete('/:id', authMiddleware as express.RequestHandler, adminMiddleware as express.RequestHandler, deleteVideo as express.RequestHandler);

export default router;
