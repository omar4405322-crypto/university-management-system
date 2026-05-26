const express = require('express');
const { 
  getAllColleges, 
  getCollegeById, 
  createCollege, 
  updateCollege, 
  deleteCollege 
} = require('../controllers/college.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/', getAllColleges);
router.get('/:id', getCollegeById);

// Admin only routes
router.post('/', protect, authorize('SUPER_ADMIN'), createCollege);
router.put('/:id', protect, authorize('SUPER_ADMIN'), updateCollege);
router.delete('/:id', protect, authorize('SUPER_ADMIN'), deleteCollege);

module.exports = router;
