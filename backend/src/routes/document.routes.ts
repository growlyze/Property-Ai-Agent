import { Router } from 'express';
import DocumentController from '../controllers/document.controller';
import { listDocuments } from '../controllers/documentList.controller';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Both routes require a logged-in user. generate-lease was previously
// unauthenticated, so anyone could drive the AI lease generator.
router.get('/', authMiddleware.protect, listDocuments);
router.post('/generate-lease', authMiddleware.protect, DocumentController.generateLease);

export default router;
