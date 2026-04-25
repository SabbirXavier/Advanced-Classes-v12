import { getFeeReport } from './service.js';

export async function feeReportController(req, res) {
  try {
    const data = await getFeeReport(req.query || {});
    res.json({ success: true, data, total: data.length });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to generate fee report' });
  }
}
