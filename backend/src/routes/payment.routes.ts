import { Router } from 'express';
import * as paymentController from '../controllers/payment.controller';
import * as paymentRecords from '../controllers/paymentRecord.controller';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Rent payment records for the dashboard Payments page (tenancy-scoped in the
// controller). These paths are disjoint from the approval routes below and
// from the Stripe router (routes/paymentRoutes.ts) mounted on the same prefix.
router.get('/overdue', authMiddleware.protect, paymentRecords.listOverduePayments);
router.get('/', authMiddleware.protect, paymentRecords.listPaymentRecords);
router.post('/', authMiddleware.protect, paymentRecords.createPaymentRecord);
router.put('/:id', authMiddleware.protect, paymentRecords.updatePaymentRecord);
router.delete('/:id', authMiddleware.protect, paymentRecords.deletePaymentRecord);

// Payment approvals. Operator-only and tenancy-scoped in the controller (an
// OWNER-only gate here used to 403 admins and property managers).
router.get(
  '/transactions/pending',
  authMiddleware.protect,
  paymentController.getPendingTransactions
);

router.get(
  '/vendor-payments/pending',
  authMiddleware.protect,
  paymentController.getPendingVendorPayments
);

router.post(
  '/transactions/:id/approve',
  authMiddleware.protect,
  paymentController.approveTransaction
);

router.post(
  '/transactions/:id/reject',
  authMiddleware.protect,
  paymentController.rejectTransaction
);

router.post(
  '/vendor-payments/:id/approve',
  authMiddleware.protect,
  paymentController.approveVendorPayment
);

router.post(
  '/vendor-payments/:id/reject',
  authMiddleware.protect,
  paymentController.rejectVendorPayment
);

export default router;
