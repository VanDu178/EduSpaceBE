import prisma from '../../config/db';
import { AppError } from '../../utils/appError';
import {
  paymentMethodIdParamSchema,
  getPaymentMethodsQuerySchema,
  createPaymentMethodSchema,
  updatePaymentMethodSchema,
  updatePaymentMethodSortOrderSchema,
} from './zodSchemas';

/**
 * 1. Validate cho getActivePaymentMethods (Client Checkout)
 */
export async function validateGetActivePaymentMethodsData() {
  return true;
}

/**
 * 2. Validate cho getPaymentMethods (Admin)
 */
export async function validateGetPaymentMethodsData(query: unknown) {
  const parseResult = getPaymentMethodsQuerySchema.safeParse(query);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0] as any;
    const message = firstIssue?.message || 'Tham số truy vấn không hợp lệ';
    const errorCode = firstIssue?.params?.errorCode || 'VALIDATION_ERROR';
    const statusCode = firstIssue?.params?.statusCode || 400;
    throw new AppError(message, statusCode, errorCode);
  }

  const { keyword, status } = parseResult.data;
  return { keyword, status };
}

/**
 * 3. Validate cho getPaymentMethodById
 */
export async function validateGetPaymentMethodByIdData(params: unknown) {
  const parseResult = paymentMethodIdParamSchema.safeParse(params);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0] as any;
    const message = firstIssue?.message || 'ID phương thức thanh toán không hợp lệ';
    const errorCode = firstIssue?.params?.errorCode || 'VALIDATION_ERROR';
    const statusCode = firstIssue?.params?.statusCode || 400;
    throw new AppError(message, statusCode, errorCode);
  }

  const { id: numericId } = parseResult.data;

  const paymentMethod = await prisma.paymentMethod.findUnique({
    where: { id: numericId },
  });

  if (!paymentMethod) {
    throw new AppError('Phương thức thanh toán không tồn tại', 404, 'NOT_FOUND');
  }

  return paymentMethod;
}

/**
 * 4. Validate cho createPaymentMethod
 */
export async function validateCreatePaymentMethodData(body: unknown) {
  const parseResult = createPaymentMethodSchema.safeParse(body);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0] as any;
    const message = firstIssue?.message || 'Mã, tên và icon phương thức thanh toán là bắt buộc.';
    const errorCode = firstIssue?.params?.errorCode || 'VALIDATION_ERROR';
    const statusCode = firstIssue?.params?.statusCode || 400;
    throw new AppError(message, statusCode, errorCode);
  }

  const { code, name, description, icon, sortOrder, isActive } = parseResult.data;

  if (!code || !name || !icon || !icon.trim()) {
    throw new AppError('Mã, tên và icon phương thức thanh toán là bắt buộc.', 400, 'VALIDATION_ERROR', {
      code: !code ? ['Mã phương thức thanh toán là bắt buộc.'] : [],
      name: !name ? ['Tên phương thức thanh toán là bắt buộc.'] : [],
      icon: (!icon || !icon.trim()) ? ['Icon phương thức thanh toán là bắt buộc.'] : [],
    });
  }

  const existingMethod = await prisma.paymentMethod.findUnique({
    where: { code: code.trim() },
  });

  if (existingMethod) {
    throw new AppError('Mã phương thức thanh toán đã tồn tại trong hệ thống.', 400, 'VALIDATION_ERROR', {
      code: ['Mã phương thức thanh toán đã tồn tại.'],
    });
  }

  return {
    code: code.trim(),
    name: name.trim(),
    description: description ? description.trim() : null,
    icon: icon ? icon.trim() : null,
    sortOrder: sortOrder !== undefined ? Number(sortOrder) : 0,
    isActive: isActive !== undefined ? Boolean(isActive) : true,
  };
}

/**
 * 5. Validate cho updatePaymentMethod
 */
