import type { Request, Response } from 'express';
import prisma from '../../config/db';
import { AppError } from '../../utils/appError';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/responseHelper';
import { generatePaymentTransactionCode } from '../../utils/codeGenerator';
import type { AuthenticatedRequest } from '../../middlewares/authMiddleware';
import { PAYMENT_METHOD_CODES } from '../paymentMethods/constants';
import { BILLING_CYCLES } from '../userSubscriptions/constants';
import { TRANSACTION_STATUS } from './constants';
import { fulfillPaymentTransaction } from '../../services/paymentTransactionService';


/**
 * Khởi tạo đơn thanh toán VietQR cho gói dịch vụ
 */
export const createTransaction = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError('Vui lòng đăng nhập để thực hiện giao dịch', 401, 'UNAUTHORIZED');
  }

  const { planId, billingCycle = BILLING_CYCLES.MONTHLY, paymentMethod = PAYMENT_METHOD_CODES.VIETQR } = req.body;
  const normalizedPaymentMethod = String(paymentMethod).trim().toUpperCase();

  const parsedPlanId = parseInt(planId, 10);
  if (isNaN(parsedPlanId)) {
    throw new AppError('Gói dịch vụ đang được bảo trì hoặc không hợp lệ. Vui lòng liên hệ hỗ trợ để được trợ giúp', 400, 'VALIDATION_ERROR');
  }

  // 1. Kiểm tra thông tin gói
  const plan = await prisma.membershipPlan.findUnique({
    where: { id: parsedPlanId }
  });

  if (!plan) {
    throw new AppError('Gói dịch vụ không tồn tại hoặc đã ngưng áp dụng', 404, 'NOT_FOUND');
  }

  if (!plan.isActive) {
    throw new AppError('Gói dịch vụ này hiện đang tạm ngưng đăng ký. Vui lòng chọn gói khác', 400, 'VALIDATION_ERROR');
  }

  // Kiểm tra nếu người dùng đã sở hữu gói tương đương hoặc cao hơn
  const activeSub = await prisma.userSubscription.findFirst({
    where: { userId, status: 'active' },
    include: { plan: true }
  });

  if (activeSub && activeSub.plan) {
    if (plan.tierLevel <= activeSub.plan.tierLevel) {
      throw new AppError(
        'Bạn đang sở hữu gói dịch vụ này hoặc gói cao hơn. Không thể đăng ký gói cùng cấp hoặc cấp thấp hơn.',
        400,
        'VALIDATION_ERROR'
      );
    }
  }

  // 2. Tìm tài khoản ngân hàng nhận tiền mặc định của hệ thống
  let paymentAccount = await prisma.paymentAccount.findFirst({
    where: { isDefault: true },
    include: { bank: true }
  });

  if (!paymentAccount) {
    paymentAccount = await prisma.paymentAccount.findFirst({
      include: { bank: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  if (!paymentAccount) {
    throw new AppError('Phương thức nhận tiền hiện chưa sẵn sàng. Vui lòng thử lại sau hoặc liên hệ bộ phận hỗ trợ', 500, 'INTERNAL_SERVER_ERROR');
  }

  // 3. Tính số tiền thanh toán (tháng hoặc năm)
  const amount = billingCycle === BILLING_CYCLES.YEARLY ? plan.yearlyPrice : plan.monthlyPrice;

  // 4. Sinh mã đơn ngẫu nhiên duy nhất
  let code = generatePaymentTransactionCode();
  let isCodeExist = await prisma.paymentTransaction.findUnique({ where: { code } });
  while (isCodeExist) {
    code = generatePaymentTransactionCode();
    isCodeExist = await prisma.paymentTransaction.findUnique({ where: { code } });
  }

  const transferContent = code; // Ví dụ: TRV8K92A5

  // 5. Sinh URL ảnh VietQR QuickLink (dạng compact2)
  const qrCodeUrl = `https://img.vietqr.io/image/${paymentAccount.bankCode}-${paymentAccount.accountNo}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(paymentAccount.accountHolder)}`;

  // 6. Thời gian đếm ngược hết hạn (15 phút)
  const expiredAt = new Date(Date.now() + 15 * 60 * 1000);

  // 7. Lưu đơn hàng vào DB
  const transaction = await prisma.paymentTransaction.create({
    data: {
      code,
      userId,
      planId: parsedPlanId,
      paymentAccountId: paymentAccount.id,
      billingCycle: billingCycle === BILLING_CYCLES.YEARLY ? BILLING_CYCLES.YEARLY : BILLING_CYCLES.MONTHLY,
      amount,
      paymentMethod: normalizedPaymentMethod,
      transferContent,
      status: TRANSACTION_STATUS.PENDING,
      bankCode: paymentAccount.bankCode,
      accountNo: paymentAccount.accountNo,
      accountHolder: paymentAccount.accountHolder,
      qrCodeUrl,
      expiredAt
    },
    include: {
      plan: {
        select: {
          id: true,
          code: true,
          name: true
        }
      },
      paymentAccount: {
        include: {
          bank: true
        }
      }
    }
  });

  return sendSuccess(res, transaction, 'Vui lòng quét mã VietQR để hoàn tất chuyển khoản.', 201);
});

/**
 * Lấy trạng thái thanh toán của đơn hàng theo Mã code (Phục vụ Polling trên Client)
 */
export const getTransactionStatus = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.params;

  if (!code) {
    throw new AppError('Mã giao dịch không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  let transaction = await prisma.paymentTransaction.findUnique({
    where: { code: String(code).trim() },
    include: {
      plan: true,
      paymentAccount: {
        include: { bank: true }
      }
    }
  });

  if (!transaction) {
    throw new AppError('Không tìm thấy thông tin giao dịch', 404, 'NOT_FOUND');
  }

  // Tự động cập nhật hết hạn nếu quá 15 phút mà vẫn pending
  if (transaction.status === TRANSACTION_STATUS.PENDING && new Date() > new Date(transaction.expiredAt)) {
    transaction = await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: { status: TRANSACTION_STATUS.EXPIRED },
      include: {
        plan: true,
        paymentAccount: {
          include: { bank: true }
        }
      }
    });
  }

  let message = 'Trạng thái giao dịch thanh toán';
  switch (transaction.status) {
    case TRANSACTION_STATUS.COMPLETED:
      message = 'Thanh toán thành công. Gói dịch vụ đã được kích hoạt!';
      break;
    case TRANSACTION_STATUS.EXPIRED:
      message = 'Giao dịch đã hết thời hạn thanh toán (15 phút). Vui lòng tạo giao dịch mới.';
      break;
    case TRANSACTION_STATUS.CANCELLED:
      message = 'Giao dịch đã bị hủy. Vui lòng tạo giao dịch mới hoặc liên hệ bộ phận CSKH.';
      break;
    case TRANSACTION_STATUS.PENDING:
    default:
      message = 'Giao dịch đang chờ thanh toán. Vui lòng quét mã VietQR hoặc chuyển khoản đúng nội dung.';
      break;
  }

  return sendSuccess(res, {
    id: transaction.id,
    code: transaction.code,
    status: transaction.status,
    amount: transaction.amount,
    transferContent: transaction.transferContent,
    qrCodeUrl: transaction.qrCodeUrl,
    expiredAt: transaction.expiredAt,
    paidAt: transaction.paidAt,
    paymentAccount: transaction.paymentAccount,
    plan: transaction.plan
  }, message);
});

