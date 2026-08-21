# TradeVerse Backend (TradeVerseBE)

Dự án Backend cung cấp API cho hệ thống **TradeVerse**. 

## 🛠 Công nghệ sử dụng
- **Runtime:** Node.js (Express.js)
- **Database ORM:** Prisma (kết nối cơ sở dữ liệu linh hoạt)
- **Bảo mật & Xác thực:** JSON Web Token (JWT), bcrypt (băm mật khẩu)
- **Middleware:** CORS, dotenv

## 📂 Cấu trúc thư mục chính
- `src/app.js`: Cấu hình chính của ứng dụng Express.
- `server.js`: Điểm khởi chạy (Entrypoint) của server.
- `prisma/`: Chứa schema cơ sở dữ liệu và các cấu hình migration của Prisma.
- `src/routes/`: Định nghĩa các endpoints / APIs của hệ thống.
- `src/controllers/`: Xử lý logic nghiệp vụ cho từng endpoint.
- `src/middlewares/`: Các bộ lọc trung gian xử lý xác thực (Authentication), phân quyền (Authorization) và kiểm tra dữ liệu.
- `src/config/`: Cấu hình kết nối cơ sở dữ liệu và các tham số môi trường khác.

## 🚀 Hướng dẫn cài đặt và chạy thử

### 1. Cài đặt các thư viện cần thiết
Tại thư mục `EduSpaceBE`, chạy lệnh sau để cài đặt dependencies:
```bash
npm install
```

### 2. Cấu hình biến môi trường
Tạo file `.env` từ file `.env.example` và thiết lập các giá trị kết nối:
```env
PORT=5000
DATABASE_URL="mongodb://localhost:27017/eduspace" # Hoặc URL PostgreSQL/MySQL tương ứng
JWT_SECRET="your_jwt_secret_key"
```

### 3. Đồng bộ Database qua Prisma
Nếu bạn cần tạo schema trong database hoặc sinh Client:
```bash
npx prisma generate
```

### 4. Khởi chạy Server
Chạy môi trường phát triển (Development mode):
```bash
npm run dev
```

Server sẽ được chạy tại địa chỉ mặc định: `http://localhost:5000`.
