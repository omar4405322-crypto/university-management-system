import express from 'express';
const router = express.Router();
import * as studentsController from '../controllers/students.controller.js';
import { resetStudentPassword } from '../controllers/students.controller.js';
import { authorize } from '../middleware/auth.middleware.js';
import { studentValidation, idParamValidation } from '../validations/academic.validation.js';
import validate from '../middleware/validate.middleware.js';

// All student routes are ADMIN/SUPER_ADMIN only
router.use(authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'));

router.get('/', studentsController.getAllStudents);
router.patch('/:id/status', idParamValidation, validate, studentsController.toggleStudentStatus);
router.get('/:id', idParamValidation, validate, studentsController.getStudentById);
router.post('/', studentValidation, validate, studentsController.createStudent);
router.put('/:id', [...idParamValidation, ...studentValidation], validate, studentsController.updateStudent);
router.patch(
  '/:id/reset-password',
  authorize('SUPER_ADMIN', 'ADMIN'),
  resetStudentPassword
);
router.delete('/:id', idParamValidation, validate, studentsController.deleteStudent);

export default router;
