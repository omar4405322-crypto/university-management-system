import express from 'express';
const router = express.Router();
import * as studentGroupsController from '../controllers/studentGroups.controller';
import { protect, authorize } from '../middleware/auth.middleware';

router.use(protect);

router.get(
  '/departments/:departmentId/groups',
  studentGroupsController.getGroupsByDepartment
);

router.post(
  '/departments/:departmentId/groups/auto-divide',
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  studentGroupsController.autoDivideStudents
);

router.post(
  '/groups/:groupId/split',
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  studentGroupsController.splitGroup
);

router.delete(
  '/groups/:groupId',
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  studentGroupsController.deleteGroup
);

router.put(
  '/students/:studentId/group',
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  studentGroupsController.manualOverrideGroup
);

export default router;
