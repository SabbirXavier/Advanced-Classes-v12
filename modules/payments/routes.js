import { Router } from 'express';
import { handlePaymentController } from './controller.js';

const router = Router();
router.post('/collect', handlePaymentController);

export default router;
