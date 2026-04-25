import { handlePayment } from './service.js';

export async function handlePaymentController(req, res) {
  try {
    const result = await handlePayment(req.body || {});
    res.json({ success: true, data: result });
  } catch (error) {
    const msg = String(error?.message || 'PAYMENT_FAILED');
    if (msg.includes('INVALID_PAYMENT_PAYLOAD')) return res.status(400).json({ success: false, message: 'Invalid payment payload' });
    if (msg.includes('LEDGER_NOT_FOUND')) return res.status(404).json({ success: false, message: 'Ledger not found' });
    res.status(500).json({ success: false, message: 'Payment processing failed' });
  }
}
