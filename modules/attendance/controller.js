import { createAttendanceRecord, editAttendanceRecordImmutable } from './service.js';

export async function createAttendanceController(req, res) {
  try {
    const data = await createAttendanceRecord(req.body || {});
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, message: 'Attendance create failed' });
  }
}

export async function editAttendanceController(req, res) {
  try {
    const data = await editAttendanceRecordImmutable(req.body || {});
    res.json({ success: true, data });
  } catch (error) {
    if (String(error?.message || '').includes('RECORD_NOT_FOUND')) return res.status(404).json({ success: false, message: 'Attendance record not found' });
    res.status(500).json({ success: false, message: 'Attendance edit failed' });
  }
}
