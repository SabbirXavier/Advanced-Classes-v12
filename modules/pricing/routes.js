import { Router } from 'express';
import { calculatePricingController, previewYearPricingController } from './controller.js';

const router = Router();
router.post('/calculate', calculatePricingController);
router.post('/preview-year', previewYearPricingController);

export default router;
