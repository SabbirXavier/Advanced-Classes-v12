import { Router } from 'express';
import { feeReportController } from './controller.js';

const router = Router();
router.get('/fees', feeReportController);

export default router;
