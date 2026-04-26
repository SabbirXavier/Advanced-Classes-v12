import {
  generateYearLedgerForStudent,
  getStudentLedger,
  listLedgerByFilters,
  upsertVerifiedStudentsForBatch
} from './service.js';

export async function generateLedgerController(req, res) {
  try {
    const { studentId, overwrite = false, actor_id } = req.body || {};
    if (!studentId) return res.status(400).json({ success: false, message: 'studentId required' });
    const data = await generateYearLedgerForStudent(studentId, { overwrite: Boolean(overwrite), actor_id });
    res.json({ success: true, data });
  } catch (error) {
    if (String(error?.message || '').includes('STUDENT_NOT_FOUND')) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    res.status(500).json({ success: false, message: 'Ledger generation failed' });
  }
}

export async function getStudentLedgerController(req, res) {
  try {
    const { studentId } = req.params;
    if (!studentId) return res.status(400).json({ success: false, message: 'studentId required' });
    const data = await getStudentLedger(studentId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load student ledger' });
  }
}

export async function listLedgerController(req, res) {
  try {
    const data = await listLedgerByFilters(req.query || {});
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to list ledgers' });
  }
}

export async function recalculateBatchVerificationController(req, res) {
  try {
    const { batch, month, actor_id } = req.body || {};
    const data = await upsertVerifiedStudentsForBatch({ batch, month, actor_id });
    res.json({ success: true, data });
  } catch (error) {
    const msg = String(error?.message || 'FAILED');
    if (msg.includes('BATCH_AND_MONTH_REQUIRED')) {
      return res.status(400).json({ success: false, message: 'batch and month required' });
    }
    res.status(500).json({ success: false, message: 'Failed to recalculate verified students' });
  }
}
