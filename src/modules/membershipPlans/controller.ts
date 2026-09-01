import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/responseHelper';
import {
  validateGetMembershipPlans,
  validateGetMembershipPlanById,
  validateCreateMembershipPlan,
  validateUpdateMembershipPlan,
  validateToggleMembershipPlanStatus,
  validateDeleteMembershipPlan
} from './validation';
import {
  getMembershipPlansService,
  getMembershipPlanByIdService,
  createMembershipPlanService,
  updateMembershipPlanService,
  toggleMembershipPlanStatusService,
  deleteMembershipPlanService
} from './services';

/**
 * 1. Lấy danh sách gói hội viên kèm danh sách các tính năng.
 * - Client xem (Public): CHỈ lấy các gói isActive = true
 * - Admin xem: Lấy tất cả hoặc lọc theo query parameter isActive
 */
export const getMembershipPlans = asyncHandler(async (req: Request, res: Response) => {
  const query = validateGetMembershipPlans(req);
  const data = await getMembershipPlansService(query);
  return sendSuccess(res, data, 'Lấy danh sách gói hội viên thành công');
});

/**
 * 2. Lấy chi tiết gói hội viên theo ID hoặc Mã Code.
 */
export const getMembershipPlanById = asyncHandler(async (req: Request, res: Response) => {
  const params = validateGetMembershipPlanById(req);
  const data = await getMembershipPlanByIdService(params);
  return sendSuccess(res, data, 'Lấy thông tin gói hội viên thành công');
});

/**
 * 3. Tạo mới gói hội viên (Chỉ Admin).
 * - Mã code được tự động sinh theo format PLN-XXXXXX
 */
export const createMembershipPlan = asyncHandler(async (req: Request, res: Response) => {
  const body = validateCreateMembershipPlan(req);
  const data = await createMembershipPlanService(body);
  return sendSuccess(res, data, 'Tạo gói hội viên thành công', 201);
});

/**
 * 4. Cập nhật gói hội viên (Chỉ Admin).
 */
export const updateMembershipPlan = asyncHandler(async (req: Request, res: Response) => {
  const { planId, existing, body } = await validateUpdateMembershipPlan(req);
  const data = await updateMembershipPlanService(planId, existing, body);
  return sendSuccess(res, data, 'Cập nhật gói hội viên thành công');
});

/**
 * 5. Bật/Tắt nhanh trạng thái hoạt động của gói (isActive) (Chỉ Admin).
 */
export const toggleMembershipPlanStatus = asyncHandler(async (req: Request, res: Response) => {
  const { planId, existing } = await validateToggleMembershipPlanStatus(req);
  const { data, message } = await toggleMembershipPlanStatusService(planId, existing);
  return sendSuccess(res, data, message);
});

/**
 * 6. Xóa gói hội viên (Chỉ Admin).
 * - Nếu gói đang có lịch sử đăng ký hoặc giao dịch thì chặn xóa để đảm bảo toàn vẹn dữ liệu.
 */
export const deleteMembershipPlan = asyncHandler(async (req: Request, res: Response) => {
  const { planId } = await validateDeleteMembershipPlan(req);
  await deleteMembershipPlanService(planId);
  return sendSuccess(res, null, 'Xóa gói hội viên thành công');
});
