import { Router } from 'express';
import { generateReminderLinkController } from './controller.js';

const router = Router();
router.post('/whatsapp-link', generateReminderLinkController);

export default router;
