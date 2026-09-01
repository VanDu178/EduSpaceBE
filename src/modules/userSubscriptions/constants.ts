/**
 * HẰNG SỐ VÀ MAPPING CHO CHU KỲ TÍNH PHÍ GÓI DỊCH VỤ / HỘI VIÊN (BILLING CYCLES)
 */
export const BILLING_CYCLES = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
} as const;

export type BillingCycle = typeof BILLING_CYCLES[keyof typeof BILLING_CYCLES];

export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
} as const;

export type SubscriptionStatus = typeof SUBSCRIPTION_STATUS[keyof typeof SUBSCRIPTION_STATUS];

export const CREATED_TYPES = {
  ADMIN: 'admin',
  SYSTEM: 'system',
} as const;

export type CreatedType = typeof CREATED_TYPES[keyof typeof CREATED_TYPES];
