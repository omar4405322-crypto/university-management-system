import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import validateZod from '../middleware/validateZod.middleware';
import { uploadExamFile } from '../middleware/upload.middleware';
import * as ctrl from '../controllers/examSession.controller';
import {
  createExamSessionSchema,
  updateExamSessionSchema,
  updateStatusSchema,
  addQuestionSchema,
  submitAnswersSchema,
  gradeSubmissionSchema,
} from '../validations/examSession.validation';

const router = Router();

// All routes require authentication
router.use(protect);

// ─── Session CRUD ─────────────────────────────────────────────────────────────
router.get('/', ctrl.getExamSessions);

router.post(
  '/',
  authorize('DOCTOR', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN'),
  validateZod(createExamSessionSchema),
  ctrl.createExamSession,
);

router.get('/:id', ctrl.getExamSession);

router.put(
  '/:id',
  authorize('DOCTOR', 'SUPER_ADMIN'),
  validateZod(updateExamSessionSchema),
  ctrl.updateExamSession,
);

router.delete('/:id', authorize('DOCTOR', 'SUPER_ADMIN'), ctrl.deleteExamSession);

router.put(
  '/:id/status',
  authorize('DOCTOR', 'SUPER_ADMIN'),
  validateZod(updateStatusSchema),
  ctrl.updateExamSessionStatus,
);

// ─── Question Management ──────────────────────────────────────────────────────
router.post(
  '/:id/questions',
  authorize('DOCTOR', 'SUPER_ADMIN'),
  validateZod(addQuestionSchema),
  ctrl.addQuestion,
);

router.put('/:id/questions/:questionId', authorize('DOCTOR', 'SUPER_ADMIN'), ctrl.updateQuestion);

router.delete(
  '/:id/questions/:questionId',
  authorize('DOCTOR', 'SUPER_ADMIN'),
  ctrl.deleteQuestion,
);

// ─── Student Actions ──────────────────────────────────────────────────────────
router.post('/:id/start', authorize('STUDENT'), ctrl.startExam);

router.post(
  '/:id/submit',
  authorize('STUDENT'),
  validateZod(submitAnswersSchema),
  ctrl.submitExam,
);

router.get('/:id/my-result', authorize('STUDENT'), ctrl.getMyResult);

// ─── File Upload (FILE_UPLOAD question type) ──────────────────────────────────
router.post(
  '/:id/answers/:answerId/upload',
  authorize('STUDENT'),
  uploadExamFile.single('file'),
  ctrl.uploadAnswerFile,
);

// ─── Grading ──────────────────────────────────────────────────────────────────
router.get(
  '/:id/submissions',
  authorize('DOCTOR', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN'),
  ctrl.getSubmissions,
);

router.put(
  '/:id/submissions/:submissionId/grade',
  authorize('DOCTOR', 'SUPER_ADMIN'),
  validateZod(gradeSubmissionSchema),
  ctrl.gradeSubmission,
);

// ─── Anti-Cheat / Violations ──────────────────────────────────────────────────
router.post('/:id/violations', authorize('STUDENT'), ctrl.reportViolation);

router.get(
  '/:id/submissions/:submissionId/violations',
  authorize('DOCTOR', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN'),
  ctrl.getSubmissionViolations,
);

export default router;
