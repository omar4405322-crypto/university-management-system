const express = require('express');
const router = express.Router();
const examsController = require('../controllers/exams.controller');
const roleMiddleware = require('../middleware/role.middleware');

router.get('/', examsController.getAllExams);
router.get('/upcoming', examsController.getUpcomingExams);

router.post('/', roleMiddleware(['ADMIN']), examsController.createExam);
router.put('/:id', roleMiddleware(['ADMIN']), examsController.updateExam);
router.delete('/:id', roleMiddleware(['ADMIN']), examsController.deleteExam);

module.exports = router;