export async function validateUpdatePaymentMethodData(params: unknown, body: unknown) {
  const parseResult = updatePaymentMethodSchema.safeParse({
    ...(typeof params === 'object' && params !== null ? params : {}),
    ...(typeof body === 'object' && body !== null ? body : {}),
  });

  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0] as any;
    const message = firstIssue?.message || 'ID phương thức thanh toán không hợp lệ';
    const errorCode = firstIssue?.params?.errorCode || 'VALIDATION_ERROR';
    const statusCode = firstIssue?.params?.statusCode || 400;
    throw new AppError(message, statusCode, errorCode);
  }

  const { id: numericId, code, name, description, icon, sortOrder, isActive } = parseResult.data;

  const existingMethod = await prisma.paymentMethod.findUnique({
    where: { id: numericId },
  });

  if (!existingMethod) {
    throw new AppError('Phương thức thanh toán không tồn tại', 404, 'NOT_FOUND');
  }

  if (code !== undefined) {
    if (code.trim() !== existingMethod.code) {
      throw new AppError('Không được phép sửa mã hệ thống (code) của phương thức thanh toán.', 400, 'VALIDATION_ERROR');
    }
  }

  const updateData: any = {};
  if (name !== undefined) {
    if (!name || !name.trim()) {
      throw new AppError('Tên phương thức thanh toán không được để trống.', 400, 'VALIDATION_ERROR', {
        name: ['Tên phương thức thanh toán không được để trống.'],
      });
    }
    updateData.name = name.trim();
  }
  if (description !== undefined) updateData.description = description ? description.trim() : null;
  if (icon !== undefined) {
    if (!icon || !icon.trim()) {
      throw new AppError('Icon phương thức thanh toán không được để trống.', 400, 'VALIDATION_ERROR', {
        icon: ['Icon phương thức thanh toán không được để trống.'],
      });
    }
    updateData.icon = icon.trim();
  }
  if (sortOrder !== undefined) updateData.sortOrder = Number(sortOrder);
  if (isActive !== undefined) updateData.isActive = Boolean(isActive);

  return {
    numericId,
    updateData,
  };
}

/**
 * 6. Validate cho updatePaymentMethodSortOrder
 */
export async function validateUpdatePaymentMethodSortOrderData(params: unknown, body: unknown) {
  const parseResult = updatePaymentMethodSortOrderSchema.safeParse({
    ...(typeof params === 'object' && params !== null ? params : {}),
    ...(typeof body === 'object' && body !== null ? body : {}),
  });

  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0] as any;
    const message = firstIssue?.message || 'ID phương thức thanh toán không hợp lệ';
    const errorCode = firstIssue?.params?.errorCode || 'VALIDATION_ERROR';
    const statusCode = firstIssue?.params?.statusCode || 400;
    throw new AppError(message, statusCode, errorCode);
  }

  const { id: numericId, sortOrder } = parseResult.data;

  if (sortOrder === undefined || sortOrder === null || isNaN(Number(sortOrder))) {
    throw new AppError('Thứ tự sắp xếp không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const existingMethod = await prisma.paymentMethod.findUnique({
    where: { id: numericId },
  });

  if (!existingMethod) {
    throw new AppError('Phương thức thanh toán không tồn tại', 404, 'NOT_FOUND');
  }

  return {
    numericId,
    sortOrder: Number(sortOrder),
  };
}

/**
 * 7. Validate cho togglePaymentMethodStatus
 */
export async function validateTogglePaymentMethodStatusData(params: unknown) {
  const parseResult = paymentMethodIdParamSchema.safeParse(params);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0] as any;
    const message = firstIssue?.message || 'ID phương thức thanh toán không hợp lệ';
    const errorCode = firstIssue?.params?.errorCode || 'VALIDATION_ERROR';
    const statusCode = firstIssue?.params?.statusCode || 400;
    throw new AppError(message, statusCode, errorCode);
  }

  const { id: numericId } = parseResult.data;

  const existingMethod = await prisma.paymentMethod.findUnique({
    where: { id: numericId },
  });

  if (!existingMethod) {
    throw new AppError('Phương thức thanh toán không tồn tại', 404, 'NOT_FOUND');
  }

  return existingMethod;
}

/**
 * 8. Validate cho deletePaymentMethod
 */
export async function validateDeletePaymentMethodData(params: unknown) {
  const parseResult = paymentMethodIdParamSchema.safeParse(params);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0] as any;
    const message = firstIssue?.message || 'ID phương thức thanh toán không hợp lệ';
    const errorCode = firstIssue?.params?.errorCode || 'VALIDATION_ERROR';
    const statusCode = firstIssue?.params?.statusCode || 400;
    throw new AppError(message, statusCode, errorCode);
  }

  const { id: numericId } = parseResult.data;

  const existingMethod = await prisma.paymentMethod.findUnique({
    where: { id: numericId },
  });

  if (!existingMethod) {
    throw new AppError('Phương thức thanh toán không tồn tại', 404, 'NOT_FOUND');
  }

  const [usedInTransaction, usedInSubscription] = await Promise.all([
    prisma.paymentTransaction.findFirst({
      where: { paymentMethod: existingMethod.code },
    }),
    prisma.userSubscription.findFirst({
      where: { paymentMethod: existingMethod.code },
    }),
  ]);

  if (usedInTransaction || usedInSubscription) {
    throw new AppError(
      'Phương thức thanh toán này đã được sử dụng trong hệ thống, không thể xóa. Bạn có thể vô hiệu hóa trạng thái thay vì xóa.',
      400,
      'PAYMENT_METHOD_IN_USE'
    );
  }

  return numericId;
}
