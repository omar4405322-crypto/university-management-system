const express = require('express');
const router = express.Router();
const studentsController = require('../controllers/students.controller');
const { authorize } = require('../middleware/auth.middleware');
const { studentValidation, idParamValidation } = require('../validations/academic.validation');
const validate = require('../middleware/validate.middleware');

// All student routes are ADMIN/SUPER_ADMIN only
router.use(authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'));

router.get('/', studentsController.getAllStudents);
router.patch('/:id/status', idParamValidation, validate, studentsController.toggleStudentStatus);
router.get('/:id', idParamValidation, validate, studentsController.getStudentById);
router.post('/', studentValidation, validate, studentsController.createStudent);
router.put('/:id', [...idParamValidation, ...studentValidation], validate, studentsController.updateStudent);
router.delete('/:id', idParamValidation, validate, studentsController.deleteStudent);

module.exports = router;
