const express = require('express');
const router = express.Router();
const schedulesController = require('../controllers/schedules.controller');
const roleMiddleware = require('../middleware/role.middleware');

router.get('/', schedulesController.getAllSchedules);
router.get('/week', schedulesController.getWeeklyTimetable);

router.post('/', roleMiddleware(['ADMIN']), schedulesController.createSchedule);
router.put('/:id', roleMiddleware(['ADMIN']), schedulesController.updateSchedule);
router.delete('/:id', roleMiddleware(['ADMIN']), schedulesController.deleteSchedule);

module.exports = router;
