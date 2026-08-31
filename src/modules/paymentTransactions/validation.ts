import prisma from '../../config/db';
import { AppError } from '../../utils/appError';
import { BILLING_CYCLES } from '../userSubscriptions/constants';
import { TRANSACTION_STATUS } from './constants';
import { getStartOfToday } from '../../utils/dateHelpers';
import {
  createTransactionSchema,
  getTransactionStatusSchema,
  cancelTransactionSchema,
  approveTransactionSchema,
  downloadInvoicePdfSchema,
  getTransactionsQuerySchema,
} from './zodSchemas';


/**
 * TẦNG 1 & TẦNG 2: Kiểm tra cú pháp (Zod) và Trạng thái DB cho khởi tạo đơn thanh toán
 */
export async function validateCreateTransactionData(userId: number, body: unknown) {
  // 1. TẦNG 1: Validate cú pháp (không được rỗng và dữ liệu truyền xuống phải đúng format) bằng Zod Schema
  const parseResult = createTransactionSchema.safeParse(body);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0] as any;
    const message = firstIssue?.message;
    const errorCode = firstIssue?.params?.errorCode;
    const statusCode = firstIssue?.params?.statusCode;
    throw new AppError(message, statusCode, errorCode);
  }

  const { planId, paymentMethod, billingCycle = BILLING_CYCLES.MONTHLY, expectedPrice } = parseResult.data;

  // 2. TẦNG 2: Kiểm tra Phương thức thanh toán trong DB
  const normalizedPaymentMethod = paymentMethod.trim().toUpperCase();
  const targetPaymentMethod = await prisma.paymentMethod.findUnique({
    where: { code: normalizedPaymentMethod },
  });

  if (!targetPaymentMethod) {
    throw new AppError(
      'Phương thức thanh toán bạn chọn chưa được hổ trợ. Vui lòng chọn phương thức khác.',
      400,
      'PAYMENT_METHOD_UNAVAILABLE'
    );
  }

  if (!targetPaymentMethod.isActive) {
    throw new AppError(
      'Phương thức thanh toán đã chọn hiện đang bảo trì. Vui lòng chọn phương thức khác.',
      400,
      'PAYMENT_METHOD_UNAVAILABLE'
    );
  }

  // 2. Kiểm tra Thông tin gói dịch vụ trong DB
  const plan = await prisma.membershipPlan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    throw new AppError(
      'Gói dịch vụ không tồn tại hoặc đã ngưng mở bán. Vui lòng chọn gói dịch vụ khác.',
      404,
      'PLAN_INACTIVE'
    );
  }

  if (!plan.isActive) {
    throw new AppError(
      'Gói dịch vụ này hiện đang tạm ngưng mở bán. Vui lòng chọn gói dịch vụ khác.',
      400,
      'PLAN_INACTIVE'
    );
  }

  // 3. Kiểm tra cấp độ gói người dùng hiện tại (nếu đang có gói active)
  const activeSub = await prisma.userSubscription.findFirst({
    where: { userId, endDate: { gte: getStartOfToday() } },
    include: { plan: true },
  });

  if (activeSub?.plan && plan.tierLevel <= activeSub.plan.tierLevel) {
    throw new AppError(
      'Bạn đang sở hữu gói dịch vụ này hoặc gói cao hơn. Không thể đăng ký gói cùng cấp hoặc cấp thấp hơn.',
      400,
      'VALIDATION_ERROR'
    );
  }

  // 4. Tìm tài khoản ngân hàng nhận tiền mặc định của hệ thống
  const paymentAccount = await prisma.paymentAccount.findFirst({
    where: {
      isDefault: true,
      bank: { isActive: true },
    },
    include: { bank: true },
  });

  if (!paymentAccount || !paymentAccount.bank || !paymentAccount.bank.isActive) {
    throw new AppError(
      'Hệ thống nhận tiền hiện đang bảo trì. Vui lòng thử lại sau hoặc liên hệ bộ phận hỗ trợ.',
      400,
      'PAYMENT_METHOD_UNAVAILABLE'
    );
  }

  // 5. Tính số tiền thanh toán & kiểm tra chống sửa giá (Anti-tamper)
  const amount = billingCycle === BILLING_CYCLES.YEARLY ? plan.yearlyPrice : plan.monthlyPrice;

  if (expectedPrice !== undefined && expectedPrice !== null) {
    const numericExpectedPrice = Number(expectedPrice);
    const numericServerAmount = Number(amount);
    if (numericExpectedPrice !== numericServerAmount) {
      throw new AppError(
        'Thông tin giá của gói dịch vụ vừa được cập nhật. Vui lòng kiểm tra lại đơn hàng.',
        400,
        'PLAN_PRICE_CHANGED'
      );
    }
  }

  return {
    plan,
    targetPaymentMethod,
    paymentAccount,
    amount,
    billingCycle,
  };
}

/**
 * TẦNG 1 & TẦNG 2: Kiểm tra cú pháp (Zod) và Trạng thái DB cho lấy trạng thái giao dịch
 */
