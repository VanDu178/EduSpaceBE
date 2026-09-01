import prisma from '../../config/db';

/**
 * 1. Service Lấy danh sách tài khoản thanh toán
 */
export const getPaymentAccountsService = async (keyword?: string) => {
  const where: any = {};

  if (keyword) {
    where.OR = [
      { bankCode: { contains: keyword } },
      { accountNo: { contains: keyword } },
      { accountHolder: { contains: keyword } },
      {
        bank: {
          OR: [
            { name: { contains: keyword } },
            { shortName: { contains: keyword } }
          ]
        }
      }
    ];
  }

  const paymentAccounts = await prisma.paymentAccount.findMany({
    where,
    include: {
      bank: true
    },
    orderBy: [
      { isDefault: 'desc' },
      { createdAt: 'desc' }
    ]
  });

  return paymentAccounts;
};

/**
 * 2. Service Lấy tài khoản thanh toán mặc định đang nhận tiền (Checkout Client)
 */
export const getDefaultPaymentAccountService = async () => {
  const defaultAccount = await prisma.paymentAccount.findFirst({
    where: {
      isDefault: true,
      bank: { isActive: true }
    },
    include: {
      bank: true
    }
  });

  return defaultAccount;
};

/**
 * 3. Service Lấy chi tiết tài khoản thanh toán theo ID
 */
export const getPaymentAccountByIdService = async (numericId: number) => {
  const paymentAccount = await prisma.paymentAccount.findUnique({
    where: { id: numericId },
    include: {
      bank: true
    }
  });

  return paymentAccount;
};

/**
 * 4. Service Tạo mới tài khoản thanh toán
 */
export const createPaymentAccountService = async (validatedData: {
  createData: any;
  shouldBeDefault: boolean;
}) => {
  const { createData, shouldBeDefault } = validatedData;

  const paymentAccount = await prisma.$transaction(async (tx) => {
    if (shouldBeDefault) {
      await tx.paymentAccount.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      });
    }

    return await tx.paymentAccount.create({
      data: createData,
      include: {
        bank: true
      }
    });
  });

  return paymentAccount;
};

/**
 * 5. Service Cập nhật thông tin tài khoản thanh toán
 */
export const updatePaymentAccountService = async (
  numericId: number,
  updateData: any,
  shouldBeDefault: boolean,
  existingIsDefault: boolean
) => {
  const paymentAccount = await prisma.$transaction(async (tx) => {
    if (shouldBeDefault && !existingIsDefault) {
      await tx.paymentAccount.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      });
    }

    return await tx.paymentAccount.update({
      where: { id: numericId },
      data: updateData,
      include: {
        bank: true
      }
    });
  });

  return paymentAccount;
};

/**
 * 6. Service Bật/Tắt trạng thái mặc định (Ủy quyền cho setDefaultPaymentAccountService)
 */
export const togglePaymentAccountStatusService = async (numericId: number) => {
  return setDefaultPaymentAccountService(numericId);
};

/**
 * 7. Service Thiết lập tài khoản thanh toán làm mặc định
 */
export const setDefaultPaymentAccountService = async (numericId: number) => {
  const paymentAccount = await prisma.$transaction(async (tx) => {
    await tx.paymentAccount.updateMany({
      where: { isDefault: true },
      data: { isDefault: false }
    });

    return await tx.paymentAccount.update({
      where: { id: numericId },
      data: { isDefault: true }
    });
  });

  return paymentAccount;
};

/**
 * 8. Service Xóa tài khoản thanh toán
 */
export const deletePaymentAccountService = async (numericId: number) => {
  await prisma.paymentAccount.delete({
    where: { id: numericId }
  });

  return true;
};
