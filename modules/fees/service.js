import { createItem, getItems } from '../../db';
import { calculateStudentPricing } from '../pricing/service.js';

export async function generateMonthlyLedger(studentId, month) {
  const enrollments = await getItems('enrollments');
  const enrollment = enrollments.find((e) => e.id === studentId);
  if (!enrollment) throw new Error('STUDENT_NOT_FOUND');

  const pricing = await calculateStudentPricing({
    subjects: enrollment.subjects || [],
    isAdvance: false,
  });

  const paidAmount = 0;
  const snapshot = {
    enrollmentId: enrollment.id,
    studentName: enrollment.name,
    grade: enrollment.grade,
    subjects: enrollment.subjects || [],
    pricing,
    generatedAt: new Date().toISOString(),
  };

  const ledgerEntry = {
    student_id: studentId,
    month,
    base_amount: pricing.baseAmount,
    discount_amount: pricing.comboDiscount + pricing.advanceDiscount,
    net_payable: pricing.finalAmount,
    paid_amount: paidAmount,
    balance: Math.max(0, pricing.finalAmount - paidAmount),
    status: pricing.finalAmount <= 0 ? 'PAID' : 'UNPAID',
    snapshot_json: snapshot,
    createdAt: new Date().toISOString(),
  };

  const ledgerId = await createItem('student_fee_ledger_v2', ledgerEntry);
  return { ledgerId, ...ledgerEntry };
}
