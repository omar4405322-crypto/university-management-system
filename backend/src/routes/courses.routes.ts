import express from 'express';
const router = express.Router();
import * as coursesController from '../controllers/courses.controller.js';
import { authorize } from '../middleware/auth.middleware.js';
import { courseValidation, idParamValidation } from '../validations/academic.validation.js';
import validate from '../middleware/validate.middleware.js';

// GET routes are accessible by all authenticated users
router.get('/', coursesController.getAllCourses);
router.get('/:id/roster', idParamValidation, validate, coursesController.getCourseRoster);
router.get('/:id', idParamValidation, validate, coursesController.getCourseById);

// Modification routes are restricted
router.post('/', authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'), courseValidation, validate, coursesController.createCourse);
router.put('/:id', authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'), [...idParamValidation, ...courseValidation], validate, coursesController.updateCourse);
router.delete('/:id', authorize('SUPER_ADMIN', 'ADMIN'), idParamValidation, validate, coursesController.deleteCourse);

export default router;
