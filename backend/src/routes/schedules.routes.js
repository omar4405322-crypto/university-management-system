const express = require('express');
const router = express.Router();
const schedulesController = require('../controllers/schedules.controller');
const { authorize } = require('../middleware/auth.middleware');

router.get('/', schedulesController.getAllSchedules);
router.get('/week', schedulesController.getWeeklyTimetable);

router.post('/', authorize('SUPER_ADMIN', 'ADMIN'), schedulesController.createSchedule);
router.put('/:id', authorize('SUPER_ADMIN', 'ADMIN'), schedulesController.updateSchedule);
router.delete('/:id', authorize('SUPER_ADMIN', 'ADMIN'), schedulesController.deleteSchedule);

module.exports = router;
