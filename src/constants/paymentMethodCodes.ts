/**
 * HẰNG SỐ CHUẨN DUY NHẤT DÙNG CHO CÁC MÃ PHƯƠNG THỨC THANH TOÁN (PAYMENT METHOD CODES)
 * Tất cả các mã đều viết dưới dạng IN HOA (UPPERCASE)
 */
export interface DefaultPaymentMethod {
  code: string;
  name: string;
  description: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
}

export const PAYMENT_METHOD_CODES = {
  VIETQR: 'VIETQR',
  CREDIT_CARD: 'CREDIT_CARD',
  E_WALLET: 'E_WALLET',
} as const;


export const DEFAULT_PAYMENT_METHODS: DefaultPaymentMethod[] = [
  {
    code: PAYMENT_METHOD_CODES.VIETQR,
    name: 'Chuyển khoản QR (VietQR)',
    description: 'Thanh toán quét mã QR qua ứng dụng ngân hàng tự động duyệt nhanh chóng.',
    icon: 'QrCodeIcon',
    sortOrder: 1,
    isActive: true,
  },
  {
    code: PAYMENT_METHOD_CODES.CREDIT_CARD,
    name: 'Thẻ quốc tế / Ghi nợ',
    description: 'Thanh toán trực tiếp qua thẻ Visa, Mastercard, JCB.',
    icon: 'CreditCardIcon',
    sortOrder: 2,
    isActive: true,
  },
  {
    code: PAYMENT_METHOD_CODES.E_WALLET,
    name: 'Ví điện tử',
    description: 'Thanh toán nhanh qua các ví điện tử MoMo, ZaloPay, VNPay.',
    icon: 'WalletIcon',
    sortOrder: 3,
    isActive: true,
  },
];


export type PaymentMethodCode = keyof typeof PAYMENT_METHOD_CODES;


