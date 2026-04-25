import { getItems } from '../../db';
import { calculateFee } from './engine.js';

export async function calculateStudentPricing({ subjects = [], isAdvance = false }) {
  const [plans, rules] = await Promise.all([
    getItems('pricing_plans'),
    getItems('pricing_rules')
  ]);
  return calculateFee(subjects, rules, isAdvance, plans);
}
