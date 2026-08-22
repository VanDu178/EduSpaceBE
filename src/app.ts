import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import apiRouter from './routes';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

// Middleware
// Cấu hình CORS đọc danh sách các đường dẫn Frontend (Client FE, Admin FE) từ .env
const allowedOrigins = [
  process.env.CLIENT_FE_URL,
  process.env.ADMIN_FE_URL,
  process.env.CLIENT_URL
].filter(Boolean) as string[];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Sử dụng cookie-parser để xử lý HttpOnly Cookies
app.use(cookieParser());

// Middleware phân tích body dạng JSON trong request (hỗ trợ payload ảnh Base64 lên tới 10MB)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

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
