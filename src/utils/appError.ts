/**
 * Class AppError đại diện cho các lỗi có chủ định trong ứng dụng (Operational Errors).
 * Ví dụ: sai mật khẩu, tài khoản tồn tại, thiếu dữ liệu đầu vào...
 * 
 * Lớp này kế thừa từ lớp `Error` gốc của JavaScript/TypeScript để:
 * 1. Cho phép sử dụng cú pháp `throw new AppError(...)` nhằm ngắt ngay luồng xử lý và gom lỗi về Global Error Handler.
 * 2. Tự động ghi lại Stack Trace giúp lập trình viên debug chính xác lỗi xảy ra ở dòng nào.
 */
export class AppError extends Error {
  public readonly statusCode: number;                // Mã trạng thái HTTP trả về cho client (ví dụ: 400, 401, 404, 500)
  public readonly errorCode?: string;                // Mã lỗi nội bộ tự định nghĩa phục vụ cho Frontend xử lý logic (ví dụ: 'AUTH_001')
  public readonly errors?: Record<string, string[]>; // Danh sách chi tiết các trường bị lỗi (thường dùng khi validate form)
  public readonly isOperational: boolean;            // Đánh dấu đây là lỗi nghiệp vụ được kiểm soát (luôn là true)

  constructor(
    message: string,
    statusCode: number,
    errorCode?: string,
    errors?: Record<string, string[]>
  ) {
    super(message); // Gọi constructor của class Error cha để gán thông điệp lỗi (message)
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.errors = errors;
    this.isOperational = true; // Xác định đây là lỗi nghiệp vụ có thể kiểm soát, phân biệt với lỗi crash hệ thống ngoài ý muốn

    // Lưu lại stack trace (dấu vết cuộc gọi hàm gây ra lỗi) để phục vụ debug.
    // Đồng thời loại bỏ chính constructor của AppError khỏi stack trace để log lỗi hiển thị sạch sẽ, chuẩn xác hơn.
    Error.captureStackTrace(this, this.constructor);
  }
}

