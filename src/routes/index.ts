import express from 'express';
import authRoutes from '../modules/auth/routes';
import blogRoutes from '../modules/blogs/routes';
import blogTypeRoutes from '../modules/blogTypes/routes';
import userRoutes from '../modules/users/routes';
import uploadRoutes from '../modules/upload/routes';
import membershipPlanRoutes from '../modules/membershipPlans/routes';
import userSubscriptionRoutes from '../modules/userSubscriptions/routes';
import featureRoutes from '../modules/features/routes';
import paymentAccountRoutes from '../modules/paymentAccounts/routes';
import vietqrBankRoutes from '../modules/vietqrBanks/routes';
import paymentTransactionRoutes from '../modules/paymentTransactions/routes';
import paymentMethodRoutes from '../modules/paymentMethods/routes';

const apiRouter = express.Router();

// Đăng ký các route con
apiRouter.use('/auth', authRoutes);
apiRouter.use('/blogs', blogRoutes);
apiRouter.use('/blog-types', blogTypeRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/upload', uploadRoutes);
apiRouter.use('/membership-plans', membershipPlanRoutes);
apiRouter.use('/subscriptions', userSubscriptionRoutes);
apiRouter.use('/features', featureRoutes);
apiRouter.use('/payment-accounts', paymentAccountRoutes);
apiRouter.use('/vietqr-banks', vietqrBankRoutes);
apiRouter.use('/payment-transactions', paymentTransactionRoutes);
apiRouter.use('/payment-methods', paymentMethodRoutes);

export default apiRouter;



