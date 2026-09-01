import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/responseHelper';
import {
  validateGetPaymentAccounts,
  validateGetDefaultPaymentAccount,
  validateGetPaymentAccountById,
  validateCreatePaymentAccount,
  validateUpdatePaymentAccount,
  validateSetDefaultPaymentAccount,
  validateDeletePaymentAccount
} from './validation';
import {
  getPaymentAccountsService,
  getDefaultPaymentAccountService,
  createPaymentAccountService,
  updatePaymentAccountService,
  setDefaultPaymentAccountService,
  deletePaymentAccountService
} from './services';

/**
 * 1. Lấy danh sách tài khoản thanh toán (Hỗ trợ lọc tìm kiếm)
 */
export const getPaymentAccounts = asyncHandler(async (req: Request, res: Response) => {
  const { keyword } = validateGetPaymentAccounts(req.query);
  const paymentAccounts = await getPaymentAccountsService(keyword);
  return sendSuccess(res, { paymentAccounts }, 'Lấy danh sách tài khoản thanh toán thành công');
});

/**
 * 2. Lấy tài khoản thanh toán mặc định đang nhận tiền (Dành cho Checkout Client)
 */
export const getDefaultPaymentAccount = asyncHandler(async (_req: Request, res: Response) => {
  validateGetDefaultPaymentAccount();
  const defaultAccount = await getDefaultPaymentAccountService();
  return sendSuccess(res, { paymentAccount: defaultAccount }, 'Lấy tài khoản thanh toán mặc định thành công');
});

/**
 * 3. Lấy chi tiết tài khoản thanh toán theo ID
 */
export const getPaymentAccountById = asyncHandler(async (req: Request, res: Response) => {
  const { paymentAccount } = await validateGetPaymentAccountById(req.params);
  return sendSuccess(res, { paymentAccount }, 'Lấy chi tiết tài khoản thanh toán thành công');
});

/**
 * 4. Tạo mới tài khoản thanh toán (Admin)
 */
export const createPaymentAccount = asyncHandler(async (req: Request, res: Response) => {
  const validatedData = await validateCreatePaymentAccount(req.body);
  const paymentAccount = await createPaymentAccountService(validatedData);
  return sendSuccess(res, { paymentAccount }, 'Tạo tài khoản thanh toán thành công', 201);
});

/**
 * 5. Cập nhật thông tin tài khoản thanh toán (Admin)
 */
export const updatePaymentAccount = asyncHandler(async (req: Request, res: Response) => {
  const { numericId, existingAccount, updateData, shouldBeDefault } = await validateUpdatePaymentAccount(
    req.params,
    req.body
  );
  const paymentAccount = await updatePaymentAccountService(
    numericId,
    updateData,
    shouldBeDefault,
    existingAccount.isDefault
  );
  return sendSuccess(res, { paymentAccount }, 'Cập nhật tài khoản thanh toán thành công');
});

/**
 * 6. Bật/Tắt trạng thái mặc định của tài khoản thanh toán (Admin)
 */
export const togglePaymentAccountStatus = asyncHandler(async (req: Request, res: Response, next: any) => {
  return (setDefaultPaymentAccount as any)(req, res, next);
});

/**
 * 7. Thiết lập tài khoản thanh toán làm mặc định đang nhận tiền (Admin)
 */
export const setDefaultPaymentAccount = asyncHandler(async (req: Request, res: Response) => {
  const { numericId } = await validateSetDefaultPaymentAccount(req.params);
  const paymentAccount = await setDefaultPaymentAccountService(numericId);
  return sendSuccess(res, { paymentAccount }, 'Đã thiết lập làm tài khoản nhận tiền mặc định');
});

/**
 * 8. Xóa tài khoản thanh toán (Admin)
 */
export const deletePaymentAccount = asyncHandler(async (req: Request, res: Response) => {
  const { numericId } = await validateDeletePaymentAccount(req.params);
  await deletePaymentAccountService(numericId);
  return sendSuccess(res, null, 'Đã xóa tài khoản thanh toán thành công');
});
