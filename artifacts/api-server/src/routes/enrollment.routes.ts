import express from 'express';
import { param, body } from 'express-validator';
import validate from '../middleware/validate.middleware';
import { protect, authorize } from '../middleware/auth.middleware';
import {
  enrollStudent,
  withdrawStudent,
  getEnrollments,
  updateGrade,
  setCustomAbsenceThreshold,
  createExemptionPeriod,
  getExemptionPeriods,
  deleteExemptionPeriod,
} from '../controllers/enrollment.controller';

const router = express.Router();

const adminRoles = authorize('COLLEGE_ADMIN', 'SUPER_ADMIN', 'DEPARTMENT_ADMIN');

router.post('/', protect, adminRoles, enrollStudent);

router.get('/', protect, getEnrollments);

router.delete(
  '/:id',
  protect,
  adminRoles,
  withdrawStudent
);

router.patch(
  '/:id/grade',
  protect,
  authorize('DOCTOR', 'COLLEGE_ADMIN', 'SUPER_ADMIN'),
  updateGrade
);

router.patch(
  '/:id/absence-threshold',
  protect,
  adminRoles,
  [
    param('id').isInt().withMessage('Invalid enrollment ID'),
    body('customAbsenceThreshold').custom((val) => {
      if (val === null || val === undefined) return true;
      if (typeof val !== 'number' || isNaN(val) || val < 0 || val > 100) {
        throw new Error('customAbsenceThreshold must be null or a number between 0 and 100');
      }
      return true;
    }),
  ],
  validate,
  setCustomAbsenceThreshold
);

router.post(
  '/:id/exemption-periods',
  protect,
  adminRoles,
  [
    param('id').isInt().withMessage('Invalid enrollment ID'),
    body('startDate').isISO8601().withMessage('startDate must be a valid ISO date'),
    body('endDate').isISO8601().withMessage('endDate must be a valid ISO date'),
    body('reason').isString().trim().notEmpty().withMessage('reason is required'),
  ],
  validate,
  createExemptionPeriod
);

router.get(
  '/:id/exemption-periods',
  protect,
  [param('id').isInt().withMessage('Invalid enrollment ID')],
  validate,
  getExemptionPeriods
);

router.delete(
  '/:id/exemption-periods/:exemptionId',
  protect,
  adminRoles,
  [
    param('id').isInt().withMessage('Invalid enrollment ID'),
    param('exemptionId').isInt().withMessage('Invalid exemption ID'),
  ],
  validate,
  deleteExemptionPeriod
);

export default router;

