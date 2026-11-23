import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import {
  createQuote,
  createWorkOrder,
  getWorkOrder,
  listWorkOrders,
  updateQuoteStatus,
  updateWorkOrderStatus,
} from '../controllers/workOrder.controller';

/**
 * /api/work-orders — role-scoped work orders (see controllers/workOrder.controller.ts).
 * Role and row checks live in the controller; the router only authenticates.
 */
const router = Router();

router.get('/', authMiddleware.protect, listWorkOrders);
router.post('/', authMiddleware.protect, createWorkOrder);
// Declared before `/:id` routes so "quotes" is never captured as an id.
router.patch('/quotes/:quoteId', authMiddleware.protect, updateQuoteStatus);
router.get('/:id', authMiddleware.protect, getWorkOrder);
router.patch('/:id/status', authMiddleware.protect, updateWorkOrderStatus);
router.post('/:id/quotes', authMiddleware.protect, createQuote);

export default router;
