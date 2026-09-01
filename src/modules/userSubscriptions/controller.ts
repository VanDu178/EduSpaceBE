import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/responseHelper';
import type { AuthenticatedRequest } from '../../middlewares/authMiddleware';
import {
  validateGetMySubscriptionsData,
  validateGetSubscriptionByIdData,
  validateCreateSubscriptionData,
  validateGetSubscriptionsData,
  validateUpdateSubscriptionStatusData,
  validateDeleteSubscriptionData,
} from './validation';
import {
  getMySubscriptionsService,
  getSubscriptionByIdService,
  createSubscriptionService,
  getSubscriptionsService,
  updateSubscriptionStatusService,
  deleteSubscriptionService,
} from './services';

/**
 * User đang đăng nhập tự lấy lịch sử đăng ký của chính mình.
 */
export const getMySubscriptions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = await validateGetMySubscriptionsData(req.user!);
  const result = await getMySubscriptionsService(userId);
  return sendSuccess(res, result, 'Lấy thông tin đăng ký cá nhân thành công');
});

/**
 * Xem chi tiết 1 đơn đăng ký theo ID (Chính chủ hoặc Admin).
 */
export const getSubscriptionById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { subscription } = await validateGetSubscriptionByIdData(req.user, req.params);
  const result = await getSubscriptionByIdService(subscription);
  return sendSuccess(res, result, 'Lấy chi tiết đơn đăng ký thành công');
});

/**
 * Tạo mới một đăng ký gói hội viên (Admin cấp gói hoặc User mua gói).
 */
export const createSubscription = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const validData = await validateCreateSubscriptionData(req.user, req.body);
  const result = await createSubscriptionService(req.user, validData);
  return sendSuccess(res, result, 'Đăng ký gói hội viên thành công', 201);
});

/**
 * Lấy danh sách lịch sử đăng ký & thanh toán (Chỉ Admin).
 */
export const getSubscriptions = asyncHandler(async (req: Request, res: Response) => {
  const queryData = await validateGetSubscriptionsData(req.query);
  const result = await getSubscriptionsService(queryData);
  return sendSuccess(res, result, 'Lấy danh sách hội viên thành công');
});

/**
 * Cập nhật trạng thái đơn đăng ký (Chỉ Admin duyệt/hủy/gia hạn).
 */
export const updateSubscriptionStatus = asyncHandler(async (req: Request, res: Response) => {
  const { subId, existing, body } = await validateUpdateSubscriptionStatusData(req.params, req.body);
  const result = await updateSubscriptionStatusService(subId, existing, body);
  return sendSuccess(res, result, 'Cập nhật trạng thái đăng ký thành công');
});

/**
 * Xóa đơn đăng ký gói hội viên cấp thủ công (Chỉ Admin).
 */
export const deleteSubscription = asyncHandler(async (req: Request, res: Response) => {
  const { subId, existing } = await validateDeleteSubscriptionData(req.params);
  const result = await deleteSubscriptionService(subId, existing);
  return sendSuccess(res, result, 'Xóa gói hội viên cấp thủ công thành công');
});
