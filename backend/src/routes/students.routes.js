const express = require('express');
const router = express.Router();
const studentsController = require('../controllers/students.controller');
const roleMiddleware = require('../middleware/role.middleware');

// All student routes are ADMIN only
router.use(roleMiddleware(['ADMIN']));

router.get('/', studentsController.getAllStudents);
router.get('/:id', studentsController.getStudentById);
router.post('/', studentsController.createStudent);
router.put('/:id', studentsController.updateStudent);
router.delete('/:id', studentsController.deleteStudent);

module.exports = router;
