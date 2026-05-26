const express = require('express');
const router = express.Router();
const doctorsController = require('../controllers/doctors.controller');
const roleMiddleware = require('../middleware/role.middleware');

// All doctor routes are ADMIN only for now
router.use(roleMiddleware(['ADMIN']));

router.get('/', doctorsController.getAllDoctors);
router.get('/:id', doctorsController.getDoctorById);
router.post('/', doctorsController.createDoctor);
router.put('/:id', doctorsController.updateDoctor);
router.delete('/:id', doctorsController.deleteDoctor);

module.exports = router;
