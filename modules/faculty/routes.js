import { Router } from 'express';
import { placeholderController } from './controller.js';
const router = Router();
router.get('/health', placeholderController);
export default router;
