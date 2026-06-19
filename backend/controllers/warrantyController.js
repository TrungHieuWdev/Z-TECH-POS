import { query } from '../config/db.js';
import { WARRANTY_TYPES } from '../utils/warrantyPolicy.js';

function addMonths(date, months) {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + months);
  return nextDate;
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + Number(days || 0));
  return nextDate;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function getDerivedStatus(row, expiresAt) {
  if (!Number(row.warranty_enabled)) {
    return row.warranty_type === WARRANTY_TYPES.INITIAL_EXCHANGE ? 'initial_exchange' : 'no_warranty';
  }

  const note = normalizeText(row.note);

  if (row.order_status === 'cancelled') return 'rejected';
  if (note.includes('tu choi')) return 'rejected';
  if (note.includes('doi moi')) return 'replaced';
  if (note.includes('bao hanh') || note.includes('xu ly')) return 'processing';

  return expiresAt < new Date() ? 'expired' : 'active';
}

function buildWarrantyCode(row) {
  const prefix = Number(row.warranty_enabled) ? 'BH' : row.warranty_type === WARRANTY_TYPES.INITIAL_EXCHANGE ? 'DL' : 'KBH';
  return `${prefix}-${String(row.order_id).padStart(5, '0')}-${String(row.order_item_id).padStart(3, '0')}`;
}

function mapWarranty(row) {
  const purchasedAt = new Date(row.purchased_at);
  const warrantyPeriodDays = Number(row.warranty_period_days || 0);
  const expiresAt = warrantyPeriodDays > 0 ? addDays(purchasedAt, warrantyPeriodDays) : addMonths(purchasedAt, 0);
  const status = getDerivedStatus(row, expiresAt);

  return {
    id: row.order_item_id,
    code: buildWarrantyCode(row),
    orderId: row.order_id,
    orderNumber: row.order_number,
    customerName: row.customer_name || 'Khach le',
    customerPhone: row.customer_phone || '',
    productName: row.product_name,
    sku: row.sku || `SKU-${String(row.product_id || row.order_item_id).padStart(5, '0')}`,
    categoryName: row.category_name || '',
    quantity: Number(row.quantity || 0),
    unitPrice: Number(row.unit_price || 0),
    purchasedAt: row.purchased_at,
    expiresAt: expiresAt.toISOString(),
    warrantyMonths: Math.ceil(warrantyPeriodDays / 30),
    warrantyPeriodDays,
    warrantyEnabled: Boolean(Number(row.warranty_enabled)),
    warrantyType: row.warranty_type,
    warrantyConditions: row.warranty_conditions || '',
    warrantyExclusions: row.warranty_exclusions || '',
    warrantyNote: row.warranty_note || '',
    status,
    staffName: row.cashier_name || 'Chua ro',
    note: row.note || ''
  };
}

export async function getAll(req, res) {
  try {
    const { date_from, date_to } = req.query;
    const params = [];
    let sql = `
      SELECT
        oi.id AS order_item_id,
        oi.quantity,
        oi.unit_price,
        o.id AS order_id,
        o.order_number,
        o.status AS order_status,
        o.note,
        o.created_at AS purchased_at,
        c.name AS customer_name,
        c.phone AS customer_phone,
        u.name AS cashier_name,
        p.id AS product_id,
        p.name AS product_name,
        p.warranty_enabled,
        p.warranty_period_days,
        p.warranty_type,
        p.warranty_conditions,
        p.warranty_exclusions,
        p.warranty_note,
        cat.name AS category_name
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN products p ON oi.product_id = p.id
      LEFT JOIN categories cat ON p.category_id = cat.id
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE 1 = 1
    `;

    if (date_from) {
      sql += ' AND DATE(o.created_at) >= ?';
      params.push(date_from);
    }

    if (date_to) {
      sql += ' AND DATE(o.created_at) <= ?';
      params.push(date_to);
    }

    sql += ' ORDER BY o.created_at DESC, oi.id DESC';

    const rows = await query(sql, params);
    res.json(rows.map(mapWarranty));
  } catch (error) {
    res.status(500).json({ message: 'Khong the lay danh sach bao hanh', error: error.message });
  }
}
