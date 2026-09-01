/**
 * Helper function sinh mã định danh duy nhất cho Gói hội viên (MembershipPlan)
 * Ví dụ: id = 1 -> 'PLN-000001'
 */
export const generatePlanCode = (id: number): string => {
  return `PLN-${String(id).padStart(6, '0')}`;
};
