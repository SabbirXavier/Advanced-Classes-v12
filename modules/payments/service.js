import { createItem, getItems, updateItem } from '../../db';
import { createAuditLog } from '../audit/service.js';
import { upsertVerifiedStudentsForBatch } from '../fees/service.js';

function sortByMonth(rows = []) {
  return [...rows].sort((a, b) => String(a.month || '').localeCompare(String(b.month || '')));
}

function clampAmount(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

export async function submitPaymentRequest(payload = {}) {
  const {
    student_id,
    amount,
    transaction_id,
    screenshot_url,
    allocations = [],
    selected_month,
    payment_mode = 'manual_transfer',
    actor_id = student_id || 'student',
    notes
  } = payload;

  if (!student_id || !amount || !transaction_id || !screenshot_url) throw new Error('INVALID_PAYMENT_REQUEST_PAYLOAD');

  const request = {
    student_id,
    amount: clampAmount(amount),
    transaction_id,
    screenshot_url,
    selected_month,
    allocations,
    payment_mode,
    notes: notes || '',
    verification_status: 'PENDING',
    submitted_at: new Date().toISOString(),
    source: 'fee_engine_v2'
  };

  const requestId = await createItem('fee_payment_requests_v2', request);
  await createAuditLog({
    actor_id,
    action: 'PAYMENT_REQUEST_SUBMITTED',
    entity: 'fee_payment_requests_v2',
    entity_id: requestId,
    payload: { student_id, amount: request.amount, selected_month }
  });

  return { requestId, ...request };
}

function allocateToLedgerRows(ledgerRows, totalAmount, manualAllocations = []) {
  let remaining = clampAmount(totalAmount);
  const allocationMap = new Map();

  for (const row of manualAllocations) {
    const month = row?.month;
    const amount = clampAmount(row?.amount);
    if (!month || amount <= 0 || remaining <= 0) continue;
    const ledger = ledgerRows.find((l) => l.month === month);
    if (!ledger) continue;
    const maxAllowed = Math.max(0, Number(ledger.net_payable || 0) - Number(ledger.paid_amount || 0));
    const assigned = Math.min(maxAllowed, amount, remaining);
    if (assigned > 0) {
      allocationMap.set(month, (allocationMap.get(month) || 0) + assigned);
      remaining -= assigned;
    }
  }

  for (const ledger of ledgerRows) {
    if (remaining <= 0) break;
    const month = ledger.month;
    const already = Number(allocationMap.get(month) || 0);
    const maxAllowed = Math.max(0, Number(ledger.net_payable || 0) - Number(ledger.paid_amount || 0) - already);
    if (maxAllowed <= 0) continue;
    const assigned = Math.min(maxAllowed, remaining);
    allocationMap.set(month, already + assigned);
    remaining -= assigned;
  }

  return { allocationMap, unallocated_amount: remaining };
}

export async function verifyPaymentRequest(payload = {}) {
  const {
    request_id,
    approve = true,
    actor_id = 'admin',
    override_allocations = [],
    reject_reason = ''
  } = payload;

  if (!request_id) throw new Error('REQUEST_ID_REQUIRED');

  const [requests, ledgers] = await Promise.all([
    getItems('fee_payment_requests_v2'),
    getItems('student_fee_ledger_v2')
  ]);

  const request = requests.find((r) => r.id === request_id);
  if (!request) throw new Error('REQUEST_NOT_FOUND');
  if (request.verification_status !== 'PENDING') throw new Error('REQUEST_ALREADY_PROCESSED');

  if (!approve) {
    await updateItem('fee_payment_requests_v2', request_id, {
      ...request,
      verification_status: 'REJECTED',
      verified_by: actor_id,
      verified_at: new Date().toISOString(),
      reject_reason
    });

    await createAuditLog({
      actor_id,
      action: 'PAYMENT_REQUEST_REJECTED',
      entity: 'fee_payment_requests_v2',
      entity_id: request_id,
      payload: { reject_reason }
    });

    return { request_id, status: 'REJECTED' };
  }

  const studentLedgers = sortByMonth(ledgers.filter((l) => l.student_id === request.student_id));
  if (studentLedgers.length === 0) throw new Error('LEDGER_NOT_FOUND');

  const manual = override_allocations.length ? override_allocations : (request.allocations || []);
  const { allocationMap, unallocated_amount } = allocateToLedgerRows(studentLedgers, request.amount, manual);

  const allocationRows = [];
  const receiptMonths = [];
  let receiptBalance = 0;

  for (const ledger of studentLedgers) {
    const allocated = Number(allocationMap.get(ledger.month) || 0);
    if (allocated <= 0) continue;

    const nextPaid = Number(ledger.paid_amount || 0) + allocated;
    const nextBalance = Math.max(0, Number(ledger.net_payable || 0) - nextPaid);
    const status = nextBalance <= 0 ? 'CLEARED' : (nextPaid > 0 ? 'PARTIAL' : 'PENDING');
    const verificationState = status === 'CLEARED' ? 'VERIFIED' : 'UNVERIFIED';

    const updatedLedger = {
      ...ledger,
      paid_amount: nextPaid,
      balance: nextBalance,
      status,
      verification_state: verificationState,
      access_eligible: verificationState === 'VERIFIED',
      updatedAt: new Date().toISOString()
    };

    await updateItem('student_fee_ledger_v2', ledger.id, updatedLedger);
    allocationRows.push({ month: ledger.month, amount: allocated, ledger_id: ledger.id, status, balance: nextBalance });
    receiptMonths.push(ledger.month);
    receiptBalance += nextBalance;

    const studentBatch = ledger.snapshot_json?.batch || ledger.snapshot_json?.grade;
    if (studentBatch) {
      await upsertVerifiedStudentsForBatch({ batch: studentBatch, month: ledger.month, actor_id });
    }
  }

  const receipt = {
    institute_name: 'Advanced Classes',
    student_id: request.student_id,
    student_name: studentLedgers[0]?.snapshot_json?.studentName || 'Student',
    batch: studentLedgers[0]?.snapshot_json?.batch || studentLedgers[0]?.snapshot_json?.grade || '',
    months_covered: receiptMonths,
    amount_paid: clampAmount(request.amount),
    balance_remaining: receiptBalance,
    transaction_id: request.transaction_id,
    payment_mode: request.payment_mode,
    verification_status: 'VERIFIED',
    receipt_date: new Date().toISOString(),
    disclaimer: 'Computer generated receipt',
    source_request_id: request_id
  };
  const receiptId = await createItem('fee_receipts_v2', receipt);

  await updateItem('fee_payment_requests_v2', request_id, {
    ...request,
    verification_status: 'VERIFIED',
    verified_by: actor_id,
    verified_at: new Date().toISOString(),
    final_allocations: allocationRows,
    receipt_id: receiptId,
    unallocated_amount
  });

  await createAuditLog({
    actor_id,
    action: 'PAYMENT_REQUEST_VERIFIED',
    entity: 'fee_payment_requests_v2',
    entity_id: request_id,
    payload: { allocationRows, receiptId, unallocated_amount }
  });

  return { request_id, receipt_id: receiptId, allocations: allocationRows, unallocated_amount };
}

export async function listPaymentRequests(filters = {}) {
  const rows = await getItems('fee_payment_requests_v2');
  return rows.filter((r) => {
    if (filters.status && r.verification_status !== filters.status) return false;
    if (filters.student_id && r.student_id !== filters.student_id) return false;
    return true;
  });
}
