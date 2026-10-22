import express from 'express';
const router = express.Router();
import * as coursesController from '../controllers/courses.controller';
import { authorize } from '../middleware/auth.middleware';
import { courseValidation, courseUpdateValidation, idParamValidation } from '../validations/academic.validation';
import validate from '../middleware/validate.middleware';
import materialUpload from '../middleware/materialUpload.middleware';
import {
  gradeStructureGetValidation,
  gradeStructurePutValidation,
} from '../validations/gradeStructure.validation';
import {
  gradebookGetValidation,
  gradebookPostDraftValidation,
} from '../validations/gradebook.validation';

// GET routes are accessible by all authenticated users
router.get('/', coursesController.getAllCourses);
router.get(
  '/:id/roster',
  authorize(
    'SUPER_ADMIN',
    'ADMIN',
    'COLLEGE_ADMIN',
    'DEPARTMENT_ADMIN',
    'DOCTOR',
    'TEACHING_ASSISTANT'
  ),
  idParamValidation,
  validate,
  coursesController.getCourseRoster
);
router.get(
  '/:courseId/grade-structure',
  gradeStructureGetValidation,
  validate,
  coursesController.getGradeStructure
);
router.put(
  '/:courseId/grade-structure',
  gradeStructurePutValidation,
  validate,
  coursesController.updateGradeStructure
);
router.get(
  '/:courseId/gradebook',
  gradebookGetValidation,
  validate,
  coursesController.getGradebook
);
router.post(
  '/:courseId/gradebook/draft',
  gradebookPostDraftValidation,
  validate,
  coursesController.saveGradebookDraft
);
router.post(
  '/:courseId/gradebook/publish',
  authorize('DOCTOR'),
  gradebookGetValidation,
  validate,
  coursesController.publishGradebook
);
router.post(
  '/:courseId/gradebook/correct',
  authorize('DOCTOR'),
  gradebookGetValidation,
  validate,
  coursesController.correctGradebook
);
router.get('/:id', idParamValidation, validate, coursesController.getCourseById);

// Course Publication & Material routes (Authorization is checked inside controller per course assignment)
router.patch('/:id/toggle-publication', coursesController.toggleCoursePublication);
router.post(
  '/:id/materials',
  idParamValidation,
  validate,
  coursesController.requireCourseMaterialManager,
  materialUpload.single('file'),
  coursesController.uploadCourseMaterial
);
router.patch('/:id/materials/:materialId/toggle', coursesController.toggleMaterialPublication);
router.delete('/:id/materials/:materialId', coursesController.deleteCourseMaterial);
router.get('/:id/materials/:materialId/download', coursesController.downloadCourseMaterial);

// Modification routes are restricted
router.post(
  '/',
  authorize('SUPER_ADMIN'),
  courseValidation,
  validate,
  coursesController.createCourse
);
router.put(
  '/:id',
  authorize('SUPER_ADMIN'),
  [...idParamValidation, ...courseUpdateValidation],
  validate,
  coursesController.updateCourse
);
router.delete(
  '/:id',
  authorize('SUPER_ADMIN'),
  idParamValidation,
  validate,
  coursesController.deleteCourse
);

export default router;
