import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { getTenantSummary } from '../controllers/tenantPortal.controller';

/**
 * /api/tenant/me — the signed-in tenant's own portal data. Mounted before the
 * tenant sentiment analytics router, which shares the `/api/tenant` prefix.
 */
const router = Router();

router.get('/summary', authMiddleware.protect, getTenantSummary);

export default router;
