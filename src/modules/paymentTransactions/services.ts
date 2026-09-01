import crypto from 'crypto';
import type { ApprovalType } from '@prisma/client';
import prisma from '../../config/db';
import { AppError } from '../../utils/appError';
import { TRANSACTION_STATUS, REFUND_STATUS } from './constants';
import { BILLING_CYCLES } from '../userSubscriptions/constants';
import { PAYMENT_METHOD_CODES } from '../paymentMethods/constants';
import { generateSubscriptionCode } from '../userSubscriptions/utils';
import { generatePaymentTransactionCode } from './utils';
import { getStartOfToday, getYesterdayEndOfDay } from '../../utils/dateHelpers';
import { payos } from '../../config/payos';
import type { GetTransactionsQueryInput } from './zodSchemas';

export interface FulfillPaymentOptions {
  txId?: number;
  code?: string;
  paymentRef?: string | null;
  approvalType?: ApprovalType; // 'auto' | 'manual'
  approvedBy?: number | null;
  paidAmount?: number;
  notes?: string;
}

export interface PartialPaymentOptions {
  txId?: number;
  code?: string;
  incomingAmount: number;
  paymentRef?: string | null;
  approvalType?: ApprovalType;
  approvedBy?: number | null;
  notes?: string;
}

/* ============================================================================
 * MAIN MODULE SERVICES (Sắp xếp khớp 1-1 theo thứ tự trong controller.ts)
 * ============================================================================ */

/**
 * 1. Service: Khởi tạo đơn thanh toán VietQR
 */
export const createTransactionService = async (
  userId: number,
  validatedData: {
    plan: any;
    targetPaymentMethod: any;
    paymentAccount: any;
    amount: any;
    billingCycle: string;
  }
) => {
  const { plan, targetPaymentMethod, paymentAccount, amount, billingCycle } = validatedData;

  // Sinh mã đơn ngẫu nhiên duy nhất
  let code = generatePaymentTransactionCode();
  let isCodeExist = await prisma.paymentTransaction.findUnique({ where: { code } });
  while (isCodeExist) {
    code = generatePaymentTransactionCode();
    isCodeExist = await prisma.paymentTransaction.findUnique({ where: { code } });
  }

  const transferContent = code;

  // Chuẩn bị URL mã VietQR mặc định
  const defaultVietQrUrl = `https://img.vietqr.io/image/${paymentAccount.bankCode}-${paymentAccount.accountNo}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(paymentAccount.accountHolder)}`;
  let qrCodeUrl = defaultVietQrUrl;
  let createdOrderCode: string | null = null;

  // Ưu tiên gọi PayOS API để tạo mã VietQR động
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

  const expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

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
        select: { id: true, code: true, name: true }
      },
      paymentAccount: {
        include: { bank: true }
      }
    }
  });

  return transaction;
};

/**
 * 2. Service: Lấy trạng thái giao dịch & Live Sync với PayOS API
 */
export const getTransactionStatusService = async (initialTransaction: any) => {
  let transaction = initialTransaction;

  // 1. Tự động cập nhật hết hạn nếu quá 24h mà vẫn PENDING
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

  // 2. Logic Real-time Live Sync với PayOS API
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
            const { transaction: fulfilledTx } = await fulfillPaymentTransaction({
              txId: transaction.id,
              paidAmount: payosAmountPaid,
              approvalType: 'auto',
              notes: 'Duyệt & kích hoạt gói tức thì qua PayOS Live Sync API'
            });
            transaction = fulfilledTx as any;
          } else if (payosAmountPaid > Number(transaction.paidAmount || 0)) {
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
  const totalRefundedAmount = (transaction.refunds || []).reduce((acc: number, r: any) => acc + Number(r.amount), 0);

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

  return {
    data: {
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
    },
    message
  };
};

/**
 * 3. Service: Hủy giao dịch thanh toán
 */
export const cancelTransactionService = async (transactionId: number) => {
  const updated = await prisma.paymentTransaction.update({
    where: { id: transactionId },
    data: { status: TRANSACTION_STATUS.CANCELLED }
  });
  return updated;
};

/**
 * 4. Service: Duyệt thanh toán thành công thủ công (Admin)
 */
