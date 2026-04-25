import { getItems } from '../../db';
import { generateWhatsAppLink, renderReminderTemplate } from '../notifications/service.js';

export async function getFeeReport(filters = {}) {
  const enrollments = await getItems('enrollments');
  const ledger = await getItems('student_fee_ledger_v2');

  const byStudent = new Map();
  ledger.forEach((l) => {
    const existing = byStudent.get(l.student_id) || [];
    existing.push(l);
    byStudent.set(l.student_id, existing);
  });

  const reportRows = enrollments.map((s) => {
    const ledgers = byStudent.get(s.id) || [];
    const latest = ledgers.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0];
    const due = latest ? Number(latest.balance || 0) : Math.max(0, Number(s.totalFee || 0) - Number(s.discount || 0) - Number(s.totalPaid || 0));
    return {
      student_id: s.id,
      student_name: s.name,
      class: s.grade || 'NA',
      batch: s.batchName || 'NA',
      status: due <= 0 ? 'PAID' : 'UNPAID',
      due_amount: due,
      whatsapp: s.whatsapp || ''
    };
  }).filter((r) => {
    if (filters.class && filters.class !== 'ALL' && r.class !== filters.class) return false;
    if (filters.batch && filters.batch !== 'ALL' && r.batch !== filters.batch) return false;
    if (filters.student && !String(r.student_name || '').toLowerCase().includes(String(filters.student).toLowerCase())) return false;
    if (filters.status && filters.status !== 'ALL' && r.status !== filters.status) return false;
    if (filters.due_amount_min != null && Number(r.due_amount) < Number(filters.due_amount_min)) return false;
    if (filters.due_amount_max != null && Number(r.due_amount) > Number(filters.due_amount_max)) return false;
    return true;
  });

  return reportRows.map((r) => ({
    ...r,
    reminder_link: generateWhatsAppLink(r.whatsapp, renderReminderTemplate({
      student_name: r.student_name,
      pending_amount: r.due_amount,
      due_month: filters.month || new Date().toISOString().slice(0, 7)
    }))
  }));
}
