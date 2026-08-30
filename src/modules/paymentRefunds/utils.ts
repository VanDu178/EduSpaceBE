import prisma from '../../config/db';
import { AppError } from '../../utils/appError';

export interface CreateRefundOptions {
  paymentTxId: number;
  amount: number;
  refundRef?: string | null;
  proofUrls?: string[] | null;
  notes?: string | null;
  refundedBy?: number | null;
}

/**
 * CSKH / Admin tạo phiếu hoàn tiền cho đơn nạp dư (lưu vào bảng PaymentRefund)
 */
export const createPaymentRefund = async ({
  paymentTxId,
  amount,
  refundRef,
  proofUrls,
  notes,
  refundedBy
}: CreateRefundOptions) => {
  const transaction = await prisma.paymentTransaction.findUnique({
    where: { id: paymentTxId },
    include: { refunds: true, plan: true, user: true }
  });

  if (!transaction) {
    throw new AppError('Giao dịch thanh toán không tồn tại', 404, 'NOT_FOUND');
  }

  const orderAmount = Number(transaction.amount);
  const paidAmount = Number(transaction.paidAmount);
  const overpaidAmount = Math.max(0, paidAmount - orderAmount);

  if (overpaidAmount <= 0) {
    throw new AppError('Giao dịch này không nạp thừa tiền để thực hiện hoàn tiền.', 400, 'VALIDATION_ERROR');
  }

  const totalAlreadyRefunded = transaction.refunds.reduce((sum, r) => sum + Number(r.amount), 0);
  const remainingRefundable = overpaidAmount - totalAlreadyRefunded;

  if (amount <= 0) {
    throw new AppError('Số tiền hoàn phải lớn hơn 0', 400, 'VALIDATION_ERROR');
  }

  if (amount > remainingRefundable) {
    throw new AppError(
      `Số tiền hoàn (${amount.toLocaleString('vi-VN')} đ) vượt quá số tiền nạp dư còn lại có thể hoàn (${remainingRefundable.toLocaleString('vi-VN')} đ).`,
      400,
      'VALIDATION_ERROR'
    );
  }

  const refundCode = `RFD-${transaction.code}-${Date.now().toString().slice(-4)}`;

  const refund = await prisma.paymentRefund.create({
    data: {
      code: refundCode,
      paymentTxId: transaction.id,
      amount,
      refundRef: refundRef ? String(refundRef).trim() : null,
      proofUrls: proofUrls && proofUrls.length > 0 ? (proofUrls as any) : undefined,
      notes: notes ? String(notes).trim() : null,
      refundedBy: refundedBy || null
    },
    include: {
      refundedByUser: {
        select: { id: true, code: true, email: true, name: true }
      }
    }
  });

  // Tự động tính toán và cập nhật refundStatus cho PaymentTransaction
  const newTotalRefunded = totalAlreadyRefunded + amount;
  const newRefundStatus = newTotalRefunded >= overpaidAmount ? 'fully_refunded' : 'partially_refunded';

  await prisma.paymentTransaction.update({
    where: { id: transaction.id },
    data: { refundStatus: newRefundStatus }
  });

  // Re-fetch updated transaction with refunds
  const updatedTransaction = await prisma.paymentTransaction.findUnique({
    where: { id: transaction.id },
    include: {
      plan: true,
      user: {
        select: { id: true, code: true, email: true, name: true, avatarUrl: true }
      },
      refunds: {
        include: {
          refundedByUser: {
            select: { id: true, code: true, email: true, name: true }
          }
        }
      }
    }
  });

  return {
    refund,
    transaction: updatedTransaction
  };
};

export interface UpdateRefundOptions {
  refundId: number;
  amount?: number;
  refundRef?: string | null;
  proofUrls?: string[] | null;
  notes?: string | null;
  refundedBy?: number | null;
}

/**
 * CSKH / Admin cập nhật phiếu hoàn tiền (sửa mã GD, ảnh minh chứng, ghi chú...)
 * Tự động xóa các ảnh cũ không còn dùng khỏi Supabase Storage để chống rác ảnh.
 */
