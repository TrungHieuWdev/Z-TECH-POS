import { query } from '../config/db.js';

const DEVICE_FAMILIES = new Set(['apple', 'samsung', 'vivo', 'oppo', 'xiaomi', 'generic']);
let genericModelReady;

export function ensureGenericDeviceModel() {
  if (!genericModelReady) {
    genericModelReady = (async () => {
      const [existingModel] = await query(
        `SELECT id
         FROM device_models
         WHERE family = 'generic'
         ORDER BY CASE WHEN name = 'Phụ kiện tiện ích' THEN 0 ELSE 1 END, id
         LIMIT 1`
      );

      if (existingModel) {
        await query(
          `UPDATE device_models
           SET name = 'Phụ kiện tiện ích', series = 'Dùng chung',
               notes = 'Không thuộc hãng hoặc model máy cụ thể'
           WHERE id = ?`,
          [existingModel.id]
        );
        return existingModel.id;
      }

      const result = await query(
        `INSERT INTO device_models (family, name, series, notes)
         VALUES ('generic', 'Phụ kiện tiện ích', 'Dùng chung', 'Không thuộc hãng hoặc model máy cụ thể')`
      );
      return result.insertId;
    })().catch((error) => {
      genericModelReady = null;
      throw error;
    });
  }

  return genericModelReady;
}

export async function getAll(req, res) {
  try {
    await ensureGenericDeviceModel();
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