/**
 * Hủy giao dịch thanh toán (Client hoặc Admin)
 */
export const cancelTransaction = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { code } = req.params;
  const userId = req.user?.id;

  const transaction = await prisma.paymentTransaction.findUnique({
    where: { code: String(code).trim() }
  });

  if (!transaction) {
    throw new AppError('Không tìm thấy giao dịch', 404, 'NOT_FOUND');
  }

  if (req.user?.role !== 'admin' && transaction.userId !== userId) {
    throw new AppError('Bạn không có quyền thao tác trên giao dịch này', 403, 'FORBIDDEN');
  }

  if (transaction.status !== TRANSACTION_STATUS.PENDING) {
    throw new AppError('Chỉ có thể hủy giao dịch đang ở trạng thái chờ', 400, 'VALIDATION_ERROR');
  }

  const updated = await prisma.paymentTransaction.update({
    where: { id: transaction.id },
    data: { status: TRANSACTION_STATUS.CANCELLED }
  });

  return sendSuccess(res, updated, 'Hủy giao dịch thành công');
});

/**
 * Duyệt thanh toán thành công thủ công (Admin)
 */
export const approveTransaction = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const txId = parseInt(id as string, 10);
  const { paymentRef } = req.body;

  if (isNaN(txId)) {
    throw new AppError('Mã giao dịch không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const { transaction, alreadyCompleted } = await fulfillPaymentTransaction({
    txId,
    paymentRef,
    approvalType: 'manual',
    approvedBy: req.user?.id
  });

  const message = alreadyCompleted
    ? 'Giao dịch đã được duyệt trước đó'
    : 'Duyệt thanh toán và kích hoạt gói thành công';

  return sendSuccess(res, transaction, message);
});

