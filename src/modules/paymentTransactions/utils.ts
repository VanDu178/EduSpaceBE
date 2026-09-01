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
