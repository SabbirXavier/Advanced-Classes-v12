export function generateWhatsAppLink(phone, message) {
  const normalized = String(phone || '').replace(/\D/g, '');
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function renderReminderTemplate({ student_name, pending_amount, due_month }) {
  return `Hello ${student_name}, your pending amount is ₹${pending_amount} for ${due_month}. Please clear your dues.`;
}
