import { createItem, getItems } from '../../db';
import { createAuditLog } from '../audit/service.js';

export async function createAttendanceRecord(data) {
  const record = {
    faculty_id: data.faculty_id,
    subject: data.subject || 'ALL',
    batch_id: data.batch_id || 'ALL',
    date: data.date,
    status: data.status || 'present',
    edited_by: data.edited_by || data.faculty_id,
    edit_reason: data.edit_reason || 'initial_mark',
    createdAt: new Date().toISOString()
  };
  const id = await createItem('attendance_records', record);
  return { id, ...record };
}

export async function editAttendanceRecordImmutable({ record_id, actor_id, status, reason }) {
  const records = await getItems('attendance_records');
  const existing = records.find((r) => r.id === record_id);
  if (!existing) throw new Error('RECORD_NOT_FOUND');

  const revised = {
    ...existing,
    status: status || existing.status,
    edited_by: actor_id,
    edit_reason: reason || 'edited',
    revision_of: existing.id,
    createdAt: new Date().toISOString()
  };

  const newId = await createItem('attendance_records', revised);
  await createAuditLog({
    actor_id,
    action: 'ATTENDANCE_EDIT',
    entity: 'attendance_records',
    entity_id: newId,
    payload: { revision_of: existing.id, status: revised.status }
  });

  return { id: newId, ...revised };
}
