import { generateMonthlyLedger } from './service.js';

export async function generateLedgerController(req, res) {
  try {
    const { studentId, month } = req.body || {};
    if (!studentId || !month) return res.status(400).json({ success: false, message: 'studentId and month required' });
    const data = await generateMonthlyLedger(studentId, month);
    res.json({ success: true, data });
  } catch (error) {
    if (String(error?.message || '').includes('STUDENT_NOT_FOUND')) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    res.status(500).json({ success: false, message: 'Ledger generation failed' });
  }
}
