import { listPaymentRequests, submitPaymentRequest, verifyPaymentRequest } from './service.js';

export async function submitPaymentRequestController(req, res) {
  try {
    const result = await submitPaymentRequest(req.body || {});
    res.json({ success: true, data: result });
  } catch (error) {
    const msg = String(error?.message || 'FAILED');
    if (msg.includes('INVALID_PAYMENT_REQUEST_PAYLOAD')) {
      return res.status(400).json({ success: false, message: 'student_id, amount, transaction_id and screenshot_url required' });
    }
    res.status(500).json({ success: false, message: 'Payment request submission failed' });
  }
}

export async function verifyPaymentRequestController(req, res) {
  try {
    const result = await verifyPaymentRequest(req.body || {});
    res.json({ success: true, data: result });
  } catch (error) {
    const msg = String(error?.message || 'FAILED');
    if (msg.includes('REQUEST_ID_REQUIRED')) return res.status(400).json({ success: false, message: 'request_id required' });
    if (msg.includes('REQUEST_NOT_FOUND')) return res.status(404).json({ success: false, message: 'Request not found' });
    if (msg.includes('REQUEST_ALREADY_PROCESSED')) return res.status(409).json({ success: false, message: 'Request already processed' });
    if (msg.includes('LEDGER_NOT_FOUND')) return res.status(404).json({ success: false, message: 'Student ledger not found' });
    res.status(500).json({ success: false, message: 'Payment verification failed' });
  }
}

export async function listPaymentRequestsController(req, res) {
  try {
    const result = await listPaymentRequests(req.query || {});
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load payment requests' });
  }
}
