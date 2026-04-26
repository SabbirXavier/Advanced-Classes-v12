import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';

export interface SubjectPricing {
  id?: string;
  subject: string;
  originalPrice: number;
  discount: number;
  finalPrice: number;
  grade?: string;
  grades?: string[];
  isActive?: boolean;
}

export interface PricingRule {
  id?: string;
  name?: string;
  isActive?: boolean;
  priority?: number;
  validFrom?: string;
  validTo?: string;
  grades?: string[];
  grade?: string;
  type?: 'combo' | 'advance' | 'seasonal' | string;
  conditions?: {
    minSubjects?: number;
    includesAllSubjects?: string[];
    includesAnySubjects?: string[];
    advanceDays?: number;
  };
  action?: {
    mode?: 'flat' | 'percentage' | 'fixed_total' | 'per_subject';
    value?: number;
    maxDiscount?: number;
  };
}

export interface PricingQuoteInput {
  subjects: string[];
  grade?: string;
  feeItems: SubjectPricing[];
  paymentDate?: Date;
  enrollmentDate?: Date;
}

export interface PricingQuote {
  totalBaseAmount: number;
  discountedAmount: number;
  discount: number;
  appliedRuleIds: string[];
}

export interface MonthlyLedgerInput {
  studentId: string;
  studentName: string;
  month: string; // YYYY-MM
  amount: number;
  paymentId: string;
  transactionId?: string;
  mode?: string;
}

export interface MonthlyAllocationInput {
  month: string;
  amount: number;
}

const monthKeyFromDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const parseMonthKey = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return null;
  return new Date(y, m - 1, 1);
};
const addMonths = (month: string, delta: number) => {
  const parsed = parseMonthKey(month);
  if (!parsed) return month;
  parsed.setMonth(parsed.getMonth() + delta);
  return monthKeyFromDate(parsed);
};
const monthsBetween = (startMonth: string, endMonth: string) => {
  const start = parseMonthKey(startMonth);
  const end = parseMonthKey(endMonth);
  if (!start || !end || start > end) return [];
  const out: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    out.push(monthKeyFromDate(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
};
const toDateMaybe = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const normalizePricing = (item: any): SubjectPricing => {
  const originalPrice = Number(item.originalPrice || 0);
  const discount = Number(item.discount || 0);
  return {
    id: item.id,
    subject: item.subject || '',
    originalPrice,
    discount,
    finalPrice: Number(item.finalPrice ?? originalPrice - discount),
    grade: item.grade || '',
    grades: item.grades || (item.grade ? [item.grade] : []),
    isActive: item.isActive ?? true,
  };
};

const dateInRange = (date: Date, start?: string, end?: string) => {
  if (start) {
    const startDate = new Date(start);
    if (!Number.isNaN(startDate.getTime()) && date < startDate) {
      return false;
    }
  }
  if (end) {
    const endDate = new Date(end);
    if (!Number.isNaN(endDate.getTime()) && date > endDate) {
      return false;
    }
  }
  return true;
};

const applyRuleToAmount = (amount: number, subjects: string[], rule: PricingRule) => {
  const mode = rule.action?.mode || 'flat';
  const value = Number(rule.action?.value || 0);
  const maxDiscount = Number(rule.action?.maxDiscount || Number.POSITIVE_INFINITY);

  let discount = 0;
  switch (mode) {
    case 'percentage':
      discount = (amount * value) / 100;
      break;
    case 'fixed_total':
      return Math.max(0, value);
    case 'per_subject':
      discount = subjects.length * value;
      break;
    case 'flat':
    default:
      discount = value;
      break;
  }

  const boundedDiscount = Math.min(discount, maxDiscount, amount);
  return Math.max(0, amount - boundedDiscount);
};

const ruleMatches = (rule: PricingRule, subjects: string[], grade?: string, paymentDate = new Date(), enrollmentDate = new Date()) => {
  if (rule.isActive === false) return false;

  const grades = Array.isArray(rule.grades)
    ? rule.grades
    : (rule.grade ? [rule.grade] : []);
  if (grade && grades.length > 0 && !grades.includes(grade)) {
    return false;
  }

  if (!dateInRange(paymentDate, rule.validFrom, rule.validTo)) {
    return false;
  }

  if (rule.conditions?.minSubjects && subjects.length < Number(rule.conditions.minSubjects)) {
    return false;
  }

  if (rule.conditions?.includesAllSubjects?.length) {
    const needsAll = rule.conditions.includesAllSubjects.every((s) => subjects.includes(s));
    if (!needsAll) return false;
  }

  if (rule.conditions?.includesAnySubjects?.length) {
    const hasAny = rule.conditions.includesAnySubjects.some((s) => subjects.includes(s));
    if (!hasAny) return false;
  }

  if (rule.type === 'advance' && rule.conditions?.advanceDays) {
    const msDiff = enrollmentDate.getTime() - paymentDate.getTime();
    const dayDiff = msDiff / (1000 * 60 * 60 * 24);
    if (dayDiff < Number(rule.conditions.advanceDays)) {
      return false;
    }
  }

  return true;
};

export const pricingService = {
  getEnrollmentStartMonth(enrollment: any) {
    const startDate = toDateMaybe(
      enrollment?.enrollmentDate
      || enrollment?.joinedAt
      || enrollment?.admissionDate
      || enrollment?.createdAt
      || enrollment?.date
    ) || new Date();
    return monthKeyFromDate(startDate);
  },

  getStudentMonthlyFee(enrollment: any) {
    const explicitMonthly = Number(enrollment?.monthlyFee || 0);
    if (explicitMonthly > 0) return explicitMonthly;
    const totalFee = Number(enrollment?.totalFee || 0);
    const discount = Number(enrollment?.discount || 0);
    return Math.max(0, totalFee - discount);
  },

  async ensureMonthlyLedger(studentId: string, studentName: string, enrollment: any, uptoMonth: string) {
    const startMonth = this.getEnrollmentStartMonth(enrollment);
    const monthFee = this.getStudentMonthlyFee(enrollment);
    const months = monthsBetween(startMonth, uptoMonth);
    if (months.length === 0) return [];
    const snap = await getDocs(query(collection(db, 'student_monthly_fee_ledger'), where('studentId', '==', studentId)));
    const existing = new Map<string, any>();
    snap.docs.forEach((d) => {
      const data: any = d.data();
      existing.set(data.month || d.id.split('_').slice(1).join('_'), { id: d.id, ...data });
    });
    const batch = writeBatch(db);
    let hasWrites = false;
    months.forEach((month) => {
      const docId = `${studentId}_${month}`;
      const found = existing.get(month);
      if (!found) {
        hasWrites = true;
        batch.set(doc(db, 'student_monthly_fee_ledger', docId), {
          studentId,
          studentName,
          month,
          totalFee: monthFee,
          paidAmount: 0,
          dueAmount: monthFee,
          status: 'Pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } else {
        const currentTotalFee = Number(found.totalFee || 0);
        const currentPaid = Number(found.paidAmount || 0);
        const currentDue = Number(found.dueAmount ?? Math.max(0, currentTotalFee - currentPaid));
        const nextTotalFee = currentTotalFee > 0 ? currentTotalFee : monthFee;
        const nextDue = Math.max(0, currentTotalFee > 0 ? currentDue : (nextTotalFee - currentPaid));
        const normalizedStatus = nextDue <= 0 ? 'Cleared' : (currentPaid > 0 ? 'Partial' : 'Pending');
        if (currentTotalFee <= 0 || Number.isNaN(currentDue)) {
          hasWrites = true;
          batch.set(doc(db, 'student_monthly_fee_ledger', docId), {
            totalFee: nextTotalFee,
            dueAmount: nextDue,
            status: found.status || normalizedStatus,
            updatedAt: serverTimestamp(),
          }, { merge: true });
        }
      }
    });
    if (hasWrites) await batch.commit();
    const refreshed = await getDocs(query(collection(db, 'student_monthly_fee_ledger'), where('studentId', '==', studentId)));
    return refreshed.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  async allocatePaymentToMonths(input: {
    studentId: string;
    studentName: string;
    enrollment: any;
    amount: number;
    transactionId?: string;
    paymentId?: string;
    mode?: string;
    allocations?: MonthlyAllocationInput[];
    paidBy?: string;
    title?: string;
    notes?: string;
    screenshotUrl?: string;
  }) {
    const totalAmount = Number(input.amount || 0);
    if (totalAmount <= 0) throw new Error('Amount should be greater than zero');
    const currentMonth = monthKeyFromDate(new Date());
    await this.ensureMonthlyLedger(input.studentId, input.studentName, input.enrollment, addMonths(currentMonth, 1));
    const snap = await getDocs(query(collection(db, 'student_monthly_fee_ledger'), where('studentId', '==', input.studentId)));
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
      .sort((a, b) => String(a.month || '').localeCompare(String(b.month || '')));

    const rowMap = new Map(rows.map((r) => [r.month, r]));
    const applied: Array<{ month: string; appliedAmount: number; beforeDue: number; afterDue: number; status: string }> = [];
    let remaining = totalAmount;

    const applyOnMonth = (month: string, requested?: number) => {
      const row = rowMap.get(month);
      if (!row || remaining <= 0) return;
      const totalFee = Number(row.totalFee || this.getStudentMonthlyFee(input.enrollment));
      const paidAmount = Number(row.paidAmount || 0);
      const computedDue = Math.max(0, Number(row.dueAmount ?? (totalFee - paidAmount)));
      if (computedDue <= 0) return;
      const cap = requested !== undefined ? Math.max(0, Number(requested || 0)) : computedDue;
      const use = Math.min(computedDue, cap, remaining);
      if (use <= 0) return;
      const nextPaid = paidAmount + use;
      const nextDue = Math.max(0, computedDue - use);
      row.paidAmount = nextPaid;
      row.dueAmount = nextDue;
      row.totalFee = totalFee;
      row.status = nextDue <= 0 ? 'Cleared' : 'Partial';
      applied.push({ month, appliedAmount: use, beforeDue: computedDue, afterDue: nextDue, status: row.status });
      remaining -= use;
    };

    (input.allocations || []).forEach((a) => applyOnMonth(a.month, a.amount));
    rows.forEach((r) => applyOnMonth(r.month));

    const paymentRef = doc(collection(db, 'fee_payments'));
    const receiptRef = doc(collection(db, 'fee_receipts'));
    const batch = writeBatch(db);
    batch.set(paymentRef, {
      paymentId: paymentRef.id,
      studentId: input.studentId,
      studentName: input.studentName,
      amount: totalAmount,
      mode: input.mode || 'manual',
      txId: input.transactionId || '',
      linkedPaymentHistoryId: input.paymentId || '',
      allocations: applied,
      excessAmount: remaining,
      createdAt: serverTimestamp(),
      createdBy: input.paidBy || input.studentId,
    });
    rows.forEach((row) => {
      batch.set(doc(db, 'student_monthly_fee_ledger', row.id), {
        totalFee: Number(row.totalFee || this.getStudentMonthlyFee(input.enrollment)),
        paidAmount: Number(row.paidAmount || 0),
        dueAmount: Math.max(0, Number(row.dueAmount || 0)),
        status: row.status || 'Pending',
        lastPaymentId: paymentRef.id,
        lastTransactionId: input.transactionId || '',
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });
    batch.set(receiptRef, {
      receiptId: receiptRef.id,
      studentId: input.studentId,
      studentName: input.studentName,
      amount: totalAmount,
      allocations: applied,
      excessAmount: remaining,
      transactionId: input.transactionId || '',
      title: input.title || `Fee Receipt - ${input.studentName}`,
      notes: input.notes || '',
      screenshotUrl: input.screenshotUrl || '',
      disclaimer: 'Computer generated receipt. No signature required.',
      createdAt: serverTimestamp(),
      createdBy: input.paidBy || input.studentId,
    });
    await batch.commit();

    const outstanding = rows.reduce((sum, row) => sum + Math.max(0, Number(row.dueAmount || 0)), 0);
    return { receiptId: receiptRef.id, paymentId: paymentRef.id, allocations: applied, excessAmount: remaining, outstanding };
  },

  async getSubjectPricing(): Promise<SubjectPricing[]> {
    const plansSnap = await getDocs(query(collection(db, 'pricing_plans'), where('isActive', '!=', false)));
    if (!plansSnap.empty) {
      return plansSnap.docs
        .map((d) => normalizePricing({ id: d.id, ...d.data() }))
        .sort((a, b) => a.subject.localeCompare(b.subject));
    }

    // Backward-compatible fallback
    const oldFeesSnap = await getDocs(collection(db, 'fees'));
    return oldFeesSnap.docs
      .map((d) => normalizePricing({ id: d.id, ...d.data() }))
      .sort((a, b) => a.subject.localeCompare(b.subject));
  },

  async getPricingRules(): Promise<PricingRule[]> {
    const rulesSnap = await getDocs(query(collection(db, 'pricing_rules'), where('isActive', '!=', false)));
    return rulesSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as PricingRule)
      .sort((a, b) => Number(a.priority || 999) - Number(b.priority || 999));
  },

  async calculateQuote(input: PricingQuoteInput): Promise<PricingQuote> {
    const selectedFees = input.feeItems.filter((f) => input.subjects.includes(f.subject));
    const totalBaseAmount = selectedFees.reduce((sum, f) => sum + (Number(f.originalPrice) || 0), 0);
    const baseFinalAmount = selectedFees.reduce((sum, f) => sum + (Number(f.finalPrice) || 0), 0);

    const rules = await this.getPricingRules();
    let discountedAmount = baseFinalAmount;
    const appliedRuleIds: string[] = [];

    for (const rule of rules) {
      if (!ruleMatches(rule, input.subjects, input.grade, input.paymentDate, input.enrollmentDate)) {
        continue;
      }
      const updatedAmount = applyRuleToAmount(discountedAmount, input.subjects, rule);
      if (updatedAmount !== discountedAmount) {
        discountedAmount = updatedAmount;
        if (rule.id) appliedRuleIds.push(rule.id);
      }
    }

    return {
      totalBaseAmount,
      discountedAmount,
      discount: Math.max(0, totalBaseAmount - discountedAmount),
      appliedRuleIds,
    };
  },

  async createSubjectPricing(pricing: SubjectPricing) {
    const planRef = doc(collection(db, 'pricing_plans'));
    const payload = {
      id: planRef.id,
      ...pricing,
      finalPrice: Number(pricing.originalPrice || 0) - Number(pricing.discount || 0),
      isActive: pricing.isActive ?? true,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    };

    await Promise.all([
      setDoc(planRef, payload),
      setDoc(doc(db, 'fees', planRef.id), payload),
    ]);

    return { feesId: planRef.id, pricingPlanId: planRef.id };
  },

  async updateSubjectPricing(id: string, pricing: SubjectPricing) {
    const payload = {
      ...pricing,
      finalPrice: Number(pricing.originalPrice || 0) - Number(pricing.discount || 0),
      updatedAt: serverTimestamp(),
    };

    const tasks = [updateDoc(doc(db, 'fees', id), payload).catch(() => Promise.resolve())];
    tasks.push(updateDoc(doc(db, 'pricing_plans', id), payload).catch(() => Promise.resolve()));
    await Promise.all(tasks);
  },

  async softDeleteSubjectPricing(id: string) {
    const payload = { isActive: false, updatedAt: serverTimestamp() };
    await Promise.all([
      updateDoc(doc(db, 'fees', id), payload).catch(() => Promise.resolve()),
      updateDoc(doc(db, 'pricing_plans', id), payload).catch(() => Promise.resolve()),
    ]);
  },

  async recordPaymentAndUpdateLedger(input: MonthlyLedgerInput) {
    const monthKey = `${input.studentId}_${input.month}`;
    const ledgerRef = doc(db, 'student_monthly_fee_ledger', monthKey);
    const paymentRef = doc(collection(db, 'fee_payments'));

    const batch = writeBatch(db);
    batch.set(paymentRef, {
      paymentId: paymentRef.id,
      studentId: input.studentId,
      studentName: input.studentName,
      month: input.month,
      amount: Number(input.amount || 0),
      mode: input.mode || 'upi',
      txId: input.transactionId || '',
      linkedPaymentHistoryId: input.paymentId,
      createdAt: serverTimestamp(),
      createdBy: input.studentId,
    });

    batch.set(
      ledgerRef,
      {
        studentId: input.studentId,
        studentName: input.studentName,
        month: input.month,
        paidAmount: Number(input.amount || 0),
        dueAmount: 0,
        status: 'Pending Verification',
        lastPaymentId: paymentRef.id,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    await batch.commit();
    return paymentRef.id;
  },
};
