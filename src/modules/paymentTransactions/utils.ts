import prisma from '../../config/db';
import { AppError } from '../../utils/appError';
import { TRANSACTION_STATUS, REFUND_STATUS } from './constants';
import { BILLING_CYCLES } from '../userSubscriptions/constants';
import { PAYMENT_METHOD_CODES } from '../paymentMethods/constants';
import { generateSubscriptionCode } from '../../utils/codeGenerator';
import type { ApprovalType } from '@prisma/client';

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

/**
 * Xử lý hoàn tất giao dịch thanh toán (duyệt đơn + kích hoạt/gia hạn UserSubscription)
 * Hàm này dùng chung cho cả Admin duyệt tay (approveTransaction) và Webhook tự động (handleWebhook).
 */
export const fulfillPaymentTransaction = async ({
  txId,
  code,
  paymentRef,
  approvalType = 'auto',
  approvedBy = null,
  paidAmount,
  notes
}: FulfillPaymentOptions) => {
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

  // Hủy các gói active cũ của User
  await prisma.userSubscription.updateMany({
    where: {
      userId: transaction.userId,
      status: 'active'
    },
    data: {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelReason: approvalType === 'auto'
        ? 'Nâng cấp gói mới qua Webhook tự động'
        : 'Nâng cấp gói mới qua VietQR (Admin duyệt)'
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
      status: 'active',
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
};

/**
 * Xử lý nạp tiền thiếu / nạp tích lũy nhiều lần (status -> partially_paid)
 */
export const processPartialPaymentTransaction = async ({
  txId,
  code,
  incomingAmount,
  paymentRef,
  approvalType = 'auto',
  approvedBy = null,
  notes
}: PartialPaymentOptions) => {
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
};
