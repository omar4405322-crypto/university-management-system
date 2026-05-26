const express = require('express');
const { 
  createTask, 
  getTasks, 
  submitTask, 
  gradeSubmission, 
  getTaskSubmissions 
} = require('../controllers/task.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(protect);

router.post('/', authorize('DOCTOR'), createTask);
router.get('/', getTasks);
router.post('/:id/submit', authorize('STUDENT'), submitTask);
router.put('/:id/submissions/:sid/grade', authorize('DOCTOR'), gradeSubmission);
router.get('/:id/submissions', authorize('DOCTOR', 'SUPER_ADMIN'), getTaskSubmissions);

module.exports = router;
