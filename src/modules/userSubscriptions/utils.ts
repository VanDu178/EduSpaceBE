/**
 * Helper function sinh mã định danh duy nhất cho Đăng ký / Hóa đơn (UserSubscription)
 * Ví dụ: id = 1 -> 'SUB-000001'
 */
export const generateSubscriptionCode = (id: number): string => {
  return `SUB-${String(id).padStart(6, '0')}`;
};
