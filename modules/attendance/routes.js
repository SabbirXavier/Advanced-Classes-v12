import { Router } from 'express';
import { createAttendanceController, editAttendanceController } from './controller.js';

const router = Router();
router.post('/mark', createAttendanceController);
router.post('/edit', editAttendanceController);

export default router;
