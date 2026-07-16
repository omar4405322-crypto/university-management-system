import express from 'express';
const router = express.Router({ mergeParams: true });
import * as overridesController from '../controllers/overrides.controller';
import { authorize } from '../middleware/auth.middleware';

import validate from '../middleware/validate.middleware';
import { overrideValidation } from '../validations/functional.validation';

// Note: This router will be mounted at /api/schedules
// And inside schedules.routes.ts, it will be mounted like:
// router.use('/:slotId/overrides', overridesRouter);
// router.use('/overrides', overridesRouter); // For paths that don't need slotId

router.post(
  '/',
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'DOCTOR', 'TEACHING_ASSISTANT'),
  overrideValidation,
  validate,
  overridesController.createOverride
);

router.get(
  '/',
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'DOCTOR', 'TEACHING_ASSISTANT', 'STUDENT'),
  overridesController.getOverrides
);

router.patch(
  '/:overrideId',
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'DOCTOR', 'TEACHING_ASSISTANT'),
  overrideValidation,
  validate,
  overridesController.updateOverride
);

router.delete(
  '/:overrideId',
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'DOCTOR', 'TEACHING_ASSISTANT'),
  overridesController.deleteOverride
);

export default router;
