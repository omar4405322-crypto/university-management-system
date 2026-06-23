// @ts-ignore
import { Router } from 'express';
const router = Router();
router.get('/', (req: any, res: any) => res.json({ data: [] }));
export default router;
