import { query } from '../config/db.js';

export async function getAll(req, res) {
  const params = [];
  let where = '';
  if (req.query.order_id) { where = ' WHERE p.order_id=?'; params.push(req.query.order_id); }
  const rows = await query(`SELECT p.*, o.order_number FROM payments p JOIN orders o ON o.id=p.order_id${where} ORDER BY p.created_at DESC`, params);
  res.json(rows);
}
