const express = require('express');
const { protect } = require('../middleware/auth.middleware.js');
const { getTranscript } = require('../controllers/transcript.controller.js');

const router = express.Router();

router.get('/:studentId', protect, getTranscript);

module.exports = router;
