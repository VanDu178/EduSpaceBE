import express from 'express';
import {
  getFeatures,
  getFeatureById,
  createFeature,
  updateFeature,
  deleteFeature,
  toggleFeatureStatus,
  updateFeatureSortOrder
} from '../controllers/featureController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = express.Router();

// Lấy danh sách các tính năng (Public/Protected)
router.get('/', getFeatures as express.RequestHandler);

// Lấy chi tiết tính năng (Public/Protected)
router.get('/:id', getFeatureById as express.RequestHandler);

// Tạo mới tính năng (Protected)
router.post('/', authMiddleware as express.RequestHandler, createFeature as express.RequestHandler);

// Cập nhật tính năng (Protected)
router.put('/:id', authMiddleware as express.RequestHandler, updateFeature as express.RequestHandler);

// Cập nhật thứ tự tính năng (Protected)
router.patch('/:id/sort-order', authMiddleware as express.RequestHandler, updateFeatureSortOrder as express.RequestHandler);

// Bật/tắt trạng thái tính năng (Protected)
router.patch('/:id/status', authMiddleware as express.RequestHandler, toggleFeatureStatus as express.RequestHandler);

// Xóa tính năng (Protected)
router.delete('/:id', authMiddleware as express.RequestHandler, deleteFeature as express.RequestHandler);

export default router;

