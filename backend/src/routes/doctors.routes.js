const express = require('express');
const router = express.Router();
const doctorsController = require('../controllers/doctors.controller');
const { resetDoctorPassword } = require('../controllers/doctors.controller');
const { authorize } = require('../middleware/auth.middleware');
const { doctorValidation, idParamValidation } = require('../validations/academic.validation');
const validate = require('../middleware/validate.middleware');

// All doctor routes are restricted
router.use(authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'));

router.get('/stats', doctorsController.getDoctorStats);
router.get('/', doctorsController.getAllDoctors);
router.get('/:id', idParamValidation, validate, doctorsController.getDoctorById);
router.post('/', doctorValidation, validate, doctorsController.createDoctor);
router.put('/:id', [...idParamValidation, ...doctorValidation], validate, doctorsController.updateDoctor);
router.patch(
  '/:id/reset-password',
  authorize('SUPER_ADMIN', 'ADMIN'),
  resetDoctorPassword
);
router.delete('/:id', idParamValidation, validate, doctorsController.deleteDoctor);

module.exports = router;
