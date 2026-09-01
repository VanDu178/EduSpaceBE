import prisma from '../../config/db';

/**
 * 1. Lấy danh sách tất cả thể loại blog.
 */
export const getBlogTypesService = async () => {
  return await prisma.blogType.findMany({
    orderBy: { name: 'asc' }
  });
};

/**
 * 2. Tạo mới thể loại blog.
 */
export const createBlogTypeService = async (data: {
  name: string;
  code: string;
  description: string | null;
}) => {
  return await prisma.blogType.create({
    data
  });
};

/**
 * 3. Cập nhật thông tin thể loại blog.
 */
export const updateBlogTypeService = async (
  typeId: number,
  updateData: { name?: string; code?: string; description?: string | null }
) => {
  return await prisma.blogType.update({
    where: { id: typeId },
    data: updateData
  });
};

/**
 * 4. Xóa thể loại blog.
 */
export const deleteBlogTypeService = async (typeId: number) => {
  await prisma.blogType.delete({
    where: { id: typeId }
  });
  return null;
};
