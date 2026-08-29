/**
 * HẰNG SỐ VÀ MAPPING CHO CHU KỲ TÍNH PHÍ GÓI DỊCH VỤ / HỘI VIÊN (BILLING CYCLES)
 */
export const BILLING_CYCLES = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
} as const;

export type BillingCycle = typeof BILLING_CYCLES[keyof typeof BILLING_CYCLES];
