import express from 'express';
import { globalSearch } from '../controllers/search.controller';
import { protect } from '../middleware/auth.middleware';

const router = express.Router();

router.use(protect);
router.get('/', globalSearch);

export default router;
