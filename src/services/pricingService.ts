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
