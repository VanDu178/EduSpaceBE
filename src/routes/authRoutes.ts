import express from 'express';
import {
  register,
  login,
  googleLogin,
  tokenRefresh,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  changePassword
} from '../controllers/authController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = express.Router();

// Route Đăng ký (Public)
router.post('/register', register as express.RequestHandler);

// Route Đăng nhập (Public)
router.post('/login', login as express.RequestHandler);

// Route Đăng nhập bằng Google (Public)
router.post('/google', googleLogin as express.RequestHandler);

// Route Quên mật khẩu (Public)
router.post('/forgot-password', forgotPassword as express.RequestHandler);

// Route Đặt lại mật khẩu bằng OTP (Public)
router.post('/reset-password', resetPassword as express.RequestHandler);

// Route Đổi mật khẩu (Protected)
router.post('/change-password', authMiddleware as any, changePassword as any);

// Route Refresh Token (Public - gửi kèm Cookie)
router.post('/refresh', tokenRefresh as express.RequestHandler);

// Route Đăng xuất (Public)
router.post('/logout', logout as express.RequestHandler);

// Route Lấy thông tin cá nhân (Protected)
router.get('/me', authMiddleware as any, getMe as any);

export default router;

