/**
 * HẰNG SỐ VÀ ENUMS DÙNG CHO MODULE AUTH
 */

export const USER_ROLES = {
  ADMIN: 'admin',
  CLIENT: 'client',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

export const USER_STATUS = {
  ACTIVE: 'active',
  LOCKED: 'locked',
} as const;

export type UserStatusType = typeof USER_STATUS[keyof typeof USER_STATUS];

export const AUTH_PROVIDERS = {
  LOCAL: 'local',
  GOOGLE: 'google',
} as const;

/**
 * Thời gian ân hạn (Grace Period) cho phép tái sử dụng Refresh Token vừa xoay vòng (15 giây)
 */
export const TOKEN_REFRESH_GRACE_PERIOD_MS = 15 * 1000;



