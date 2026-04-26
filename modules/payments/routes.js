import { Router } from 'express';
import {
  listPaymentRequestsController,
  submitPaymentRequestController,
  verifyPaymentRequestController
} from './controller.js';

const router = Router();
router.post('/requests', submitPaymentRequestController);
router.get('/requests', listPaymentRequestsController);
router.post('/requests/verify', verifyPaymentRequestController);

export default router;
