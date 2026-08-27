import express from 'express';
import authRoutes from './authRoutes';
import blogRoutes from './blogRoutes';
import blogTypeRoutes from './blogTypeRoutes';
import userRoutes from './userRoutes';
import uploadRoutes from './uploadRoutes';
import membershipPlanRoutes from './membershipPlanRoutes';
import userSubscriptionRoutes from './userSubscriptionRoutes';
import featureRoutes from './featureRoutes';
import paymentAccountRoutes from './paymentAccountRoutes';
import vietqrBankRoutes from './vietqrBankRoutes';
import paymentTransactionRoutes from './paymentTransactionRoutes';
import paymentMethodRoutes from './paymentMethodRoutes';

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



