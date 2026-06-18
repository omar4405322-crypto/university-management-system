import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import { getTranscript } from '../controllers/transcript.controller.js';

const router = express.Router();

router.get('/:studentId', protect, getTranscript);

export default router;
