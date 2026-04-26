function toMonthDate(monthKey) {
  if (!monthKey) return null;
  const [y, m] = String(monthKey).split('-').map(Number);
  if (!y || !m) return null;
  return new Date(y, m - 1, 1);
}

function asNumber(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

export function calculateFee(params = {}, rulesArg = [], isAdvanceArg = false, plansArg = []) {
  // Backward compatibility
  if (Array.isArray(params)) {
    const subjects = params;
    return calculateFee({ subjects, rules: rulesArg, isAdvance: isAdvanceArg, plans: plansArg });
  }

  const {
    subjects = [],
    rules = [],
    plans = [],
    isAdvance = false,
    month,
    paymentDate = new Date().toISOString()
  } = params;

  const subjectSet = new Set(subjects);
  const activePlans = plans.filter((p) => p.isActive !== false);
  const activeRules = rules
    .filter((r) => r.isActive !== false)
    .sort((a, b) => asNumber(a.priority || 999) - asNumber(b.priority || 999));

  const subjectPlans = activePlans.filter((p) => p.planType === 'SUBJECT' && subjectSet.has(p.subject));
  const subjectTotal = subjectPlans.reduce((sum, p) => sum + asNumber(p.amount), 0);

  let offerDiscount = 0;
  let advanceDiscountPotential = 0;
  let advanceDiscountApplied = 0;

  for (const rule of activeRules) {
    if (rule.ruleType === 'COMBO' || rule.ruleType === 'OFFER') {
      const required = Array.isArray(rule.config?.subjects) ? rule.config.subjects : [];
      const eligibleBySubjects = required.length === 0 || required.every((s) => subjectSet.has(s));
      if (!eligibleBySubjects) continue;

      const amount = asNumber(rule.config?.discountAmount);
      const percent = asNumber(rule.config?.discountPercent);
      offerDiscount += amount + (subjectTotal * percent) / 100;
    }

    if (rule.ruleType === 'ADVANCE') {
      const amount = asNumber(rule.config?.discountAmount);
      const percent = asNumber(rule.config?.discountPercent);
      const discountValue = amount + (subjectTotal * percent) / 100;
      advanceDiscountPotential += discountValue;

      const currentMonthDate = toMonthDate(month);
      const paymentTs = new Date(paymentDate);
      const deadlineDateRaw = rule.config?.deadlineDate;
      const deadlineDay = asNumber(rule.config?.deadlineDay);

      let eligibleByDeadline = true;
      if (deadlineDateRaw) {
        eligibleByDeadline = paymentTs <= new Date(deadlineDateRaw);
      } else if (currentMonthDate && deadlineDay > 0) {
        const cutoff = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), deadlineDay, 23, 59, 59);
        eligibleByDeadline = paymentTs <= cutoff;
      }

      if (isAdvance && eligibleByDeadline) {
        advanceDiscountApplied += discountValue;
      }
    }
  }

  const baseAmount = Math.max(0, subjectTotal);
  const finalAmount = Math.max(0, baseAmount - offerDiscount - advanceDiscountApplied);
  const lowestPossibleAmount = Math.max(0, baseAmount - offerDiscount - advanceDiscountPotential);

  return {
    baseAmount,
    subjectTotal,
    offerDiscount,
    comboDiscount: offerDiscount,
    advanceDiscount: advanceDiscountApplied,
    advanceDiscountApplied,
    advanceDiscountPotential,
    finalAmount,
    lowestPossibleAmount,
    totalSavings: baseAmount - finalAmount
  };
}