/**
 * Webhook xử lý thanh toán tự động (Ngân hàng / Cổng thanh toán gọi)
 * Route công khai: POST /api/v1/payment-transactions/webhook
 */
export const handleWebhook = asyncHandler(async (req: Request, res: Response) => {
  // 1. Kiểm tra Webhook Secret Token / Header (nếu hệ thống có cấu hình WEBHOOK_SECRET)
  const webhookSecret = process.env.WEBHOOK_SECRET || process.env.SEPAY_WEBHOOK_API_KEY;
  if (webhookSecret) {
    const authHeader = req.headers['authorization'] || req.headers['x-api-key'] || req.headers['x-sepay-api-key'];
    const token = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    const bearerToken = token?.replace(/^Bearer\s+/i, '');

    if (!token || (token !== webhookSecret && bearerToken !== webhookSecret)) {
      throw new AppError('Xác thực Webhook không hợp lệ', 401, 'UNAUTHORIZED');
    }
  }

  // 2. Trích xuất dữ liệu từ Webhook Payload
  // Hỗ trợ cấu trúc payload linh hoạt từ các đơn vị như SePAY, Casso, VietQR, PayOS
  const payload = req.body || {};

  // Tìm chuỗi chứa mã giao dịch (VD: content, transferContent, code, description, des, orderCode)
  const rawContent = String(
    payload.content ||
    payload.transferContent ||
    payload.code ||
    payload.description ||
    payload.des ||
    payload.orderCode ||
    ''
  ).trim();

  // Tìm mã đơn dạng TRV... trong chuỗi nội dung chuyển khoản
  const matchedCode = rawContent.match(/TRV[A-Z0-9]{6,12}/i)?.[0]?.toUpperCase() || rawContent.toUpperCase();

  if (!matchedCode) {
    return sendSuccess(res, { processed: false }, 'Nội dung chuyển khoản không chứa mã giao dịch hợp lệ');
  }

  // Tìm bản ghi giao dịch theo code hoặc transferContent
  const transaction = await prisma.paymentTransaction.findFirst({
    where: {
      OR: [
        { code: matchedCode },
        { transferContent: matchedCode }
      ]
    }
  });

  if (!transaction) {
    return sendSuccess(res, { processed: false, code: matchedCode }, 'Không tìm thấy giao dịch tương ứng trên hệ thống');
  }

  // 3. Trích xuất thông tin giao dịch bổ sung (Mã tham chiếu ngân hàng & Số tiền)
  const paymentRef = String(payload.referenceCode || payload.referenceNum || payload.transactionId || payload.id || payload.paymentRef || '').trim() || null;
  const transferAmount = Number(payload.amount || payload.transferAmount || 0);

  // 4. Nếu truyền số tiền nhận được, kiểm tra khớp số tiền đơn hàng
  if (transferAmount > 0 && transferAmount < Number(transaction.amount)) {
    throw new AppError(
      `Số tiền thanh toán (${transferAmount.toLocaleString('vi-VN')} đ) nhỏ hơn giá trị đơn hàng (${Number(transaction.amount).toLocaleString('vi-VN')} đ)`,
      400,
      'VALIDATION_ERROR'
    );
  }

  // 5. Thực hiện tự động duyệt đơn và kích hoạt gói
  const { transaction: updatedTransaction, alreadyCompleted } = await fulfillPaymentTransaction({
    txId: transaction.id,
    paymentRef,
    approvalType: 'auto',
    approvedBy: null
  });

  const message = alreadyCompleted
    ? 'Webhook ghi nhận: Giao dịch đã hoàn tất từ trước'
    : 'Xử lý webhook thanh toán thành công. Đã kích hoạt gói dịch vụ';

  return sendSuccess(res, {
    transactionId: updatedTransaction.id,
    code: updatedTransaction.code,
    status: updatedTransaction.status,
    alreadyCompleted
  }, message);
});

