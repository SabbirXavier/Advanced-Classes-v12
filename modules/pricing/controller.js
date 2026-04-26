import { calculateStudentPricing } from './service.js';

export async function calculatePricingController(req, res) {
  try {
    const result = await calculateStudentPricing(req.body || {});
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Pricing calculation failed' });
  }
}

export async function previewYearPricingController(req, res) {
  try {
    const { subjects = [], enrollmentDate, isAdvance = false } = req.body || {};
    const start = enrollmentDate ? new Date(enrollmentDate) : new Date();
    if (Number.isNaN(start.getTime())) return res.status(400).json({ success: false, message: 'Invalid enrollmentDate' });

    const months = [];
    const startYear = start.getFullYear();
    const startMonth = start.getMonth() + 1;
    const untilYear = startMonth <= 4 ? startYear : startYear + 1;
    let year = startYear;
    let month = startMonth;
    while (year < untilYear || (year === untilYear && month <= 4)) {
      const key = `${year}-${String(month).padStart(2, '0')}`;
      const pricing = await calculateStudentPricing({ subjects, month: key, isAdvance, paymentDate: new Date().toISOString() });
      months.push({ month: key, ...pricing });
      month += 1;
      if (month === 13) { month = 1; year += 1; }
    }

    const totals = months.reduce((acc, row) => {
      acc.baseAmount += Number(row.baseAmount || 0);
      acc.offerDiscount += Number(row.offerDiscount || 0);
      acc.advanceDiscountPotential += Number(row.advanceDiscountPotential || 0);
      acc.finalAmount += Number(row.finalAmount || 0);
      acc.lowestPossibleAmount += Number(row.lowestPossibleAmount || 0);
      return acc;
    }, { baseAmount: 0, offerDiscount: 0, advanceDiscountPotential: 0, finalAmount: 0, lowestPossibleAmount: 0 });

    res.json({ success: true, data: { months, totals } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Year preview failed' });
  }
}
