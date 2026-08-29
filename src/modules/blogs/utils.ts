/**
 * Hàm helper tự động tạo slug từ tiêu đề tiếng Việt
 */
export const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/([^0-9a-z-\s])/g, '')
    .replace(/(\s+)/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * Helper function sinh mã định danh duy nhất cho Bài viết (Blog)
 * Ví dụ: id = 1 -> 'BLG-000001'
 */
export const generateBlogCode = (id: number): string => {
  return `BLG-${String(id).padStart(6, '0')}`;
};

