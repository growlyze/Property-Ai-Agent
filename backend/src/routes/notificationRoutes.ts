import { Router } from 'express';
import NotificationController from '../controllers/notificationController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// All notification routes require a logged-in user; per-row and per-role
// checks live in the controller.
router.get('/', authMiddleware.protect, NotificationController.listNotifications);
router.post('/', authMiddleware.protect, NotificationController.createNotification);
router.put('/:id/read', authMiddleware.protect, NotificationController.markAsRead);
router.get('/:userId', authMiddleware.protect, NotificationController.getNotifications);

export default router;
