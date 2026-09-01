import prisma from '../../config/db';
import { PAYMENT_METHOD_STATUS } from './constants';

/**
 * 1. Lấy danh sách phương thức thanh toán đang hoạt động (Client Checkout)
 */
export async function getActivePaymentMethodsService() {
  const paymentMethods = await prisma.paymentMethod.findMany({
    where: { isActive: true },
    orderBy: [
      { sortOrder: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  return paymentMethods;
}

/**
 * 2. Lấy danh sách tất cả phương thức thanh toán (Admin)
 */
export async function getPaymentMethodsService(filters: { keyword?: string; status?: string }) {
  const where: any = {};

  if (filters.keyword) {
    where.OR = [
      { name: { contains: filters.keyword } },
      { code: { contains: filters.keyword } },
      { description: { contains: filters.keyword } },
    ];
  }

  if (filters.status && filters.status !== PAYMENT_METHOD_STATUS.ALL) {
    where.isActive = filters.status === PAYMENT_METHOD_STATUS.ACTIVE;
  }

  const paymentMethods = await prisma.paymentMethod.findMany({
    where,
    orderBy: [
      { sortOrder: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  return paymentMethods;
}

/**
 * 3. Lấy chi tiết phương thức thanh toán theo ID
 */
export async function getPaymentMethodByIdService(id: number) {
  const paymentMethod = await prisma.paymentMethod.findUnique({
    where: { id },
  });

  return paymentMethod;
}

/**
 * 4. Tạo mới phương thức thanh toán
 */
export async function createPaymentMethodService(data: {
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
}) {
  const paymentMethod = await prisma.paymentMethod.create({
    data,
  });

  return paymentMethod;
}

/**
 * 5. Cập nhật phương thức thanh toán
 */
export async function updatePaymentMethodService(id: number, updateData: any) {
  const paymentMethod = await prisma.paymentMethod.update({
    where: { id },
    data: updateData,
  });

  return paymentMethod;
}

/**
 * 6. Cập nhật thứ tự sắp xếp phương thức thanh toán
 */
export async function updatePaymentMethodSortOrderService(id: number, sortOrder: number) {
  const paymentMethod = await prisma.paymentMethod.update({
    where: { id },
    data: { sortOrder },
  });

  return paymentMethod;
}

/**
 * 7. Bật/Tắt nhanh trạng thái kích hoạt phương thức thanh toán
 */
export async function togglePaymentMethodStatusService(existingMethod: { id: number; isActive: boolean }) {
  const paymentMethod = await prisma.paymentMethod.update({
    where: { id: existingMethod.id },
    data: { isActive: !existingMethod.isActive },
  });

  return paymentMethod;
}

/**
 * 8. Xóa phương thức thanh toán
 */
export async function deletePaymentMethodService(id: number) {
  await prisma.paymentMethod.delete({
    where: { id },
  });

  return true;
}