export const approveTransactionService = async (
  validatedData: { txId: number; paymentRef?: string },
  adminUserId?: number
) => {
  const { txId, paymentRef } = validatedData;

  const { transaction, alreadyCompleted } = await fulfillPaymentTransaction({
    txId,
    paymentRef,
    approvalType: 'manual',
    approvedBy: adminUserId
  });

  const message = alreadyCompleted
    ? 'Giao dịch đã được duyệt trước đó'
    : 'Duyệt thanh toán và kích hoạt gói thành công';

  return { transaction, message };
};

/**
 * 5. Service: Xử lý Webhook PayOS tự động
 */
export const handlePayOSWebhookService = async (body: any, headers: any) => {
  const checksumKey = process.env.PAYOS_CHECKSUM_KEY;
  const webhookSecret = process.env.WEBHOOK_PAYOS_SECRET;
  let verifiedData = body?.data || body;

  if (checksumKey && body?.signature) {
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
    const authHeader = headers['authorization'] || headers['x-api-key'] || headers['x-payos-signature'];
    const token = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    const bearerToken = token?.replace(/^Bearer\s+/i, '');

    if (!token || (token !== webhookSecret && bearerToken !== webhookSecret)) {
      throw new AppError('Xác thực Webhook không hợp lệ', 401, 'UNAUTHORIZED');
    }
  }

  if (body.code && body.code !== '00' && body.success === false) {
    return {
      result: { processed: false, reason: 'Giao dịch chưa thanh toán thành công' },
      message: 'Webhook ghi nhận: Trạng thái giao dịch từ PayOS chưa hoàn tất'
    };
  }

  const data = (verifiedData && typeof verifiedData === 'object') ? verifiedData : (body.data || body);
  const description = String(data.description || '').trim();
  const orderCodeStr = data.orderCode !== undefined && data.orderCode !== null ? String(data.orderCode).trim() : '';

  const matchedCode = description.match(/TRV[A-Z0-9]{6}/i)?.[0]?.toUpperCase() || orderCodeStr.toUpperCase();

  if (!matchedCode) {
    return {
      result: { processed: false },
      message: 'Nội dung chuyển khoản không chứa mã giao dịch hợp lệ'
    };
  }

  const transaction = await prisma.paymentTransaction.findFirst({
    where: {
      OR: [
        { code: matchedCode },
        { transferContent: matchedCode }
      ]
    }
  });

  if (!transaction) {
    return {
      result: { processed: false, code: matchedCode },
      message: 'Không tìm thấy giao dịch tương ứng trên hệ thống'
    };
  }

  if (transaction.status === TRANSACTION_STATUS.COMPLETED || transaction.status === TRANSACTION_STATUS.OVERPAID) {
    return {
      result: {
        transactionId: transaction.id,
        code: transaction.code,
        status: transaction.status,
        alreadyCompleted: true
      },
      message: 'Webhook ghi nhận: Giao dịch đã hoàn tất từ trước'
    };
  }

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

    return {
      result: {
        transactionId: updatedTransaction.id,
        code: updatedTransaction.code,
        status: updatedTransaction.status,
        alreadyCompleted
      },
      message
    };
  } else {
    const { transaction: updatedTransaction } = await processPartialPaymentTransaction({
      txId: transaction.id,
      incomingAmount: transferAmount,
      paymentRef,
      approvalType: 'auto',
      approvedBy: null
    });

    return {
      result: {
        transactionId: updatedTransaction.id,
        code: updatedTransaction.code,
        status: updatedTransaction.status,
        paidAmount: Number(updatedTransaction.paidAmount),
        remainingAmount: Math.max(0, Number(updatedTransaction.amount) - Number(updatedTransaction.paidAmount))
      },
      message: `Webhook ghi nhận nạp thiếu: Đã nhận ${transferAmount.toLocaleString('vi-VN')} đ. Đang tích lũy.`
    };
  }
};

/**
 * 6. Service: Lấy danh sách tất cả các giao dịch thanh toán (Admin)
 */
