import { createItem, getItems, updateItem } from '../../db';
import { calculateStudentPricing } from '../pricing/service.js';
import { createAuditLog } from '../audit/service.js';

function toMonthKey(dateInput) {
  const date = dateInput ? new Date(dateInput) : new Date();
  if (Number.isNaN(date.getTime())) throw new Error('INVALID_DATE');
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function buildAcademicMonths(enrollmentDate) {
  const startDate = enrollmentDate ? new Date(enrollmentDate) : new Date();
  if (Number.isNaN(startDate.getTime())) throw new Error('INVALID_ENROLLMENT_DATE');

  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth() + 1;
  const targetAprilYear = startMonth <= 4 ? startYear : startYear + 1;

  const months = [];
  let year = startYear;
  let month = startMonth;
  while (year < targetAprilYear || (year === targetAprilYear && month <= 4)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
  }

  return months;
}

function computeStatus(paidAmount, finalPayable) {
  const paid = Number(paidAmount || 0);
  const payable = Number(finalPayable || 0);
  if (payable <= 0 || paid >= payable) return 'CLEARED';
  if (paid > 0) return 'PARTIAL';
  return 'PENDING';
}

export async function generateYearLedgerForStudent(studentId, options = {}) {
  const { actor_id = 'system', overwrite = false } = options;
  const enrollments = await getItems('enrollments');
  const enrollment = enrollments.find((e) => e.id === studentId);
  if (!enrollment) throw new Error('STUDENT_NOT_FOUND');

  const startDate = enrollment.enrollmentDate || enrollment.joinedAt || enrollment.createdAt || new Date().toISOString();
  const months = buildAcademicMonths(startDate);
  const allLedgers = await getItems('student_fee_ledger_v2');
  const studentLedgers = allLedgers.filter((l) => l.student_id === studentId);

  const created = [];
  const updated = [];

  for (const month of months) {
    const pricing = await calculateStudentPricing({
      subjects: enrollment.subjects || [],
      enrollment,
      month,
      isAdvance: false,
      paymentDate: startDate
    });

    const existing = studentLedgers.find((l) => l.month === month);
    const paidAmount = Number(existing?.paid_amount || 0);
    const finalPayable = Number(pricing.finalAmount || 0);

    const baseDoc = {
      student_id: studentId,
      month,
      base_amount: pricing.baseAmount,
      subject_total: pricing.subjectTotal,
      offer_discount: pricing.offerDiscount,
      advance_discount: pricing.advanceDiscountApplied,
      advance_discount_visible: pricing.advanceDiscountPotential,
      advance_discount_expired: pricing.advanceDiscountPotential > 0 && pricing.advanceDiscountApplied <= 0,
      net_payable: finalPayable,
      paid_amount: paidAmount,
      balance: Math.max(0, finalPayable - paidAmount),
      status: computeStatus(paidAmount, finalPayable),
      verification_state: existing?.verification_state || 'UNVERIFIED',
      access_eligible: existing?.access_eligible || false,
      receipt_links: existing?.receipt_links || [],
      generated_by: 'fee_engine_v2',
      snapshot_json: {
        enrollmentId: enrollment.id,
        studentName: enrollment.name,
        grade: enrollment.grade,
        batch: enrollment.batch || enrollment.grade,
        subjects: enrollment.subjects || [],
        generatedAt: new Date().toISOString(),
        pricing
      },
      updatedAt: new Date().toISOString()
    };

    if (existing) {
      if (!overwrite) continue;
      await updateItem('student_fee_ledger_v2', existing.id, { ...existing, ...baseDoc });
      updated.push(month);
      continue;
    }

    const ledgerId = await createItem('student_fee_ledger_v2', {
      ...baseDoc,
      createdAt: new Date().toISOString()
    });
    created.push({ ledgerId, month });
  }

  await createAuditLog({
    actor_id,
    action: 'FEE_LEDGER_YEAR_GENERATED',
    entity: 'student_fee_ledger_v2',
    entity_id: studentId,
    payload: { months_count: months.length, created_count: created.length, updated_count: updated.length }
  });

  return { studentId, months, created, updated };
}

export async function getStudentLedger(studentId) {
  const rows = await getItems('student_fee_ledger_v2');
  return rows
    .filter((r) => r.student_id === studentId)
    .sort((a, b) => String(a.month).localeCompare(String(b.month)));
}

export async function listLedgerByFilters(filters = {}) {
  const { batch, month, status, verification_state } = filters;
  const rows = await getItems('student_fee_ledger_v2');
  return rows.filter((row) => {
    if (month && row.month !== month) return false;
    if (status && row.status !== status) return false;
    if (verification_state && row.verification_state !== verification_state) return false;
    if (batch) {
      const rowBatch = row.snapshot_json?.batch || row.snapshot_json?.grade;
      if (rowBatch !== batch) return false;
    }
    return true;
  });
}

export async function upsertVerifiedStudentsForBatch({ batch, month, actor_id = 'system' }) {
  if (!batch || !month) throw new Error('BATCH_AND_MONTH_REQUIRED');
  const rows = await listLedgerByFilters({ batch, month });
  const verifiedStudentIds = rows
    .filter((r) => r.status === 'CLEARED' && r.verification_state === 'VERIFIED')
    .map((r) => r.student_id);

  const existing = (await getItems('batch_verified_students_v2')).find((b) => b.batch === batch && b.month === month);
  const payload = {
    batch,
    month,
    student_ids: Array.from(new Set(verifiedStudentIds)),
    recalculatedAt: new Date().toISOString(),
    source: 'fee_engine_v2'
  };

  if (existing) {
    await updateItem('batch_verified_students_v2', existing.id, { ...existing, ...payload });
  } else {
    await createItem('batch_verified_students_v2', payload);
  }

  await createAuditLog({
    actor_id,
    action: 'BATCH_VERIFIED_STUDENTS_RECALCULATED',
    entity: 'batch_verified_students_v2',
    entity_id: `${batch}:${month}`,
    payload
  });

  return payload;
}

export async function generateMonthlyLedger(studentId, month) {
  return generateYearLedgerForStudent(studentId, { overwrite: false, actor_id: 'legacy_generateMonthlyLedger' });
}

export { buildAcademicMonths, toMonthKey };
