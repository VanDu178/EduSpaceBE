import type { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../../config/db';
import { AppError } from '../../utils/appError';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/responseHelper';
import { generatePaymentTransactionCode } from '../../utils/codeGenerator';
import { getStartOfToday } from '../../utils/dateHelpers';
import type { AuthenticatedRequest } from '../../middlewares/authMiddleware';
import { BILLING_CYCLES } from '../userSubscriptions/constants';
import { TRANSACTION_STATUS } from './constants';
import { fulfillPaymentTransaction, processPartialPaymentTransaction } from './utils';
import { payos } from '../../config/payos';
import {
  validateCreateTransactionData,
  validateGetTransactionStatusData,
  validateCancelTransactionData,
  validateApproveTransactionData,
  validateDownloadInvoicePdfData,
  validateGetTransactionsQueryData,
} from './validation';



/**
 * Khởi tạo đơn thanh toán VietQR cho gói dịch vụ
 */
export const createTransaction = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;

  // 1. Kiểm tra dữ liệu đầu vào
  const { plan, targetPaymentMethod, paymentAccount, amount, billingCycle } =
    await validateCreateTransactionData(userId, req.body);

  // 2. Sinh mã đơn ngẫu nhiên duy nhất
  let code = generatePaymentTransactionCode();
  let isCodeExist = await prisma.paymentTransaction.findUnique({ where: { code } });
  while (isCodeExist) {
    code = generatePaymentTransactionCode();
    isCodeExist = await prisma.paymentTransaction.findUnique({ where: { code } });
  }

  const transferContent = code; // Ví dụ: TRV8K92A5

  // 3. Chuẩn bị URL mã VietQR mặc định (truyền thống sang STK hệ thống) làm phương án dự phòng bảo đảm luôn nhận được tiền
  const defaultVietQrUrl = `https://img.vietqr.io/image/${paymentAccount.bankCode}-${paymentAccount.accountNo}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(paymentAccount.accountHolder)}`;
  let qrCodeUrl = defaultVietQrUrl;

  let createdOrderCode: string | null = null;

  // Ưu tiên gọi PayOS API để tạo mã VietQR động nhận Webhook tự động
  if (process.env.PAYOS_CLIENT_ID && process.env.PAYOS_API_KEY) {
    try {
      const numericOrderCode = Number(String(Date.now()).slice(-8) + Math.floor(100 + Math.random() * 900));
      createdOrderCode = String(numericOrderCode);
      const clientUrl = process.env.CLIENT_FE_URL;

      const paymentLinkData = {
        orderCode: numericOrderCode,
        amount: Math.round(Number(amount)),
        description: code.slice(0, 25),
        cancelUrl: `${clientUrl}/pricing?cancel=true`,
        returnUrl: `${clientUrl}/pricing?success=true`,
        items: [
          {
            name: plan.name,
            quantity: 1,
            price: Math.round(Number(amount))
          }
        ]
      };

      const payosRes = await payos.paymentRequests.create(paymentLinkData);
      if (payosRes && payosRes.accountNumber && payosRes.bin) {
        qrCodeUrl = `https://img.vietqr.io/image/${payosRes.bin}-${payosRes.accountNumber}-compact2.png?amount=${payosRes.amount}&addInfo=${encodeURIComponent(payosRes.description)}&accountName=${encodeURIComponent(payosRes.accountName)}`;
      }
    } catch (err: any) {
      console.warn('Không thể tạo mã thanh toán qua PayOS API, tự động dùng mã VietQR mặc định:', err.message || err);
      qrCodeUrl = defaultVietQrUrl;
    }
  }

  // 4. Thời gian đếm ngược hết hạn (24 giờ)
  const expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000);


  // 7. Lưu đơn hàng vào DB
  const transaction = await prisma.paymentTransaction.create({
    data: {
      code,
      orderCode: createdOrderCode,
      userId,
      planId: plan.id,
      paymentAccountId: paymentAccount.id,
      billingCycle: billingCycle === BILLING_CYCLES.YEARLY ? BILLING_CYCLES.YEARLY : BILLING_CYCLES.MONTHLY,
      amount,
      paymentMethod: targetPaymentMethod.code,
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
  // 1. Kiểm tra dữ liệu đầu vào (Tầng 1 Zod Syntax & Tầng 2 DB Existence)
  let transaction = await validateGetTransactionStatusData(req.params);

  // 2. Logic Nghiệp vụ: Tự động cập nhật hết hạn nếu quá 15 phút mà vẫn PENDING
  if (transaction.status === TRANSACTION_STATUS.PENDING && new Date() > new Date(transaction.expiredAt)) {
    transaction = await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: { status: TRANSACTION_STATUS.EXPIRED },
      include: {
        plan: true,
        paymentAccount: {
          include: { bank: true }
        },
        refunds: {
          include: {
            refundedByUser: { select: { id: true, name: true, email: true } }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
  }

  // 3. Logic Real-time Live Sync (Lớp 1): Nếu đơn đang PENDING hoặc PARTIALLY_PAID, chủ động query PayOS SDK để kiểm tra dòng tiền thực tế
  if (
    (transaction.status === TRANSACTION_STATUS.PENDING || transaction.status === TRANSACTION_STATUS.PARTIALLY_PAID) &&
    process.env.PAYOS_CLIENT_ID &&
    process.env.PAYOS_API_KEY
  ) {
    const targetOrderCode = (transaction as any).orderCode;
    if (targetOrderCode) {
      try {
        const payosInfo = await payos.paymentRequests.get(Number(targetOrderCode));
        if (payosInfo) {
          const payosAmountPaid = Number(payosInfo.amountPaid || 0);
          const orderAmount = Number(transaction.amount);

          if (payosAmountPaid >= orderAmount) {
            // Khách hàng đã chuyển ĐỦ hoặc THỪA tiền -> Duyệt đơn và kích hoạt gói tức thì!
            const { transaction: fulfilledTx } = await fulfillPaymentTransaction({
              txId: transaction.id,
              paidAmount: payosAmountPaid,
              approvalType: 'auto',
              notes: 'Duyệt & kích hoạt gói tức thì qua PayOS Live Sync API'
            });
            transaction = fulfilledTx as any;
          } else if (payosAmountPaid > Number(transaction.paidAmount || 0)) {
            // Khách hàng đã chuyển THIẾU tiền -> Ghi nhận số tiền nạp tích lũy
            const incomingAmount = payosAmountPaid - Number(transaction.paidAmount || 0);
            const { transaction: partialTx } = await processPartialPaymentTransaction({
              txId: transaction.id,
              incomingAmount,
              approvalType: 'auto',
              notes: 'Ghi nhận số tiền nạp thiếu tức thì qua PayOS Live Sync API'
            });
            transaction = partialTx as any;
          }
        }
      } catch (payosErr: any) {
        console.warn(`[PayOS Live Sync] Không thể kiểm tra đơn #${transaction.code} (orderCode: ${targetOrderCode}):`, payosErr.message || payosErr);
      }
    }
  }

  const amount = Number(transaction.amount);
  const paidAmount = Number(transaction.paidAmount);
  const overpaidAmount = Math.max(0, paidAmount - amount);
  const remainingAmount = Math.max(0, amount - paidAmount);
  const totalRefundedAmount = (transaction.refunds || []).reduce((acc, r) => acc + Number(r.amount), 0);

  let message = 'Trạng thái giao dịch thanh toán';
  switch (transaction.status) {
    case TRANSACTION_STATUS.OVERPAID:
      message = `Thanh toán thành công. Gói dịch vụ đã kích hoạt! Ghi nhận thanh toán dư ${overpaidAmount.toLocaleString('vi-VN')} đ.`;
      break;
    case TRANSACTION_STATUS.COMPLETED:
      message = 'Thanh toán thành công. Gói dịch vụ đã được kích hoạt!';
      break;
    case TRANSACTION_STATUS.PARTIALLY_PAID:
      message = `Đã nhận ${paidAmount.toLocaleString('vi-VN')} đ / Cần ${amount.toLocaleString('vi-VN')} đ. Còn thiếu ${remainingAmount.toLocaleString('vi-VN')} đ.`;
      break;
    case TRANSACTION_STATUS.EXPIRED:
      message = 'Giao dịch đã hết thời hạn thanh toán (24 giờ). Vui lòng tạo giao dịch mới.';
      break;
    case TRANSACTION_STATUS.CANCELLED:
      message = 'Giao dịch đã bị hủy. Vui lòng tạo giao dịch mới hoặc liên hệ bộ phận CSKH.';
      break;
    case TRANSACTION_STATUS.PENDING:
    default:
      message = 'Giao dịch đang chờ thanh toán. Vui lòng quét mã VietQR hoặc chuyển khoản đúng nội dung.';
      break;
  }

  let responseQrCodeUrl = transaction.qrCodeUrl;
  if (transaction.status === TRANSACTION_STATUS.PARTIALLY_PAID && responseQrCodeUrl) {
    responseQrCodeUrl = responseQrCodeUrl.replace(/amount=\d+/, `amount=${remainingAmount}`);
  }

  return sendSuccess(res, {
    id: transaction.id,
    code: transaction.code,
    status: transaction.status,
    amount,
    paidAmount,
    overpaidAmount,
    remainingAmount,
    totalRefundedAmount,
    notes: transaction.notes,
    transferContent: transaction.transferContent,
    qrCodeUrl: responseQrCodeUrl,
    expiredAt: transaction.expiredAt,
    paidAt: transaction.paidAt,
    paymentAccount: transaction.paymentAccount,
    plan: transaction.plan,
    refunds: transaction.refunds || []
  }, message);
});

/**
 * Hủy giao dịch thanh toán (Client hoặc Admin)
 */
export const cancelTransaction = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const transaction = await validateCancelTransactionData(req.user, req.params);

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
  const { txId, paymentRef } = await validateApproveTransactionData(req.params, req.body);

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
 * Webhook xử lý thanh toán tự động chuyên biệt cho PayOS (Theo tài liệu chính thức docs.payos.vn)
 * Route công khai: POST /api/v1/payment-transactions/webhook
 */
export const handleWebhook = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body || {};
  // 1. Kiểm tra xác thực Webhook (Ưu tiên PayOS SDK verifyPaymentWebhookData)
  let verifiedData = body.data || body;
  const checksumKey = process.env.PAYOS_CHECKSUM_KEY;
  const webhookSecret = process.env.WEBHOOK_PAYOS_SECRET;

  if (checksumKey && body.signature) {
    try {
      if (typeof (payos as any).verifyPaymentWebhookData === 'function') {
        verifiedData = (payos as any).verifyPaymentWebhookData(body);
      } else if (typeof (payos as any).webhooks?.verify === 'function') {
        verifiedData = await (payos as any).webhooks.verify(body);
      }
    } catch (err: any) {
      const dataToVerify = (body.data && typeof body.data === 'object') ? body.data : body;
      const sortedKeys = Object.keys(dataToVerify).sort();
      const signData = sortedKeys
        .filter((key) => dataToVerify[key] !== undefined && dataToVerify[key] !== null)
        .map((key) => `${key}=${dataToVerify[key]}`)
        .join('&');

      const calculatedSignature = crypto
        .createHmac('sha256', checksumKey)
        .update(signData)
        .digest('hex');

      if (calculatedSignature !== body.signature) {
        throw new AppError('Chữ ký Webhook PayOS không hợp lệ', 401, 'UNAUTHORIZED');
      }
    }
  } else if (webhookSecret) {
    const authHeader = req.headers['authorization'] || req.headers['x-api-key'] || req.headers['x-payos-signature'];
    const token = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    const bearerToken = token?.replace(/^Bearer\s+/i, '');

    if (!token || (token !== webhookSecret && bearerToken !== webhookSecret)) {
      throw new AppError('Xác thực Webhook không hợp lệ', 401, 'UNAUTHORIZED');
    }
  }

  // 2. Kiểm tra trạng thái giao dịch PayOS (code == "00" hoặc success == true)
  if (body.code && body.code !== '00' && body.success === false) {
    return sendSuccess(res, { processed: false, reason: 'Giao dịch chưa thanh toán thành công' }, 'Webhook ghi nhận: Trạng thái giao dịch từ PayOS chưa hoàn tất');
  }

  // 3. Trích xuất dữ liệu từ Webhook Payload PayOS (mô hình lồng req.body.data)
  const data = (verifiedData && typeof verifiedData === 'object') ? verifiedData : (body.data || body);

  const description = String(data.description || '').trim();
  const orderCodeStr = data.orderCode !== undefined && data.orderCode !== null ? String(data.orderCode).trim() : '';

  // Tìm mã đơn dạng TRV... trong description hoặc dùng orderCode
  const matchedCode = description.match(/TRV[A-Z0-9]{6}/i)?.[0]?.toUpperCase() || orderCodeStr.toUpperCase();

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

  // Check Idempotency: Nếu đơn đã ở trạng thái completed hoặc overpaid từ trước
  if (transaction.status === TRANSACTION_STATUS.COMPLETED || transaction.status === TRANSACTION_STATUS.OVERPAID) {
    return sendSuccess(res, {
      transactionId: transaction.id,
      code: transaction.code,
      status: transaction.status,
      alreadyCompleted: true
    }, 'Webhook ghi nhận: Giao dịch đã hoàn tất từ trước');
  }

  // 4. Trích xuất thông tin giao dịch chuẩn từ data của PayOS
  const paymentRef = data.reference ? String(data.reference).trim() : null;
  const transferAmount = Number(data.amount || 0);

  const currentPaid = Number(transaction.paidAmount || 0);
  const totalPaidAfterThis = currentPaid + (transferAmount > 0 ? transferAmount : Number(transaction.amount));

  if (totalPaidAfterThis >= Number(transaction.amount)) {
    const { transaction: updatedTransaction, alreadyCompleted } = await fulfillPaymentTransaction({
      txId: transaction.id,
      paymentRef,
      approvalType: 'auto',
      approvedBy: null,
      paidAmount: totalPaidAfterThis
    });

    const message = alreadyCompleted
      ? 'Webhook ghi nhận: Giao dịch đã hoàn tất từ trước'
      : 'Xử lý webhook PayOS thành công. Đã kích hoạt gói dịch vụ';

    return sendSuccess(res, {
      transactionId: updatedTransaction.id,
      code: updatedTransaction.code,
      status: updatedTransaction.status,
      alreadyCompleted
    }, message);
  } else {
    const { transaction: updatedTransaction } = await processPartialPaymentTransaction({
      txId: transaction.id,
      incomingAmount: transferAmount,
      paymentRef,
      approvalType: 'auto',
      approvedBy: null
    });

    return sendSuccess(res, {
      transactionId: updatedTransaction.id,
      code: updatedTransaction.code,
      status: updatedTransaction.status,
      paidAmount: Number(updatedTransaction.paidAmount),
      remainingAmount: Math.max(0, Number(updatedTransaction.amount) - Number(updatedTransaction.paidAmount))
    }, `Webhook ghi nhận nạp thiếu: Đã nhận ${transferAmount.toLocaleString('vi-VN')} đ. Đang tích lũy.`);
  }
});


/**
 * Lấy danh sách tất cả các giao dịch thanh toán (Admin)
 */
export const getTransactions = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, status, refundStatus, search } = validateGetTransactionsQueryData(req.query);
  const skip = (page - 1) * limit;

  const whereClause: any = {};

  if (status && status !== 'all') {
    whereClause.status = status;
  }

  if (refundStatus && refundStatus !== 'all') {
    whereClause.refundStatus = refundStatus;
  }

  if (search && search.trim() !== '') {
    const keyword = search.trim();
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
            where: { endDate: { gte: getStartOfToday() } },
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
      },
      refunds: {
        include: {
          refundedByUser: { select: { id: true, name: true, email: true } }
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  const formattedItems = items.map(item => {
    const amount = Number(item.amount);
    const paidAmount = Number(item.paidAmount);
    const overpaidAmount = Math.max(0, paidAmount - amount);
    const remainingAmount = Math.max(0, amount - paidAmount);
    const totalRefundedAmount = (item.refunds || []).reduce((acc, r) => acc + Number(r.amount), 0);
    return {
      ...item,
      amount,
      paidAmount,
      overpaidAmount,
      remainingAmount,
      totalRefundedAmount
    };
  });

  const totalPages = Math.ceil(totalItems / limit);

  return sendSuccess(res, {
    items: formattedItems,
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

  const mappedTransactions = transactions.map((t) => {
    const amount = Number(t.amount);
    const paidAmount = Number(t.paidAmount);
    const remainingAmount = Math.max(0, amount - paidAmount);
    let qrCodeUrl = t.qrCodeUrl;
    if (t.status === TRANSACTION_STATUS.PARTIALLY_PAID && qrCodeUrl) {
      qrCodeUrl = qrCodeUrl.replace(/amount=\d+/, `amount=${remainingAmount}`);
    }
    return {
      ...t,
      amount,
      paidAmount,
      remainingAmount,
      qrCodeUrl,
    };
  });

  return sendSuccess(res, mappedTransactions, 'Lấy lịch sử giao dịch thành công');
});

/**
 * Tải file PDF Hóa đơn điện tử của giao dịch thanh toán (chuẩn mẫu TradeVerse)
 */
export const downloadInvoicePdf = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const transaction = await validateDownloadInvoicePdfData(req.user, req.params);

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




