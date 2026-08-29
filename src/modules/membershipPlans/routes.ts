import { Router } from 'express';
import {
  getMembershipPlans,
  getMembershipPlanById,
  createMembershipPlan,
  updateMembershipPlan,
  toggleMembershipPlanStatus,
  deleteMembershipPlan
} from './controller';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { adminMiddleware } from '../../middlewares/adminMiddleware';

const router = Router();
// Route công khai (Public) - Cho phép xem danh sách và chi tiết gói
router.get('/', getMembershipPlans as any);
router.get('/:id', getMembershipPlanById as any);

// Các Route dành riêng cho Admin (Bắt buộc đăng nhập & Quyền Admin)
router.use(authMiddleware as any);
router.use(adminMiddleware as any);


router.post('/', createMembershipPlan as any);
router.put('/:id', updateMembershipPlan as any);
router.patch('/:id/status', toggleMembershipPlanStatus as any);
router.delete('/:id', deleteMembershipPlan as any);

export default router;
