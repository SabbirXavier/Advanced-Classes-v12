import { createItem, getItems, updateItem } from '../../db';
import { createAuditLog } from '../audit/service.js';

export async function handlePayment(payment) {
  const { student_id, ledger_id, amount, idempotency_key, actor_id = 'system' } = payment;
  if (!student_id || !ledger_id || !amount || !idempotency_key) throw new Error('INVALID_PAYMENT_PAYLOAD');

  const existingPayments = await getItems('fee_payments_v2');
  const duplicate = existingPayments.find((p) => p.idempotency_key === idempotency_key);
  if (duplicate) {
    return { duplicate: true, payment: duplicate };
  }

  const allLedgers = await getItems('student_fee_ledger_v2');
  const currentLedger = allLedgers.find((l) => l.id === ledger_id);
  if (!currentLedger) throw new Error('LEDGER_NOT_FOUND');

  const paymentDoc = {
    student_id,
    ledger_id,
    amount: Number(amount),
    idempotency_key,
    createdAt: new Date().toISOString(),
    source: 'backend_v2'
  };

  const paymentId = await createItem('fee_payments_v2', paymentDoc);

  const nextPaid = Number(currentLedger.paid_amount || 0) + Number(amount);
  const nextBalance = Math.max(0, Number(currentLedger.net_payable || 0) - nextPaid);

  const recalculatedLedgerSnapshot = {
    ...currentLedger,
    paid_amount: nextPaid,
    balance: nextBalance,
    status: nextBalance <= 0 ? 'PAID' : (nextPaid > 0 ? 'PARTIAL' : 'UNPAID'),
    revision_of: currentLedger.id,
    createdAt: new Date().toISOString()
  };

  // Immutable financial trail: insert revised snapshot, no in-place update.
  const revisedLedgerId = await createItem('student_fee_ledger_v2', recalculatedLedgerSnapshot);

  // Backward-compatible old system write
  const enrollments = await getItems('enrollments');
  const enrollment = enrollments.find((e) => e.id === student_id);
  if (enrollment) {
    const paymentRecord = {
      id: paymentId,
      amount: Number(amount),
      date: new Date().toISOString(),
      status: 'verified',
      transactionId: idempotency_key,
      ledgerRef: revisedLedgerId,
      source: 'fee_payments_v2'
    };
    await updateItem('enrollments', student_id, {
      ...enrollment,
      paymentHistory: [...(enrollment.paymentHistory || []), paymentRecord],
      totalPaid: Number(enrollment.totalPaid || 0) + Number(amount),
      feeStatus: nextBalance <= 0 ? 'Paid' : 'Pending'
    });
  }

  await createAuditLog({
    actor_id,
    action: 'PAYMENT_ACCEPTED_V2',
    entity: 'fee_payments_v2',
    entity_id: paymentId,
    payload: { student_id, ledger_id, revisedLedgerId, amount }
  });

  return { paymentId, revisedLedgerId, nextBalance };
}
