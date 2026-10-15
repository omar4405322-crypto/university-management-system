import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import validate from '../middleware/validate.middleware';
import auditLog from '../middleware/audit.middleware';
import {
  createAcademicYear,
  getAcademicYears,
  updateAcademicYear,
} from '../controllers/academicTerms.controller';
import {
  academicYearValidation,
  yearIdParamValidation,
} from '../validations/academicTerms.validation';

const router = Router();

router.post(
  '/',
  protect,
  authorize('SUPER_ADMIN'),
  academicYearValidation,
  validate,
  auditLog('ACADEMIC_YEAR_CREATED', 'AcademicYear'),
  createAcademicYear
);

router.get('/', protect, getAcademicYears);

router.patch(
  '/:id',
  protect,
  authorize('SUPER_ADMIN'),
  yearIdParamValidation,
  validate,
  auditLog('ACADEMIC_YEAR_UPDATED', 'AcademicYear'),
  updateAcademicYear
);

export default router;
