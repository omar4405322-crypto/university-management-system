import express from 'express';
const router = express.Router();
import * as doctorsController from '../controllers/doctors.controller';
import { resetDoctorPassword } from '../controllers/doctors.controller';
import { authorize } from '../middleware/auth.middleware';
import { doctorValidation, idParamValidation } from '../validations/academic.validation';
import validate from '../middleware/validate.middleware';

// All doctor routes are restricted
router.use(authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'));

router.get('/stats', doctorsController.getDoctorStats);
router.get('/', doctorsController.getAllDoctors);
router.get('/:id', idParamValidation, validate, doctorsController.getDoctorById);
router.post('/', doctorValidation, validate, doctorsController.createDoctor);
router.put(
  '/:id',
  [...idParamValidation, ...doctorValidation],
  validate,
  doctorsController.updateDoctor
);
router.patch('/:id/reset-password', authorize('SUPER_ADMIN', 'ADMIN'), resetDoctorPassword);
router.delete('/:id', idParamValidation, validate, doctorsController.deleteDoctor);

export default router;
