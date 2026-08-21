import express from 'express';
import {
  register,
  login,
  tokenRefresh,
  logout,
  getMe
} from '../controllers/authController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = express.Router();

console.log("Da chay vao router")

// Route Đăng ký (Public)
router.post('/register', register as express.RequestHandler);

// Route Đăng nhập (Public)
router.post('/login', login as express.RequestHandler);

// Route Refresh Token (Public - gửi kèm Cookie)
router.post('/refresh', tokenRefresh as express.RequestHandler);

// Route Đăng xuất (Public)
router.post('/logout', logout as express.RequestHandler);

// Route Lấy thông tin cá nhân (Protected)
router.get('/me', authMiddleware as any, getMe as any);

export default router;
