/**
 * Helper function sinh mã định danh duy nhất cho Người dùng (User)
 * Ví dụ: id = 1 -> 'USR-000001'
 */
export const generateUserCode = (id: number): string => {
  return `USR-${String(id).padStart(6, '0')}`;
};

/**
 * Helper function sinh mã định danh duy nhất cho Bài viết (Blog)
 * Ví dụ: id = 1 -> 'BLG-000001'
 */
export const generateBlogCode = (id: number): string => {
  return `BLG-${String(id).padStart(6, '0')}`;
};
