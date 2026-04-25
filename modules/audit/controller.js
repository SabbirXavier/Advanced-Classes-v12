import { createAuditLog } from './service.js';

export async function createAuditController(req, res) {
  try {
    const id = await createAuditLog(req.body || {});
    res.json({ success: true, id });
  } catch {
    res.status(500).json({ success: false, message: 'Audit write failed' });
  }
}
