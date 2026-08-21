import type { Response } from 'express';

/**
 * Gửi phản hồi API thành công chuẩn hóa.
 * Hàm này giúp đồng bộ định dạng dữ liệu trả về cho Frontend (TradeVerseFE) khi gọi API thành công.
 * 
 * @param res Đối tượng Response của Express để gửi phản hồi HTTP
 * @param data Dữ liệu thực tế cần gửi về (Payload, hỗ trợ Generic Type <T> để nhận mọi kiểu dữ liệu)
 * @param message Thông điệp mô tả kết quả thành công (mặc định là 'Success')
 * @param statusCode Mã trạng thái HTTP (mặc định là 200 OK)
 */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  message: string = 'Success',
  statusCode: number = 200
) => {
  res.status(statusCode).json({
    success: true,      // Trạng thái thành công (luôn là true ở helper này)
    message,            // Thông điệp phản hồi
    data,               // Dữ liệu payload thực tế trả về cho client
    errorCode: null,    // Mã lỗi (luôn là null khi thành công)
    errors: null        // Danh sách chi tiết lỗi (luôn là null khi thành công)
  });
};

