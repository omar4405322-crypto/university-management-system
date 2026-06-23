import express from 'express';
const router = express.Router();
import * as taController from '../controllers/teaching-assistants.controller';
import { authorize } from '../middleware/auth.middleware';
import { teachingAssistantValidation, idParamValidation } from '../validations/academic.validation';
import validate from '../middleware/validate.middleware';

// All TA routes are restricted
router.use(authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'));

router.get('/', taController.getAllTeachingAssistants);
router.get('/stats', authorize('SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'), taController.getTeachingAssistantStats);
router.get('/:id', idParamValidation, validate, taController.getTeachingAssistantById);
router.post('/', teachingAssistantValidation, validate, taController.createTeachingAssistant);
router.put(
  '/:id',
  [...idParamValidation, ...teachingAssistantValidation],
  validate,
  taController.updateTeachingAssistant
);
router.delete('/:id', idParamValidation, validate, taController.deleteTeachingAssistant);

export default router;
