import { query } from '../config/db.js';
import { ensureWarrantyData, mapWarranty } from './warrantyController.js';

export async function getByPublicToken(req, res) {
  try {
    await ensureWarrantyData();
    const rows = await query(`
      SELECT oi.id AS order_item_id, oi.public_token, o.id AS order_id,
        o.order_number, o.status AS order_status, o.created_at AS purchased_at,
        NULL AS note, p.id AS product_id, p.name AS product_name,
        COALESCE(oi.warranty_enabled_snapshot, p.warranty_enabled) AS warranty_enabled,
        COALESCE(oi.warranty_period_days_snapshot, p.warranty_period_days) AS warranty_period_days,
        COALESCE(oi.warranty_type_snapshot, p.warranty_type) AS warranty_type,
        COALESCE(oi.warranty_conditions_snapshot, p.warranty_conditions) AS warranty_conditions
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN products p ON p.id = oi.product_id
      WHERE oi.public_token = ?
      LIMIT 1
    `, [req.params.publicToken]);

    if (!rows[0]) return res.status(404).json({ message: 'Không tìm thấy bảo hành' });
    const warranty = mapWarranty(rows[0]);
    return res.json({
      warrantyCode: warranty.code,
      productName: warranty.productName,
      purchasedAt: warranty.purchasedAt,
      expiresAt: warranty.expiresAt,
      status: warranty.status,
      warrantyConditions: warranty.warrantyConditions
    });
  } catch (error) {
    return res.status(500).json({ message: 'Không thể tra cứu bảo hành' });
  }
}
