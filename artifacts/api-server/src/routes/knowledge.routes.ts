import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import knowledgeUpload from '../middleware/knowledgeUpload.middleware';
import {
  listDocumentsHandler,
  getDocumentByIdHandler,
  createDocumentHandler,
  uploadVersionHandler,
  activateVersionHandler,
  archiveDocumentHandler,
  downloadDocumentHandler,
  queryKnowledgeHandler,
} from '../controllers/knowledge.controller';

const router = Router();

// Query knowledge base (authenticated users within their authorized scope)
router.post('/query', protect, queryKnowledgeHandler);

// Download document file (authenticated users)
router.get('/documents/:id/download', protect, downloadDocumentHandler);
router.get('/documents/:id/download/:versionId', protect, downloadDocumentHandler);

// Admin knowledge management endpoints
router.get(
  '/documents',
  protect,
  authorize('ADMIN', 'SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  listDocumentsHandler
);

router.get(
  '/documents/:id',
  protect,
  authorize('ADMIN', 'SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  getDocumentByIdHandler
);

router.post(
  '/documents',
  protect,
  authorize('ADMIN', 'SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  knowledgeUpload.single('file'),
  createDocumentHandler
);

router.post(
  '/documents/:id/versions',
  protect,
  authorize('ADMIN', 'SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  knowledgeUpload.single('file'),
  uploadVersionHandler
);

router.patch(
  '/documents/:id/activate/:versionId',
  protect,
  authorize('ADMIN', 'SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  activateVersionHandler
);

router.patch(
  '/documents/:id/archive',
  protect,
  authorize('ADMIN', 'SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  archiveDocumentHandler
);

export default router;
