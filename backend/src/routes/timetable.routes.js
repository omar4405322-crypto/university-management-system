const express = require('express');
const router = express.Router();
const timetableController = require('../controllers/timetable.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.use(protect);

router.get('/', timetableController.getTimetables);
router.get('/:id', timetableController.getTimetableById);

// Admin only routes
router.post('/', authorize('SUPER_ADMIN', 'ADMIN'), timetableController.createTimetable);
router.put('/:id', authorize('SUPER_ADMIN', 'ADMIN'), timetableController.updateTimetable);
router.delete('/:id', authorize('SUPER_ADMIN', 'ADMIN'), timetableController.deleteTimetable);

module.exports = router;
