import prisma from '../../config/db';
import { SYSTEM_FEATURE_CODES, SYSTEM_FEATURE_METADATA, FEATURE_STATUS } from './constants';

/**
 * 1. Service lấy danh sách tất cả các tính năng.
 */
export const getFeaturesService = async (params: { keyword?: string; status?: string }) => {
  const { keyword, status } = params;
  const where: any = {};

  if (keyword) {
    where.OR = [
      { name: { contains: keyword } },
      { code: { contains: keyword } },
      { description: { contains: keyword } }
    ];
  }

  if (status && status !== FEATURE_STATUS.ALL) {
    where.isActive = status === FEATURE_STATUS.ACTIVE;
  }


  const features = await prisma.feature.findMany({
    where,
    orderBy: [
      { sortOrder: 'asc' },
      { createdAt: 'asc' }
    ]
  });

  return features;
};

/**
 * 2. Service lấy danh sách các Mã tính năng hệ thống chuẩn kèm metadata.
 */
export const getSystemFeatureCodesService = async () => {
  const existingFeatures = await prisma.feature.findMany({
    select: { code: true }
  });

  const existingCodesSet = new Set(existingFeatures.map((f) => f.code));

  const systemCodes = SYSTEM_FEATURE_CODES.map((code) => {
    const metadata = SYSTEM_FEATURE_METADATA[code] || {
      code,
      name: code,
      description: ''
    };
    return {
      ...metadata,
      isCreated: existingCodesSet.has(code)
    };
  });

  return systemCodes;
};

/**
 * 3. Service lấy chi tiết tính năng theo ID.
 */
export const getFeatureByIdService = async (id: number) => {
  const feature = await prisma.feature.findUnique({
    where: { id }
  });

  return feature;
};

/**
 * 4. Service tạo mới tính năng.
 */
export const createFeatureService = async (data: {
  code: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
}) => {
  const feature = await prisma.feature.create({
    data: {
      code: data.code,
      name: data.name,
      description: data.description || null,
      sortOrder: data.sortOrder,
      isActive: data.isActive
    }
  });

  return feature;
};

/**
 * 5. Service cập nhật tính năng.
 */
export const updateFeatureService = async (id: number, updateData: any) => {
  const feature = await prisma.feature.update({
    where: { id },
    data: updateData
  });

  return feature;
};

/**
 * 6. Service xóa tính năng.
 */
export const deleteFeatureService = async (id: number) => {
  await prisma.feature.delete({
    where: { id }
  });
};

/**
 * 7. Service bật/tắt trạng thái kích hoạt của tính năng.
 */
export const toggleFeatureStatusService = async (id: number, currentIsActive: boolean) => {
  const feature = await prisma.feature.update({
    where: { id },
    data: { isActive: !currentIsActive }
  });

  return feature;
};

/**
 * 8. Service cập nhật thứ tự sắp xếp của tính năng.
 */
export const updateFeatureSortOrderService = async (id: number, sortOrder: number) => {
  const feature = await prisma.feature.update({
    where: { id },
    data: { sortOrder }
  });

  return feature;
};
