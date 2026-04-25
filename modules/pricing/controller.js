import { calculateStudentPricing } from './service.js';

export async function calculatePricingController(req, res) {
  try {
    const result = await calculateStudentPricing(req.body || {});
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Pricing calculation failed' });
  }
}
