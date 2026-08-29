import prisma from '../config/db';
import { AppError } from '../utils/appError';
import { TRANSACTION_STATUS } from '../constants/transactionConstants';
import { BILLING_CYCLES } from '../constants/subscriptionConstants';
import { PAYMENT_METHOD_CODES } from '../constants/paymentMethodCodes';
import { generateSubscriptionCode } from '../utils/codeGenerator';
import type { ApprovalType } from '@prisma/client';

interface FulfillPaymentOptions {
  txId?: number;
  code?: string;
  paymentRef?: string | null;
  approvalType?: ApprovalType; // 'auto' | 'manual'
  approvedBy?: number | null;
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
  approvedBy = null
}: FulfillPaymentOptions) => {
  if (!txId && !code) {
    throw new AppError('Thiếu thông tin nhận diện giao dịch (ID hoặc Code)', 400, 'VALIDATION_ERROR');
  }

  // 1. Tìm bản ghi PaymentTransaction
  const whereClause = txId ? { id: txId } : { code: code!.trim() };
  const transaction = await prisma.paymentTransaction.findUnique({
    where: whereClause,
    include: { plan: true }
  });

  if (!transaction) {
    throw new AppError('Giao dịch thanh toán không tồn tại', 404, 'NOT_FOUND');
  }

  // 2. Tính Idempotency: Nếu đơn đã hoàn thành trước đó thì trả về ngay
  if (transaction.status === TRANSACTION_STATUS.COMPLETED) {
    return {
      transaction,
      alreadyCompleted: true
    };
  }

  // Kiểm tra nếu người dùng đã sở hữu gói dịch vụ tương đương hoặc cao hơn
  const activeSub = await prisma.userSubscription.findFirst({
    where: {
      userId: transaction.userId,
      status: 'active'
    },
    include: { plan: true }
  });

  if (activeSub && activeSub.plan && transaction.plan) {
    if (activeSub.plan.tierLevel >= transaction.plan.tierLevel) {
      throw new AppError(
        'Khách hàng đã sở hữu gói dịch vụ tương đương hoặc cao hơn. Không thể duyệt đơn này.',
        400,
        'VALIDATION_ERROR'
      );
    }
  }

  // 3. Cập nhật trạng thái PaymentTransaction sang COMPLETED
  const updatedTransaction = await prisma.paymentTransaction.update({
    where: { id: transaction.id },
    data: {
      status: TRANSACTION_STATUS.COMPLETED,
      approvalType,
      approvedBy: approvedBy || null,
      paidAt: new Date(),
      paymentRef: paymentRef ? String(paymentRef).trim() : null
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
      }
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
      paymentRef: updatedTransaction.paymentRef
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
