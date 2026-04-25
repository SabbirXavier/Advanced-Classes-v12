export function calculateFee(subjects = [], rules = [], isAdvance = false, plans = []) {
  const subjectSet = new Set(subjects);
  const activePlans = plans.filter((p) => p.isActive !== false);
  const activeRules = rules.filter((r) => r.isActive !== false).sort((a, b) => Number(a.priority || 999) - Number(b.priority || 999));

  const baseAmount = activePlans
    .filter((p) => p.planType === 'SUBJECT' && subjectSet.has(p.subject))
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  let comboDiscount = 0;
  let advanceDiscount = 0;

  for (const rule of activeRules) {
    if (rule.ruleType === 'COMBO') {
      const required = Array.isArray(rule.config?.subjects) ? rule.config.subjects : [];
      const eligible = required.length > 0 && required.every((s) => subjectSet.has(s));
      if (eligible) comboDiscount += Number(rule.config?.discountAmount || 0);
    }
    if (rule.ruleType === 'ADVANCE' && isAdvance) {
      advanceDiscount += Number(rule.config?.discountAmount || 0);
    }
  }

  const finalAmount = Math.max(0, baseAmount - comboDiscount - advanceDiscount);
  return { baseAmount, comboDiscount, advanceDiscount, finalAmount };
}
