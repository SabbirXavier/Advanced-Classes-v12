import { Router } from 'express';
import {
  generateLedgerController,
  getStudentLedgerController,
  listLedgerController,
  recalculateBatchVerificationController
} from './controller.js';

const router = Router();
router.post('/generate-year-ledger', generateLedgerController);
router.get('/student/:studentId', getStudentLedgerController);
router.get('/ledger', listLedgerController);
router.post('/verified-students/recalculate', recalculateBatchVerificationController);

export default router;
