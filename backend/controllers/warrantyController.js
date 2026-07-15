import { query } from '../config/db.js';
import { WARRANTY_TYPES } from '../utils/warrantyPolicy.js';
import { randomUUID } from 'node:crypto';

let warrantySnapshotReady = false;
export async function ensureWarrantyData() {
  if (warrantySnapshotReady) return;
  await query(`UPDATE order_items oi JOIN products p ON p.id = oi.product_id SET oi.warranty_enabled_snapshot = p.warranty_enabled, oi.warranty_period_days_snapshot = p.warranty_period_days, oi.warranty_type_snapshot = p.warranty_type, oi.warranty_conditions_snapshot = p.warranty_conditions, oi.warranty_exclusions_snapshot = p.warranty_exclusions, oi.warranty_note_snapshot = p.warranty_note WHERE oi.warranty_enabled_snapshot IS NULL`);
  const missingTokens = await query('SELECT id FROM order_items WHERE public_token IS NULL');
  for (const row of missingTokens) await query('UPDATE order_items SET public_token = ? WHERE id = ?', [randomUUID(), row.id]);
  await query(`INSERT IGNORE INTO warranties
    (warranty_code,order_item_id,customer_id,product_id,warranty_start,warranty_end,status,note)
    SELECT CONCAT('BH-',LPAD(o.id,5,'0'),'-',LPAD(oi.id,3,'0')),oi.id,o.customer_id,oi.product_id,
      DATE(o.created_at),DATE_ADD(DATE(o.created_at),INTERVAL oi.warranty_period_days_snapshot DAY),'active',oi.warranty_note_snapshot
    FROM order_items oi JOIN orders o ON o.id=oi.order_id
    WHERE oi.warranty_enabled_snapshot=1 AND oi.warranty_period_days_snapshot>0`);
  warrantySnapshotReady = true;
}

export async function getClaims(req, res) {
  await ensureWarrantyData();
  const rows = await query(`SELECT wc.* FROM warranty_claims wc JOIN warranties w ON w.id=wc.warranty_id
    WHERE w.order_item_id=? ORDER BY wc.created_at DESC`, [req.params.orderItemId]);
  res.json(rows);
}

export async function createClaim(req, res) {
  try {
    await ensureWarrantyData();
    const warranties = await query('SELECT id,status FROM warranties WHERE order_item_id=?', [req.params.orderItemId]);
    if (!warranties[0]) return res.status(404).json({ message: 'Sản phẩm không có phiếu bảo hành' });
    const result = await query(`INSERT INTO warranty_claims (warranty_id,issue_description,resolution,status)
      VALUES (?,?,?,?)`, [warranties[0].id, req.body.issue_description, req.body.resolution || null, req.body.status || 'received']);
    await query("UPDATE warranties SET status='claimed' WHERE id=?", [warranties[0].id]);
    const rows = await query('SELECT * FROM warranty_claims WHERE id=?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Không thể tiếp nhận bảo hành' });
  }
}

export async function updateClaim(req, res) {
  const allowed = ['received','inspecting','repairing','resolved','rejected','cancelled'];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
  const result = await query('UPDATE warranty_claims SET status=?,resolution=? WHERE id=?', [req.body.status, req.body.resolution || null, req.params.claimId]);
  if (!result.affectedRows) return res.status(404).json({ message: 'Không tìm thấy yêu cầu bảo hành' });
  const rows = await query('SELECT * FROM warranty_claims WHERE id=?', [req.params.claimId]);
  res.json(rows[0]);
}

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

export function mapWarranty(row) {
  const purchasedAt = new Date(row.purchased_at);
  const warrantyPeriodDays = Number(row.warranty_period_days || 0);
  const expiresAt = warrantyPeriodDays > 0 ? addDays(purchasedAt, warrantyPeriodDays) : addMonths(purchasedAt, 0);
  const status = getDerivedStatus(row, expiresAt);

  return {
    id: row.order_item_id,
    publicToken: row.public_token,
    code: buildWarrantyCode(row),
    orderId: row.order_id,
    orderNumber: row.order_number,
    customerName: row.customer_name || 'Khách thường',
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

export async function listWarranties({ dateFrom = '', dateTo = '' } = {}) {
  await ensureWarrantyData();
  const params = [];
  let sql = `
      SELECT
        oi.id AS order_item_id,
        oi.quantity,
        oi.unit_price,
        oi.public_token,
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
        COALESCE(oi.warranty_enabled_snapshot, p.warranty_enabled) AS warranty_enabled,
        COALESCE(oi.warranty_period_days_snapshot, p.warranty_period_days) AS warranty_period_days,
        COALESCE(oi.warranty_type_snapshot, p.warranty_type) AS warranty_type,
        COALESCE(oi.warranty_conditions_snapshot, p.warranty_conditions) AS warranty_conditions,
        COALESCE(oi.warranty_exclusions_snapshot, p.warranty_exclusions) AS warranty_exclusions,
        COALESCE(oi.warranty_note_snapshot, p.warranty_note) AS warranty_note,
        cat.name AS category_name
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN products p ON oi.product_id = p.id
      LEFT JOIN categories cat ON p.category_id = cat.id
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE 1 = 1
    `;

  if (dateFrom) {
    sql += ' AND DATE(o.created_at) >= ?';
    params.push(dateFrom);
  }

  if (dateTo) {
    sql += ' AND DATE(o.created_at) <= ?';
    params.push(dateTo);
  }

  sql += ' ORDER BY o.created_at DESC, oi.id DESC';

  const rows = await query(sql, params);
  return rows.map(mapWarranty);
}

export async function getAll(req, res) {
  try {
    const warranties = await listWarranties({
      dateFrom: req.query.date_from,
      dateTo: req.query.date_to
    });
    res.json(warranties);
  } catch (error) {
    res.status(500).json({ message: 'Khong the lay danh sach bao hanh', error: error.message });
  }
}