/**
 * Lấy danh sách tất cả các giao dịch thanh toán (Admin)
 */
export const getTransactions = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 10;
  const skip = (page - 1) * limit;

  const { status, search } = req.query;
  const whereClause: any = {};

  if (status && status !== 'all') {
    whereClause.status = status as string;
  }

  if (search && (search as string).trim() !== '') {
    const keyword = (search as string).trim();
    whereClause.OR = [
      { code: { contains: keyword } },
      { transferContent: { contains: keyword } },
      { user: { email: { contains: keyword } } },
      { user: { name: { contains: keyword } } }
    ];
  }

  const totalItems = await prisma.paymentTransaction.count({ where: whereClause });

  const items = await prisma.paymentTransaction.findMany({
    where: whereClause,
    skip,
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          code: true,
          email: true,
          name: true,
          avatarUrl: true,
          subscriptions: {
            where: { status: 'active' },
            include: { plan: true }
          }
        }
      },
      approvedByUser: {
        select: { id: true, code: true, email: true, name: true, avatarUrl: true }
      },
      plan: {
        select: { id: true, code: true, name: true, tierLevel: true }
      },
      paymentAccount: {
        include: { bank: true }
      }
    }
  });

  const totalPages = Math.ceil(totalItems / limit);

  return sendSuccess(res, {
    items,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems,
      itemsPerPage: limit
    }
  }, 'Lấy danh sách Giao dịch Thanh toán thành công');
});

/**
 * User đang đăng nhập tự lấy lịch sử các đơn giao dịch thanh toán VietQR của chính mình
 */
export const getMyTransactions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError('Vui lòng đăng nhập để xem lịch sử giao dịch', 401, 'UNAUTHORIZED');
  }

  const transactions = await prisma.paymentTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      plan: {
        select: {
          id: true,
          code: true,
          name: true,
          monthlyPrice: true,
          yearlyPrice: true,
          tierLevel: true,
        }
      },
      paymentAccount: {
        include: { bank: true }
      }
    }
  });

  return sendSuccess(res, transactions, 'Lấy lịch sử giao dịch thành công');
});

/**
 * Tải file PDF Hóa đơn điện tử của giao dịch thanh toán (chuẩn mẫu TradeVerse)
 */
export const downloadInvoicePdf = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const codeParam = req.params.code;
  const code = Array.isArray(codeParam) ? codeParam[0] : codeParam;
  const userId = req.user?.id;

  if (!userId) {
    throw new AppError('Vui lòng đăng nhập để tải hóa đơn', 401, 'UNAUTHORIZED');
  }

  const transaction = await prisma.paymentTransaction.findUnique({
    where: { code },
    include: {
      user: { select: { name: true, email: true } },
      plan: { select: { name: true } },
    },
  });

  if (!transaction) {
    throw new AppError('Không tìm thấy thông tin giao dịch', 404, 'NOT_FOUND');
  }

  if (req.user?.role !== 'admin' && transaction.userId !== userId) {
    throw new AppError('Bạn không có quyền truy cập hóa đơn của giao dịch này', 403, 'FORBIDDEN');
  }

  if (transaction.status !== TRANSACTION_STATUS.COMPLETED) {
    throw new AppError('Chỉ có thể tải hóa đơn đối với giao dịch đã hoàn tất', 400, 'VALIDATION_ERROR');
  }

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



