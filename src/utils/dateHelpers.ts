/**
 * Helper utilities xử lý so sánh Ngày tháng (loại bỏ phần Giờ/Phút/Giây).
 */

/**
 * Lấy mốc 00:00:00.000 của ngày hôm nay.
 */
export const getStartOfToday = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Lấy mốc 23:59:59.999 của ngày hôm nay.
 */
export const getEndOfToday = (): Date => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};

/**
 * Lấy mốc 23:59:59.999 của ngày hôm qua (dùng để kết thúc gói cũ ngay lập tức).
 */
export const getYesterdayEndOfDay = (): Date => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(23, 59, 59, 999);
  return d;
};

/**
 * Kiểm tra xem 1 mốc endDate có còn hạn hay không (so sánh với đầu ngày hôm nay).
 */
export const isSubscriptionActive = (endDate: Date | string): boolean => {
  if (!endDate) return false;
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  return end.getTime() >= getStartOfToday().getTime();
};
