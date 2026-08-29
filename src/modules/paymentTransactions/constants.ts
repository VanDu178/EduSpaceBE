/**
 * HẰNG SỐ VÀ MAPPING CHO TRẠNG THÁI GIAO DỊCH THANH TOÁN (PAYMENT TRANSACTION STATUS)
 */
export const TRANSACTION_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
} as const;

export type TransactionStatus = typeof TRANSACTION_STATUS[keyof typeof TRANSACTION_STATUS];
