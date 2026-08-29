import { Router } from 'express';
import {
  getPaymentAccounts,
  getDefaultPaymentAccount,
  getPaymentAccountById,
  createPaymentAccount,
  updatePaymentAccount,
  togglePaymentAccountStatus,
  setDefaultPaymentAccount,
  deletePaymentAccount
} from './controller';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { adminMiddleware } from '../../middlewares/adminMiddleware';

const router = Router();

// Route công khai (Public / Client)
router.get('/default', getDefaultPaymentAccount as any);
router.get('/', getPaymentAccounts as any);

// Route yêu cầu xác thực & quyền Admin
router.use(authMiddleware as any);
router.use(adminMiddleware as any);

router.get('/:id', getPaymentAccountById as any);
router.post('/', createPaymentAccount as any);
router.put('/:id', updatePaymentAccount as any);
router.patch('/:id/status', togglePaymentAccountStatus as any);
router.patch('/:id/set-default', setDefaultPaymentAccount as any);
router.delete('/:id', deletePaymentAccount as any);

export default router;