export const updatePaymentRefund = async ({
  refundId,
  amount,
  refundRef,
  proofUrls,
  notes,
  refundedBy
}: UpdateRefundOptions) => {
  const existingRefund = await prisma.paymentRefund.findUnique({
    where: { id: refundId },
    include: {
      paymentTransaction: {
        include: { refunds: true, plan: true, user: true }
      }
    }
  });

  if (!existingRefund) {
    throw new AppError('Phiếu hoàn tiền không tồn tại', 404, 'NOT_FOUND');
  }

  const transaction = existingRefund.paymentTransaction;
  const orderAmount = Number(transaction.amount);
  const paidAmount = Number(transaction.paidAmount);
  const overpaidAmount = Math.max(0, paidAmount - orderAmount);

  // Tính toán hạn mức nếu có cập nhật số tiền
  const otherRefundsTotal = transaction.refunds
    .filter(r => r.id !== refundId)
    .reduce((sum, r) => sum + Number(r.amount), 0);

  const targetAmount = amount !== undefined ? Number(amount) : Number(existingRefund.amount);
  const remainingRefundable = overpaidAmount - otherRefundsTotal;

  if (targetAmount <= 0) {
    throw new AppError('Số tiền hoàn phải lớn hơn 0', 400, 'VALIDATION_ERROR');
  }

  if (targetAmount > remainingRefundable) {
    throw new AppError(
      `Số tiền hoàn (${targetAmount.toLocaleString('vi-VN')} đ) vượt quá giới hạn nạp dư còn lại (${remainingRefundable.toLocaleString('vi-VN')} đ).`,
      400,
      'VALIDATION_ERROR'
    );
  }

  // Tự động tìm và xóa các ảnh cũ không còn nằm trong danh sách proofUrls mới
  const oldProofUrls = (existingRefund.proofUrls as string[]) || [];
  const newProofUrls = proofUrls || [];

  const removedUrls = oldProofUrls.filter(url => !newProofUrls.includes(url));
  if (removedUrls.length > 0) {
    const { extractStoragePath, deleteFromSupabase } = await import('../../utils/supabaseStorage');
    for (const url of removedUrls) {
      const storagePath = extractStoragePath(url);
      if (storagePath) {
        await deleteFromSupabase(storagePath).catch(err => {
          console.error(`Lỗi khi dọn dẹp ảnh rác trên Supabase (${url}):`, err);
        });
      }
    }
  }

  // Cập nhật phiếu hoàn tiền
  const updatedRefund = await prisma.paymentRefund.update({
    where: { id: refundId },
    data: {
      amount: targetAmount,
      refundRef: refundRef !== undefined ? (refundRef ? String(refundRef).trim() : null) : undefined,
      proofUrls: proofUrls ? (proofUrls as any) : undefined,
      notes: notes !== undefined ? (notes ? String(notes).trim() : null) : undefined,
      refundedBy: refundedBy || undefined
    },
    include: {
      refundedByUser: {
        select: { id: true, code: true, email: true, name: true }
      }
    }
  });

  // Tự động tính toán lại refundStatus cho PaymentTransaction
  const newTotalRefunded = otherRefundsTotal + targetAmount;
  const newRefundStatus = newTotalRefunded >= overpaidAmount ? 'fully_refunded' : 'partially_refunded';

  await prisma.paymentTransaction.update({
    where: { id: transaction.id },
    data: { refundStatus: newRefundStatus }
  });

  const updatedTransaction = await prisma.paymentTransaction.findUnique({
    where: { id: transaction.id },
    include: {
      plan: true,
      user: {
        select: { id: true, code: true, email: true, name: true, avatarUrl: true }
      },
      refunds: {
        include: {
          refundedByUser: {
            select: { id: true, code: true, email: true, name: true }
          }
        }
      }
    }
  });

  return {
    refund: updatedRefund,
    transaction: updatedTransaction
  };
};

