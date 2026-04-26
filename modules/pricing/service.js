import { getItems } from '../../db';
import { calculateFee } from './engine.js';

export async function calculateStudentPricing({ subjects = [], isAdvance = false, month, paymentDate, enrollment } = {}) {
  const [plans, rules] = await Promise.all([
    getItems('pricing_plans'),
    getItems('pricing_rules')
  ]);

  const grade = enrollment?.grade;
  const applicablePlans = grade ? plans.filter((p) => !p.grade || p.grade === grade) : plans;

  return calculateFee({
    subjects,
    rules,
    plans: applicablePlans,
    isAdvance,
    month,
    paymentDate
  });
}
