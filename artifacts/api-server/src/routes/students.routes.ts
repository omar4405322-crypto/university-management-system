import express from 'express';
import rateLimit from 'express-rate-limit';
const router = express.Router();
import * as studentsController from '../controllers/students.controller';
import { resetStudentPassword } from '../controllers/students.controller';
import { protect, authorize } from '../middleware/auth.middleware';
import { studentValidation, idParamValidation } from '../validations/academic.validation';
import validate from '../middleware/validate.middleware';

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many password reset attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Statistics endpoint accessible by STUDENT (for self/me) and DOCTOR/ADMIN (scoped)
router.get('/:id/statistics', protect, studentsController.getStudentStatistics);

// All other student management routes are ADMIN/SUPER_ADMIN only
router.use(authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'));

router.get('/', studentsController.getAllStudents);
router.patch('/:id/status', idParamValidation, validate, studentsController.toggleStudentStatus);
router.get('/:id', idParamValidation, validate, studentsController.getStudentById);
router.post('/', studentValidation, validate, studentsController.createStudent);
router.put(
  '/:id',
  [...idParamValidation, ...studentValidation],
  validate,
  studentsController.updateStudent
);
router.patch('/:id/reset-password', passwordResetLimiter, authorize('SUPER_ADMIN', 'ADMIN'), resetStudentPassword);
router.delete('/:id', idParamValidation, validate, studentsController.deleteStudent);

export default router;
