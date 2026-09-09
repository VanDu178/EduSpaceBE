import 'dotenv/config';
import http from 'http';
import app from './app';
import { initSocketServer } from './config/socket/socketManager';
import { initCleanupBunnyUploadsCron } from './cronJobs/cleanupBunnyUploadsJob';

// Đọc giá trị cổng PORT từ biến môi trường, mặc định là 5000.
const PORT = process.env.PORT || 5000;

// Khởi tạo HTTP Server bọc ứng dụng Express
const server = http.createServer(app);

// Khởi tạo Socket.io Server tập trung
initSocketServer(server);

// Khởi tạo Cronjob tự động dọn dẹp các tệp Video Bunny Stream mồ côi
initCleanupBunnyUploadsCron();

// Khởi chạy server lắng nghe kết nối.
server.listen(PORT, () => {
  console.log(`[TradeVerseBE] Server is running on port: http://localhost:${PORT}`);
});
