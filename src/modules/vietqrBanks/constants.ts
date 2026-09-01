/**
 * HẰNG SỐ VÀ MAPPING CHO TRẠNG THÁI NGHÂN HÀNG VIETQR (VIETQR BANK STATUS)
 */
export const VIETQR_BANK_STATUS = {
  ALL: 'ALL',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const;

export type VietqrBankStatus = typeof VIETQR_BANK_STATUS[keyof typeof VIETQR_BANK_STATUS];
