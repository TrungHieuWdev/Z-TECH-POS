import { query } from '../config/db.js';

const DEVICE_FAMILIES = new Set(['apple', 'samsung', 'vivo', 'oppo', 'xiaomi']);

export async function getAll(req, res) {
  try {
    const { family } = req.query;
    const params = [];
    let sql = `
      SELECT id, family, name, series, release_year, notes
      FROM device_models
      WHERE 1 = 1
    `;

    if (DEVICE_FAMILIES.has(family)) {
      sql += ' AND family = ?';
      params.push(family);
    }

    sql += ' ORDER BY family, release_year DESC, name';

    const models = await query(sql, params);
    res.json(models);
  } catch (error) {
    res.status(500).json({ message: 'Không thể lấy danh sách model máy', error: error.message });
  }
}
