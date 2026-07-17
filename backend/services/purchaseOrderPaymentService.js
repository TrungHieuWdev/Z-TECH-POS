const PAYMENT_METHODS = new Set(['cash', 'transfer', 'other']);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function normalizePurchasePayment({
  totalAmount,
  paidAmount,
  paymentMethod,
  dueDate
}) {
  const total = Number(totalAmount);
  const paid = paidAmount == null || paidAmount === '' ? total : Number(paidAmount);

  if (!Number.isFinite(total) || total < 0 || !Number.isInteger(total)) {
    throw Object.assign(new Error('Tổng tiền phiếu nhập không hợp lệ'), { status: 400 });
  }
  if (!Number.isFinite(paid) || paid < 0 || !Number.isInteger(paid) || paid > total) {
    throw Object.assign(new Error('Số tiền đã thanh toán phải từ 0 đến tổng tiền phiếu nhập'), { status: 400 });
  }

  const debtAmount = total - paid;
  const paymentStatus = debtAmount === 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
  let normalizedMethod = null;

  if (paid > 0) {
    normalizedMethod = String(paymentMethod || 'other').trim().toLowerCase();
    if (!PAYMENT_METHODS.has(normalizedMethod)) {
      throw Object.assign(new Error('Phương thức thanh toán phiếu nhập không hợp lệ'), { status: 400 });
    }
  }

  const normalizedDueDate = dueDate == null || dueDate === '' ? null : String(dueDate).slice(0, 10);
  if (normalizedDueDate && !DATE_PATTERN.test(normalizedDueDate)) {
    throw Object.assign(new Error('Hạn thanh toán không hợp lệ'), { status: 400 });
  }

  return {
    totalAmount: total,
    paidAmount: paid,
    debtAmount,
    paymentStatus,
    paymentMethod: normalizedMethod,
    dueDate: debtAmount > 0 ? normalizedDueDate : null
  };
}
