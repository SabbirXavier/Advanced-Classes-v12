import { Router } from 'express';
import { calculatePricingController } from './controller.js';

const router = Router();
router.post('/calculate', calculatePricingController);

export default router;
