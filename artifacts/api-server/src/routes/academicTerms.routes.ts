import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import validate from '../middleware/validate.middleware';
import auditLog from '../middleware/audit.middleware';
import {
  createAcademicTerm,
  getAcademicTerms,
  getCurrentTerm,
  updateAcademicTerm,
  getTermSwitchPreview,
  activateAcademicTerm,
} from '../controllers/academicTerms.controller';
import {
  academicTermValidation,
  termIdParamValidation,
} from '../validations/academicTerms.validation';

const router = Router();

router.post(
  '/',
  protect,
  authorize('SUPER_ADMIN'),
  academicTermValidation,
  validate,
  auditLog('ACADEMIC_TERM_CREATED', 'AcademicTerm'),
  createAcademicTerm
);

router.get('/current', protect, getCurrentTerm);
router.get('/', protect, getAcademicTerms);

router.post(
  '/:id/activate-preview',
  protect,
  authorize('SUPER_ADMIN'),
  termIdParamValidation,
  validate,
  getTermSwitchPreview
);

router.get(
  '/:id/switch-preview',
  protect,
  authorize('SUPER_ADMIN'),
  termIdParamValidation,
  validate,
  getTermSwitchPreview
);

router.post(
  '/:id/switch-preview',
  protect,
  authorize('SUPER_ADMIN'),
  termIdParamValidation,
  validate,
  getTermSwitchPreview
);

router.post(
  '/:id/activate',
  protect,
  authorize('SUPER_ADMIN'),
  termIdParamValidation,
  validate,
  activateAcademicTerm
);

router.patch(
  '/:id',
  protect,
  authorize('SUPER_ADMIN'),
  termIdParamValidation,
  validate,
  auditLog('ACADEMIC_TERM_UPDATED', 'AcademicTerm'),
  updateAcademicTerm
);

export default router;
