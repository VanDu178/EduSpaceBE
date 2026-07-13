const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
// Cấu hình CORS để cho phép Frontend ReactJS kết nối vào port mà BE config.
app.use(cors());

// Middleware phân tích body dạng JSON trong request.
app.use(express.json());

// API kiểm tra trạng thái sức khỏe của server (Health Check).
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: { status: 'UP' },
    message: 'Backend server is healthy and running!'
  });
});

module.exports = app;
