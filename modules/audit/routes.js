import { Router } from 'express';
import { createAuditController } from './controller.js';

const router = Router();
router.post('/log', createAuditController);

export default router;