export const getTransactionsService = async (queryData: GetTransactionsQueryInput) => {
  const { page, limit, status, refundStatus, search } = queryData;
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

  const formattedItems = items.map((item) => {
    const amount = Number(item.amount);
    const paidAmount = Number(item.paidAmount);
    const overpaidAmount = Math.max(0, paidAmount - amount);
    const remainingAmount = Math.max(0, amount - paidAmount);
    const totalRefundedAmount = (item.refunds || []).reduce((acc: number, r: any) => acc + Number(r.amount), 0);
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

  return {
    items: formattedItems,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems,
      itemsPerPage: limit
    }
  };
};

/**
 * 7. Service: Lấy lịch sử giao dịch thanh toán của User hiện tại
 */
export const getMyTransactionsService = async (userId: number) => {
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

  return mappedTransactions;
};

/* ============================================================================
 * HELPER SERVICES (Các hàm bổ trợ nghiệp vụ nội bộ)
 * ============================================================================ */

/**
 * Xử lý hoàn tất giao dịch thanh toán (duyệt đơn + kích hoạt/gia hạn UserSubscription)
 * Dùng chung cho cả Admin duyệt tay (approveTransaction) và Webhook tự động (handleWebhook).
 */
export async function fulfillPaymentTransaction({
  txId,
  code,
  paymentRef,
  approvalType = 'auto',
  approvedBy = null,
  paidAmount,
  notes
}: FulfillPaymentOptions) {
  if (!txId && !code) {
    throw new AppError('Thiếu thông tin nhận diện giao dịch (ID hoặc Code)', 400, 'VALIDATION_ERROR');
  }

  // 1. Tìm bản ghi PaymentTransaction
  const whereClause = txId ? { id: txId } : { code: code!.trim() };
  const transaction = await prisma.paymentTransaction.findUnique({
    where: whereClause,
    include: { plan: true, refunds: true }
  });

  if (!transaction) {
    throw new AppError('Giao dịch thanh toán không tồn tại', 404, 'NOT_FOUND');
  }

  // 2. Tính Idempotency: Nếu đơn đã hoàn thành trước đó (completed hoặc overpaid) thì trả về ngay
  if (transaction.status === TRANSACTION_STATUS.COMPLETED || transaction.status === TRANSACTION_STATUS.OVERPAID) {
    return {
      transaction,
      alreadyCompleted: true
    };
  }

  // Nếu đơn hàng đã EXPIRED hoặc CANCELLED hoặc quá thời gian expiredAt
  const isTxExpired = transaction.status === TRANSACTION_STATUS.EXPIRED || Boolean(transaction.expiredAt && new Date(transaction.expiredAt) < new Date());
  if (isTxExpired || transaction.status === TRANSACTION_STATUS.CANCELLED) {
    if (approvalType === 'manual') {
      throw new AppError('Giao dịch đã hết thời hạn thanh toán hoặc bị hủy. Không thể duyệt!', 400, 'TRANSACTION_EXPIRED');
    }
    return {
      transaction,
      alreadyCompleted: true,
      blockedReason: 'EXPIRED_OR_CANCELLED'
    };
  }

  // Tính số tiền đã nạp thực tế
  const actualPaidAmount = paidAmount !== undefined
    ? paidAmount
    : (Number(transaction.paidAmount) > 0 ? Number(transaction.paidAmount) : Number(transaction.amount));

  // Kiểm tra nếu nạp thừa tiền -> Trạng thái OVERPAID, ngược lại COMPLETED
  const isOverpaid = actualPaidAmount > Number(transaction.amount);
  const targetStatus = isOverpaid ? TRANSACTION_STATUS.OVERPAID : TRANSACTION_STATUS.COMPLETED;
  const targetRefundStatus = isOverpaid ? REFUND_STATUS.UNREFUNDED : REFUND_STATUS.NONE;

  // 3. Cập nhật trạng thái PaymentTransaction sang COMPLETED hoặc OVERPAID
  const updatedTransaction = await prisma.paymentTransaction.update({
    where: { id: transaction.id },
    data: {
      status: targetStatus,
      refundStatus: targetRefundStatus,
      paidAmount: actualPaidAmount,
      approvalType,
      approvedBy: approvedBy || null,
      paidAt: new Date(),
      paymentRef: paymentRef ? String(paymentRef).trim() : transaction.paymentRef,
      notes: notes || transaction.notes
    },
    include: {
      plan: {
        select: { id: true, code: true, name: true }
      },
      user: {
        select: { id: true, code: true, email: true, name: true, avatarUrl: true }
      },
      approvedByUser: {
        select: { id: true, code: true, email: true, name: true, avatarUrl: true }
      },
      refunds: true
    }
  });

  // 4. Tính toán thời hạn gói UserSubscription
  const startDate = new Date();
  const endDate = new Date(startDate);
  if (transaction.billingCycle === BILLING_CYCLES.YEARLY) {
    endDate.setFullYear(endDate.getFullYear() + 1);
  } else {
    endDate.setMonth(endDate.getMonth() + 1);
  }

  // Tự động kết thúc thời hạn (chuyển endDate về ngày hôm qua) cho các gói cũ còn hạn của User
  await prisma.userSubscription.updateMany({
    where: {
      userId: transaction.userId,
      endDate: { gte: getStartOfToday() }
    },
    data: {
      endDate: getYesterdayEndOfDay()
    }
  });

  // Tạo mới UserSubscription active
  const tempSub = await prisma.userSubscription.create({
    data: {
      code: `SUB-TEMP-${Date.now()}`,
      userId: transaction.userId,
      planId: transaction.planId,
      billingCycle: transaction.billingCycle,
      startDate,
      endDate,
      pricePaid: transaction.amount,
      paymentMethod: transaction.paymentMethod || PAYMENT_METHOD_CODES.VIETQR,
      paymentRef: updatedTransaction.paymentRef,
      createdType: 'system'
    }
  });

  const subCode = generateSubscriptionCode(tempSub.id);
  await prisma.userSubscription.update({
    where: { id: tempSub.id },
    data: { code: subCode }
  });

  return {
    transaction: updatedTransaction,
    alreadyCompleted: false
  };
}

/**
 * Xử lý nạp tiền thiếu / nạp tích lũy nhiều lần (status -> partially_paid)
 */
export async function processPartialPaymentTransaction({
  txId,
  code,
  incomingAmount,
  paymentRef,
  approvalType = 'auto',
  approvedBy = null,
  notes
}: PartialPaymentOptions) {
  if (!txId && !code) {
    throw new AppError('Thiếu thông tin nhận diện giao dịch (ID hoặc Code)', 400, 'VALIDATION_ERROR');
  }

  const whereClause = txId ? { id: txId } : { code: code!.trim() };
  const transaction = await prisma.paymentTransaction.findUnique({
    where: whereClause,
    include: { plan: true }
  });

  if (!transaction) {
    throw new AppError('Giao dịch thanh toán không tồn tại', 404, 'NOT_FOUND');
  }

  if (transaction.status === TRANSACTION_STATUS.COMPLETED || transaction.status === TRANSACTION_STATUS.OVERPAID) {
    return {
      transaction,
      alreadyCompleted: true,
      status: transaction.status
    };
  }

  // Nếu đơn đã EXPIRED hoặc CANCELLED -> Giữ nguyên không xử lý
  if (transaction.status === TRANSACTION_STATUS.EXPIRED || transaction.status === TRANSACTION_STATUS.CANCELLED) {
    return {
      transaction,
      alreadyCompleted: true,
      status: transaction.status
    };
  }

  const currentPaidAmount = Number(transaction.paidAmount || 0);
  const newPaidAmount = currentPaidAmount + incomingAmount;
  const orderAmount = Number(transaction.amount);

  // Nếu tích lũy đủ hoặc thừa tiền -> Kích hoạt gói thành công!
  if (newPaidAmount >= orderAmount) {
    return await fulfillPaymentTransaction({
      txId: transaction.id,
      paymentRef,
      approvalType,
      approvedBy,
      paidAmount: newPaidAmount,
      notes
    });
  }

  // Nếu vẫn thiếu tiền -> Cập nhật trạng thái partially_paid
  const logMessage = `[${new Date().toLocaleString('vi-VN')}] Nhận ${incomingAmount.toLocaleString('vi-VN')} đ. Đã nạp ${newPaidAmount.toLocaleString('vi-VN')}/${orderAmount.toLocaleString('vi-VN')} đ.`;
  const updatedNotes = notes || (transaction.notes ? `${transaction.notes}\n${logMessage}` : logMessage);

  const updatedTransaction = await prisma.paymentTransaction.update({
    where: { id: transaction.id },
    data: {
      status: TRANSACTION_STATUS.PARTIALLY_PAID,
      paidAmount: newPaidAmount,
      paymentRef: paymentRef ? String(paymentRef).trim() : transaction.paymentRef,
      notes: updatedNotes
    },
    include: {
      plan: {
        select: { id: true, code: true, name: true }
      },
      user: {
        select: { id: true, code: true, email: true, name: true, avatarUrl: true }
      },
      refunds: true
    }
  });

  return {
    transaction: updatedTransaction,
    alreadyCompleted: false,
    status: TRANSACTION_STATUS.PARTIALLY_PAID
  };
}
