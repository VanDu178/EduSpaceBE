import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import apiRouter from './routes';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

// Middleware
// Cấu hình CORS để cho phép Frontend gửi cookies (credentials: true)
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

// Sử dụng cookie-parser để xử lý HttpOnly Cookies
app.use(cookieParser());

// Middleware phân tích body dạng JSON trong request.
app.use(express.json());

// Đăng ký routes
app.use('/api', apiRouter);

// API kiểm tra trạng thái sức khỏe của server (Health Check).
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: { status: 'UP' },
    message: 'Backend server is healthy and running!'
  });
});

// Middleware xử lý lỗi tập trung (bắt buộc đặt ở cuối cùng)
app.use(errorHandler as any);

export default app;
