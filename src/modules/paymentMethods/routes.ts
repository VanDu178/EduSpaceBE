import express from 'express';
import {
  getPaymentMethods,
  getActivePaymentMethods,
  getPaymentMethodById,
  createPaymentMethod,
  updatePaymentMethod,
  togglePaymentMethodStatus,
  deletePaymentMethod,
  updatePaymentMethodSortOrder
} from './controller';
import { authMiddleware } from '../../middlewares/authMiddleware';

const router = express.Router();

// Lấy danh sách phương thức thanh toán đang hoạt động cho Client Checkout (Public)
router.get('/active', getActivePaymentMethods as express.RequestHandler);

// Lấy danh sách tất cả các phương thức thanh toán cho Admin (Public/Protected)
router.get('/', getPaymentMethods as express.RequestHandler);

// Lấy chi tiết phương thức thanh toán theo ID
router.get('/:id', getPaymentMethodById as express.RequestHandler);

// Tạo mới phương thức thanh toán (Protected)
router.post('/', authMiddleware as express.RequestHandler, createPaymentMethod as express.RequestHandler);

// Cập nhật phương thức thanh toán (Protected)
router.put('/:id', authMiddleware as express.RequestHandler, updatePaymentMethod as express.RequestHandler);

// Cập nhật thứ tự sắp xếp phương thức thanh toán (Protected)
router.patch('/:id/sort-order', authMiddleware as express.RequestHandler, updatePaymentMethodSortOrder as express.RequestHandler);

// Bật/tắt trạng thái kích hoạt phương thức thanh toán (Protected)
router.patch('/:id/status', authMiddleware as express.RequestHandler, togglePaymentMethodStatus as express.RequestHandler);

// Xóa phương thức thanh toán (Protected)
router.delete('/:id', authMiddleware as express.RequestHandler, deletePaymentMethod as express.RequestHandler);

export default router;