export async function validateGetTransactionStatusData(params: unknown) {
  // 1. TẦNG 1: Validate cú pháp (tham số code không được rỗng) bằng Zod Schema
  const parseResult = getTransactionStatusSchema.safeParse(params);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0] as any;
    const message = firstIssue?.message || 'Mã giao dịch không hợp lệ';
    const errorCode = firstIssue?.params?.errorCode || 'VALIDATION_ERROR';
    const statusCode = firstIssue?.params?.statusCode || 400;
    throw new AppError(message, statusCode, errorCode);
  }

  const { code } = parseResult.data;

  // 2. TẦNG 2: Kiểm tra sự tồn tại của Giao dịch trong DB
  const transaction = await prisma.paymentTransaction.findUnique({
    where: { code: code.trim() },
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

  if (!transaction) {
    throw new AppError('Không tìm thấy thông tin giao dịch', 404, 'NOT_FOUND');
  }

  return transaction;
}

/**
 * TẦNG 1 & TẦNG 2: Kiểm tra cú pháp và Quyền/DB cho Hủy giao dịch
 */
export async function validateCancelTransactionData(
  user: { id: number; role: string } | undefined,
  params: unknown
) {
  const parseResult = cancelTransactionSchema.safeParse(params);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0] as any;
    throw new AppError(
      firstIssue?.message || 'Mã giao dịch không hợp lệ',
      firstIssue?.params?.statusCode || 400,
      firstIssue?.params?.errorCode || 'VALIDATION_ERROR'
    );
  }

  const { code } = parseResult.data;

  const transaction = await prisma.paymentTransaction.findUnique({
    where: { code: code.trim() },
  });

  if (!transaction) {
    throw new AppError('Không tìm thấy giao dịch', 404, 'NOT_FOUND');
  }

  if (user?.role !== 'admin' && transaction.userId !== user?.id) {
    throw new AppError('Bạn không có quyền thao tác trên giao dịch này', 403, 'FORBIDDEN');
  }

  if (
    transaction.status !== TRANSACTION_STATUS.PENDING &&
    transaction.status !== TRANSACTION_STATUS.PARTIALLY_PAID
  ) {
    throw new AppError('Chỉ có thể hủy giao dịch đang ở trạng thái chờ hoặc đã thanh toán một phần', 400, 'VALIDATION_ERROR');
  }

  return transaction;
}

/**
 * TẦNG 1 & TẦNG 2: Kiểm tra cú pháp và DB cho Duyệt giao dịch thủ công (Admin)
 */
export async function validateApproveTransactionData(params: unknown, body: unknown) {
  const parseParams = approveTransactionSchema.safeParse({ ...(params as object), ...(body as object) });
  if (!parseParams.success) {
    const firstIssue = parseParams.error.issues[0] as any;
    throw new AppError(
      firstIssue?.message || 'Mã giao dịch không hợp lệ',
      firstIssue?.params?.statusCode || 400,
      firstIssue?.params?.errorCode || 'VALIDATION_ERROR'
    );
  }

  const { id: txId, paymentRef } = parseParams.data;

  const transaction = await prisma.paymentTransaction.findUnique({
    where: { id: txId },
  });

  if (!transaction) {
    throw new AppError('Không tìm thấy giao dịch', 404, 'NOT_FOUND');
  }

  return { txId, paymentRef, transaction };
}

/**
 * TẦNG 1 & TẦNG 2: Kiểm tra cú pháp và Quyền/DB cho Tải hóa đơn PDF
 */
export async function validateDownloadInvoicePdfData(
  user: { id: number; role: string } | undefined,
  params: unknown
) {
  const parseResult = downloadInvoicePdfSchema.safeParse(params);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0] as any;
    throw new AppError(
      firstIssue?.message || 'Mã giao dịch không hợp lệ',
      firstIssue?.params?.statusCode || 400,
      firstIssue?.params?.errorCode || 'VALIDATION_ERROR'
    );
  }

  const { code } = parseResult.data;

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

  if (user?.role !== 'admin' && transaction.userId !== user?.id) {
    throw new AppError('Bạn không có quyền truy cập hóa đơn của giao dịch này', 403, 'FORBIDDEN');
  }

  if (transaction.status !== TRANSACTION_STATUS.COMPLETED && transaction.status !== TRANSACTION_STATUS.OVERPAID) {
    throw new AppError('Chỉ có thể tải hóa đơn đối với giao dịch đã hoàn tất', 400, 'VALIDATION_ERROR');
  }

  return transaction;
}

/**
 * TẦNG 1: Validate Query params cho Danh sách giao dịch
 */
export function validateGetTransactionsQueryData(query: unknown) {
  const parseResult = getTransactionsQuerySchema.safeParse(query);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0] as any;
    throw new AppError(
      firstIssue?.message || 'Tham số truy vấn không hợp lệ',
      firstIssue?.params?.statusCode || 400,
      firstIssue?.params?.errorCode || 'VALIDATION_ERROR'
    );
  }

  return parseResult.data;
}



