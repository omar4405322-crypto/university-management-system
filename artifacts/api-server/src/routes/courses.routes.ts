import express from 'express';
const router = express.Router();
import * as coursesController from '../controllers/courses.controller';
import { authorize } from '../middleware/auth.middleware';
import { courseValidation, idParamValidation } from '../validations/academic.validation';
import validate from '../middleware/validate.middleware';
import materialUpload from '../middleware/materialUpload.middleware';

// GET routes are accessible by all authenticated users
router.get('/', coursesController.getAllCourses);
router.get('/:id/roster', idParamValidation, validate, coursesController.getCourseRoster);
router.get('/:id', idParamValidation, validate, coursesController.getCourseById);

// Course Publication & Material routes (Authorization is checked inside controller per course assignment)
router.patch('/:id/toggle-publication', coursesController.toggleCoursePublication);
router.post('/:id/materials', materialUpload.single('file'), coursesController.uploadCourseMaterial);
router.patch('/:id/materials/:materialId/toggle', coursesController.toggleMaterialPublication);
router.delete('/:id/materials/:materialId', coursesController.deleteCourseMaterial);

// Modification routes are restricted
router.post(
  '/',
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  courseValidation,
  validate,
  coursesController.createCourse
);
router.put(
  '/:id',
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  [...idParamValidation, ...courseValidation],
  validate,
  coursesController.updateCourse
);
router.delete(
  '/:id',
  authorize('SUPER_ADMIN', 'ADMIN'),
  idParamValidation,
  validate,
  coursesController.deleteCourse
);

export default router;
