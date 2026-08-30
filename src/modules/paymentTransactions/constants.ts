/**
 * HẰNG SỐ VÀ MAPPING CHO TRẠNG THÁI GIAO DỊCH THANH TOÁN (PAYMENT TRANSACTION STATUS)
 */
export const TRANSACTION_STATUS = {
  PENDING: 'pending',
  PARTIALLY_PAID: 'partially_paid',
  COMPLETED: 'completed',
  OVERPAID: 'overpaid',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
} as const;

export type TransactionStatus = typeof TRANSACTION_STATUS[keyof typeof TRANSACTION_STATUS];

export const REFUND_STATUS = {
  NONE: 'none',
  UNREFUNDED: 'unrefunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
  FULLY_REFUNDED: 'fully_refunded',
} as const;

export type RefundStatus = typeof REFUND_STATUS[keyof typeof REFUND_STATUS];

