const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.get('/general', protect, authorize('SUPER_ADMIN', 'ADMIN'), analyticsController.getGeneralAnalytics);

module.exports = router;
