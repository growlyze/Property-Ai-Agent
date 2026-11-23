import { Router } from 'express';
import { vendorController } from '../controllers/vendor.controller';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.get('/', authMiddleware.protect, vendorController.listVendors);
// `/me` MUST precede `/:id`, or "me" would be captured as a vendor id.
router.get('/me', authMiddleware.protect, vendorController.getMe);
router.get('/:id', authMiddleware.protect, vendorController.getProfile);
router.put(
  '/:id',
  authMiddleware.protect,
  authMiddleware.checkRole(['ADMIN', 'PROPERTY_MANAGER']),
  vendorController.updateProfile
);

export default router;
