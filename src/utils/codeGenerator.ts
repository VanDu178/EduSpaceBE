/**
 * Helper function sinh mã định danh duy nhất cho Người dùng (User)
 * Ví dụ: id = 1 -> 'USR-000001'
 */
export const generateUserCode = (id: number): string => {
  return `USR-${String(id).padStart(6, '0')}`;
};

/**
 * Helper function sinh mã định danh duy nhất cho Gói hội viên (MembershipPlan)
 * Ví dụ: id = 1 -> 'PLN-000001'
 */
export const generatePlanCode = (id: number): string => {
  return `PLN-${String(id).padStart(6, '0')}`;
};

/**
 * Helper function sinh mã định danh duy nhất cho Đăng ký / Hóa đơn (UserSubscription)
 * Ví dụ: id = 1 -> 'SUB-000001'
 */
export const generateSubscriptionCode = (id: number): string => {
  return `SUB-${String(id).padStart(6, '0')}`;
};

/**
 * Helper function sinh mã ngẫu nhiên duy nhất bảo mật cho Giao dịch Thanh toán VietQR (PaymentTransaction)
 * Ví dụ: 'TRV8K92A5'
 */
export const generatePaymentTransactionCode = (): string => {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let randomStr = '';
  for (let i = 0; i < 6; i++) {
    randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `TRV${randomStr}`;
};


