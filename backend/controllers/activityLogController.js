import { query } from '../config/db.js';

const allowedTypes = new Set(['order', 'inventory']);

function getSafeLimit(value) {
  const limit = Number(value || 120);
  if (!Number.isFinite(limit) || limit <= 0) return 120;
  return Math.min(Math.floor(limit), 300);
}

function appendFilters(sql, params, filters) {
  let nextSql = `${sql} WHERE 1 = 1`;

  if (allowedTypes.has(filters.type)) {
    nextSql += ' AND activity.type = ?';
    params.push(filters.type);
  }

  if (filters.date_from) {
    nextSql += ' AND DATE(activity.created_at) >= ?';
    params.push(filters.date_from);
  }

  if (filters.date_to) {
    nextSql += ' AND DATE(activity.created_at) <= ?';
    params.push(filters.date_to);
  }

  if (filters.search) {
    const keyword = `%${filters.search}%`;
    nextSql += `
      AND (
        activity.title LIKE ?
        OR activity.description LIKE ?
        OR activity.actor_name LIKE ?
        OR activity.target_name LIKE ?
        OR activity.reference_code LIKE ?
        OR activity.module LIKE ?
        OR activity.action_label LIKE ?
      )
    `;
    params.push(keyword, keyword, keyword, keyword, keyword, keyword, keyword);
  }

  return nextSql;
}

const activityLogUnionSql = `
  SELECT
    CONCAT('order-', o.id) AS id,
    'order' AS type,
    'Bán hàng' AS module,
    CASE
      WHEN o.status = 'cancelled' THEN 'Hủy đơn hàng'
      ELSE 'Tạo đơn bán hàng'
    END AS action_label,
    CONCAT('Đơn ', o.order_number) AS title,
    CONCAT(COALESCE(c.name, 'Khách lẻ'), ' - ', COALESCE(u.name, 'Không rõ')) AS description,
    COALESCE(u.name, 'Không rõ') AS actor_name,
    COALESCE(c.name, 'Khách lẻ') AS target_name,
    o.order_number AS reference_code,
    o.total AS amount,
    NULL AS quantity,
    o.payment_method AS meta,
    o.status AS status,
    o.created_at AS created_at
  FROM orders o
  LEFT JOIN customers c ON o.customer_id = c.id
  LEFT JOIN users u ON o.user_id = u.id

  UNION ALL

  SELECT
    CONCAT('inventory-', il.id) AS id,
    'inventory' AS type,
    'Kho hàng' AS module,
    CASE
      WHEN il.type = 'in' THEN 'Nhập kho'
      WHEN il.type = 'out' THEN 'Xuất kho'
      ELSE 'Điều chỉnh kho'
    END AS action_label,
    CONCAT(
      CASE
        WHEN il.type = 'in' THEN 'Nhập kho '
        WHEN il.type = 'out' THEN 'Xuất kho '
        ELSE 'Điều chỉnh '
      END,
      p.name
    ) AS title,
    CONCAT('Số lượng: ', il.quantity, IF(il.note IS NULL OR il.note = '', '', CONCAT(' - ', il.note))) AS description,
    COALESCE(u.name, 'Không rõ') AS actor_name,
    p.name AS target_name,
    NULL AS reference_code,
    NULL AS amount,
    il.quantity AS quantity,
    il.type AS meta,
    'completed' AS status,
    il.created_at AS created_at
  FROM inventory_logs il
  JOIN products p ON il.product_id = p.id
  LEFT JOIN users u ON il.user_id = u.id
`;

export async function getActivityLogs(req, res) {
  try {
    const params = [];
    const limit = getSafeLimit(req.query.limit);
    const filters = {
      type: req.query.type,
      search: String(req.query.search || '').trim(),
      date_from: req.query.date_from,
      date_to: req.query.date_to
    };

    let sql = appendFilters(`SELECT * FROM (${activityLogUnionSql}) activity`, params, filters);
    sql += ` ORDER BY activity.created_at DESC LIMIT ${limit}`;

    const logs = await query(sql, params);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Không thể lấy nhật ký hoạt động', error: error.message });
  }
}
