/**
 * HẰNG SỐ VÀ MAPPING CHO MODULE PAYMENT REFUNDS
 */
export const REFUND_CODE_PREFIX = 'RFD-';

export const REFUND_STATUS = {
  PARTIALLY_REFUNDED: 'partially_refunded',
  FULLY_REFUNDED: 'fully_refunded',
} as const;

export type RefundStatus = typeof REFUND_STATUS[keyof typeof REFUND_STATUS];

