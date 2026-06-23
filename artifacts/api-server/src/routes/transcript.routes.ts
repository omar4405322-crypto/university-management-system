import express from 'express';
import { protect } from '../middleware/auth.middleware';
import { getTranscript } from '../controllers/transcript.controller';

const router = express.Router();

router.get('/:studentId', protect, getTranscript);

export default router;
