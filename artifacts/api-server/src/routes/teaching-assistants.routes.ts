import { Router } from 'express';
import {
  getAllTeachingAssistants,
  getTeachingAssistantById,
  createTeachingAssistant,
  updateTeachingAssistant,
  deleteTeachingAssistant,
  resetTeachingAssistantPassword,
  getTAStats,
  getSuggestedTeachingAssistants,
  assignTACourse,
  unassignTACourse,
} from '../controllers/teachingAssistants.controller';
import { protect, authorize } from '../middleware/auth.middleware';
import { passwordResetLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();

router.use(protect);
router.use(
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'DOCTOR')
);

router.get('/stats', getTAStats);
router.get('/suggested', getSuggestedTeachingAssistants);
router.get('/', getAllTeachingAssistants);
router.get('/:id', getTeachingAssistantById);

router.use(authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'));
router.post('/', createTeachingAssistant);
router.post('/:id/assign-course', assignTACourse);
router.delete('/:id/courses/:courseId', unassignTACourse);
router.put('/:id', updateTeachingAssistant);
router.delete('/:id', deleteTeachingAssistant);
router.patch('/:id/reset-password', passwordResetLimiter, resetTeachingAssistantPassword);

export default router;
