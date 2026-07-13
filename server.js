require('dotenv').config();
const app = require('./src/app');

// Đọc giá trị cổng PORT từ biến môi trường, mặc định là 5000.
const PORT = process.env.PORT || 5000;

// Khởi chạy server lắng nghe kết nối.
app.listen(PORT, () => {
  console.log(`[EduSpaceBE] Server is running on port: http://localhost:${PORT}`);
});
