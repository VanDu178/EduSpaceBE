import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/responseHelper';
import {
  validateGetActivePaymentMethodsData,
  validateGetPaymentMethodsData,
  validateGetPaymentMethodByIdData,
  validateCreatePaymentMethodData,
  validateUpdatePaymentMethodData,
  validateUpdatePaymentMethodSortOrderData,
  validateTogglePaymentMethodStatusData,
  validateDeletePaymentMethodData,
} from './validation';
import {
  getActivePaymentMethodsService,
  getPaymentMethodsService,
  createPaymentMethodService,
  updatePaymentMethodService,
  updatePaymentMethodSortOrderService,
  togglePaymentMethodStatusService,
  deletePaymentMethodService,
} from './services';

/**
 * 1. Lấy danh sách Phương thức thanh toán đang hoạt động (Dành cho Client Checkout).
 */
export const getActivePaymentMethods = asyncHandler(async (_req: Request, res: Response) => {
  await validateGetActivePaymentMethodsData();
  const paymentMethods = await getActivePaymentMethodsService();
  return sendSuccess(res, { paymentMethods }, 'Lấy danh sách phương thức thanh toán khả dụng thành công');
});

/**
 * 2. Lấy danh sách tất cả các Phương thức thanh toán (Dành cho Admin).
 */
export const getPaymentMethods = asyncHandler(async (req: Request, res: Response) => {
  const filters = await validateGetPaymentMethodsData(req.query);
  const paymentMethods = await getPaymentMethodsService(filters);
  return sendSuccess(res, { paymentMethods }, 'Lấy danh sách phương thức thanh toán thành công');
});

/**
 * 3. Lấy chi tiết phương thức thanh toán theo ID.
 */
export const getPaymentMethodById = asyncHandler(async (req: Request, res: Response) => {
  const paymentMethod = await validateGetPaymentMethodByIdData(req.params);
  return sendSuccess(res, { paymentMethod }, 'Lấy chi tiết phương thức thanh toán thành công');
});

/**
 * 4. Tạo mới phương thức thanh toán.
 */
export const createPaymentMethod = asyncHandler(async (req: Request, res: Response) => {
  const createData = await validateCreatePaymentMethodData(req.body);
  const paymentMethod = await createPaymentMethodService(createData);
  return sendSuccess(res, { paymentMethod }, 'Tạo phương thức thanh toán mới thành công', 201);
});

/**
 * 5. Cập nhật phương thức thanh toán.
 */
export const updatePaymentMethod = asyncHandler(async (req: Request, res: Response) => {
  const { numericId, updateData } = await validateUpdatePaymentMethodData(req.params, req.body);
  const paymentMethod = await updatePaymentMethodService(numericId, updateData);
  return sendSuccess(res, { paymentMethod }, 'Cập nhật phương thức thanh toán thành công');
});

/**
 * 6. Cập nhật thứ tự sắp xếp phương thức thanh toán.
 */
export const updatePaymentMethodSortOrder = asyncHandler(async (req: Request, res: Response) => {
  const { numericId, sortOrder } = await validateUpdatePaymentMethodSortOrderData(req.params, req.body);
  const paymentMethod = await updatePaymentMethodSortOrderService(numericId, sortOrder);
  return sendSuccess(res, { paymentMethod }, 'Cập nhật thứ tự sắp xếp thành công');
});

/**
 * 7. Bật/Tắt nhanh trạng thái phương thức thanh toán.
 */
export const togglePaymentMethodStatus = asyncHandler(async (req: Request, res: Response) => {
  const existingMethod = await validateTogglePaymentMethodStatusData(req.params);
  const paymentMethod = await togglePaymentMethodStatusService(existingMethod);
  const message = paymentMethod.isActive
    ? 'Đã kích hoạt phương thức thanh toán'
    : 'Đã vô hiệu hóa phương thức thanh toán';
  return sendSuccess(res, { paymentMethod }, message);
});

/**
 * 8. Xóa phương thức thanh toán.
 */
export const deletePaymentMethod = asyncHandler(async (req: Request, res: Response) => {
  const numericId = await validateDeletePaymentMethodData(req.params);
  await deletePaymentMethodService(numericId);
  return sendSuccess(res, null, 'Phương thức thanh toán đã được xóa thành công');
});
