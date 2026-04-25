import { Router } from 'express';
import { generateLedgerController } from './controller.js';

const router = Router();
router.post('/generate-monthly-ledger', generateLedgerController);

export default router;
