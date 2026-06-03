const express = require('express');
const router = express.Router();
const coursesController = require('../controllers/courses.controller');
const { authorize } = require('../middleware/auth.middleware');
const { courseValidation, idParamValidation } = require('../validations/academic.validation');
const validate = require('../middleware/validate.middleware');

// GET routes are accessible by all authenticated users
router.get('/', coursesController.getAllCourses);
router.get('/:id/roster', idParamValidation, validate, coursesController.getCourseRoster);
router.get('/:id', idParamValidation, validate, coursesController.getCourseById);

// Modification routes are restricted
router.post('/', authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'), courseValidation, validate, coursesController.createCourse);
router.put('/:id', authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'), [...idParamValidation, ...courseValidation], validate, coursesController.updateCourse);
router.delete('/:id', authorize('SUPER_ADMIN', 'ADMIN'), idParamValidation, validate, coursesController.deleteCourse);

module.exports = router;
