import { generateWhatsAppLink, renderReminderTemplate } from './service.js';

export async function generateReminderLinkController(req, res) {
  const { phone, student_name, pending_amount, due_month } = req.body || {};
  const message = renderReminderTemplate({ student_name, pending_amount, due_month });
  res.json({ success: true, link: generateWhatsAppLink(phone, message), message });
}
