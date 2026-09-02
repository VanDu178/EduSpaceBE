import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/responseHelper';
import { AppError } from '../../utils/appError';
import type { AuthenticatedRequest } from '../../middlewares/authMiddleware';
import {
  validateCreateTransactionData,
  validateGetTransactionByCodeData,
  validateGetTransactionStatusData,
  validateCancelTransactionData,
  validateApproveTransactionData,
  validateDownloadInvoicePdfData,
  validateGetTransactionsQueryData,
} from './validation';
import {
  createTransactionService,
  getTransactionByCodeService,
  getTransactionStatusService,
  cancelTransactionService,
  approveTransactionService,
  handlePayOSWebhookService,
  getTransactionsService,
  getMyTransactionsService,
} from './services';

/**
 * Khởi tạo đơn thanh toán VietQR cho gói dịch vụ
 */
export const createTransaction = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;

  // 1. Validate dữ liệu đầu vào (Zod & DB status)
  const validatedData = await validateCreateTransactionData(userId, req.body);

  // 2. Gọi tầng Service để xử lý nghiệp vụ & lưu DB
  const transaction = await createTransactionService(userId, validatedData);

  return sendSuccess(res, transaction, 'Vui lòng quét mã VietQR để hoàn tất chuyển khoản.', 201);
});

/**
 * Lấy đầy đủ thông tin giao dịch thanh toán theo mã Code (Cho lần load đầu tiên)
 */
export const getTransactionByCode = asyncHandler(async (req: Request, res: Response) => {
  // 1. Validate dữ liệu đầu vào
  const transaction = await validateGetTransactionByCodeData(req.params);

  // 2. Gọi tầng Service lấy chi tiết đầy đủ dữ liệu
  const { data, message } = await getTransactionByCodeService(transaction);

  return sendSuccess(res, data, message);
});

/**
 * Lấy trạng thái thanh toán của đơn hàng theo Mã code (Phục vụ Polling trên Client)
 */
export const getTransactionStatus = asyncHandler(async (req: Request, res: Response) => {
  // 1. Validate dữ liệu đầu vào (Zod & DB existence)
  const transaction = await validateGetTransactionStatusData(req.params);

  // 2. Gọi tầng Service xử lý Live Sync & tính toán dữ liệu phản hồi
  const { data, message } = await getTransactionStatusService(transaction);

  return sendSuccess(res, data, message);
});

/**
 * Hủy giao dịch thanh toán (Client hoặc Admin)
 */
export const cancelTransaction = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // 1. Validate dữ liệu & quyền hạn
  const transaction = await validateCancelTransactionData(req.user, req.params);

  // 2. Gọi tầng Service để cập nhật DB
  const updated = await cancelTransactionService(transaction.id);

  return sendSuccess(res, updated, 'Hủy giao dịch thành công');
});

/**
 * Duyệt thanh toán thành công thủ công (Admin)
 */
export const approveTransaction = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // 1. Validate dữ liệu đầu vào
  const validatedData = await validateApproveTransactionData(req.params, req.body);

  // 2. Gọi tầng Service để xử lý duyệt đơn & kích hoạt gói
  const { transaction, message } = await approveTransactionService(validatedData, req.user?.id);

  return sendSuccess(res, transaction, message);
});

/**
 * Webhook xử lý thanh toán tự động chuyên biệt cho PayOS
 */
export const handleWebhook = asyncHandler(async (req: Request, res: Response) => {
  // 1. Gọi tầng Service xử lý xác thực chữ ký & cập nhật trạng thái đơn
  const { result, message } = await handlePayOSWebhookService(req.body || {}, req.headers);

  return sendSuccess(res, result, message);
});

/**
 * Lấy danh sách tất cả các giao dịch thanh toán (Admin)
 */
export const getTransactions = asyncHandler(async (req: Request, res: Response) => {
  // 1. Validate query params (Zod)
  const queryData = validateGetTransactionsQueryData(req.query);

  // 2. Gọi tầng Service để query DB & phân trang
  const result = await getTransactionsService(queryData);

  return sendSuccess(res, result, 'Lấy danh sách Giao dịch Thanh toán thành công');
});

/**
 * User đang đăng nhập tự lấy lịch sử các đơn giao dịch thanh toán của chính mình
 */
export const getMyTransactions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError('Vui lòng đăng nhập để xem lịch sử giao dịch', 401, 'UNAUTHORIZED');
  }

  // 1. Gọi tầng Service lấy dữ liệu lịch sử giao dịch
  const result = await getMyTransactionsService(userId);

  return sendSuccess(res, result, 'Lấy lịch sử giao dịch thành công');
});

/**
 * Tải file PDF Hóa đơn điện tử của giao dịch thanh toán
 */
export const downloadInvoicePdf = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // 1. Validate dữ liệu & quyền hạn
  const transaction = await validateDownloadInvoicePdfData(req.user, req.params);

  // 2. Tải service PDF & tạo Buffer
  const { generateInvoicePdfBuffer } = await import('../../services/invoicePdfService');
  const pdfBuffer = await generateInvoicePdfBuffer({
    code: transaction.code,
    amount: Number(transaction.amount),
    billingCycle: transaction.billingCycle,
    status: transaction.status,
    createdAt: transaction.createdAt,
    paidAt: transaction.paidAt,
    expiredAt: transaction.expiredAt,
    user: transaction.user,
    plan: transaction.plan,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="Invoice-TradeVerse-${transaction.code}.pdf"`);
  res.send(pdfBuffer);
});
