const express = require('express');
const router = express.Router();
const coursesController = require('../controllers/courses.controller');
const roleMiddleware = require('../middleware/role.middleware');

// GET routes are accessible by all authenticated users
router.get('/', coursesController.getAllCourses);
router.get('/:id', coursesController.getCourseById);

// Modification routes are ADMIN only
router.post('/', roleMiddleware(['ADMIN']), coursesController.createCourse);
router.put('/:id', roleMiddleware(['ADMIN']), coursesController.updateCourse);
router.delete('/:id', roleMiddleware(['ADMIN']), coursesController.deleteCourse);

module.exports = router;
