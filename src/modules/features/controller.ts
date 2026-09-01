import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/responseHelper';
import {
  validateGetFeatures,
  validateGetSystemFeatureCodes,
  validateGetFeatureById,
  validateCreateFeature,
  validateUpdateFeature,
  validateDeleteFeature,
  validateToggleFeatureStatus,
  validateUpdateFeatureSortOrder
} from './validation';
import {
  getFeaturesService,
  getSystemFeatureCodesService,
  getFeatureByIdService,
  createFeatureService,
  updateFeatureService,
  deleteFeatureService,
  toggleFeatureStatusService,
  updateFeatureSortOrderService
} from './services';

/**
 * 1. Lấy danh sách tất cả các tính năng (Feature).
 */
export const getFeatures = asyncHandler(async (req: Request, res: Response) => {
  const query = await validateGetFeatures(req);
  const features = await getFeaturesService(query);

  return sendSuccess(res, { features }, 'Lấy danh sách tính năng thành công');
});

/**
 * 2. Lấy danh sách các Mã tính năng hệ thống chuẩn (System Feature Codes) kèm metadata.
 */
export const getSystemFeatureCodes = asyncHandler(async (req: Request, res: Response) => {
  await validateGetSystemFeatureCodes(req);
  const systemCodes = await getSystemFeatureCodesService();

  return sendSuccess(res, { systemCodes }, 'Lấy danh sách mã tính năng hệ thống thành công');
});

/**
 * 3. Lấy chi tiết tính năng theo ID.
 */
export const getFeatureById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = await validateGetFeatureById(req);
  const feature = await getFeatureByIdService(id);

  return sendSuccess(res, { feature }, 'Lấy chi tiết tính năng thành công');
});

/**
 * 4. Tạo mới tính năng.
 */
export const createFeature = asyncHandler(async (req: Request, res: Response) => {
  const validatedData = await validateCreateFeature(req);
  const feature = await createFeatureService(validatedData);

  return sendSuccess(res, { feature }, 'Tạo tính năng mới thành công', 201);
});

/**
 * 5. Cập nhật tính năng.
 */
export const updateFeature = asyncHandler(async (req: Request, res: Response) => {
  const { id, updateData } = await validateUpdateFeature(req);
  const feature = await updateFeatureService(id, updateData);

  return sendSuccess(res, { feature }, 'Cập nhật tính năng thành công');
});

/**
 * 6. Xóa tính năng.
 */
export const deleteFeature = asyncHandler(async (req: Request, res: Response) => {
  const { id } = await validateDeleteFeature(req);
  await deleteFeatureService(id);

  return sendSuccess(res, null, 'Tính năng đã được xóa thành công');
});

/**
 * 7. Bật/Tắt nhanh trạng thái kích hoạt của tính năng.
 */
export const toggleFeatureStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id, existingFeature } = await validateToggleFeatureStatus(req);
  const feature = await toggleFeatureStatusService(id, existingFeature.isActive);

  const message = feature.isActive
    ? 'Đã kích hoạt tính năng'
    : 'Đã vô hiệu hóa tính năng';

  return sendSuccess(res, { feature }, message);
});

/**
 * 8. Cập nhật thứ tự sắp xếp của tính năng.
 */
export const updateFeatureSortOrder = asyncHandler(async (req: Request, res: Response) => {
  const { id, sortOrder } = await validateUpdateFeatureSortOrder(req);
  const feature = await updateFeatureSortOrderService(id, sortOrder);

  return sendSuccess(res, { feature }, 'Cập nhật thứ tự sắp xếp thành công');
});
