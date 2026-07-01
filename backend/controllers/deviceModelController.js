import { query } from '../config/db.js';

const DEVICE_FAMILIES = new Set(['apple', 'samsung', 'vivo', 'oppo', 'xiaomi', 'generic']);
let genericModelReady;

export function ensureGenericDeviceModel() {
  if (!genericModelReady) {
    genericModelReady = (async () => {
      await query(
        `INSERT INTO device_models (family, name, series, notes)
         VALUES ('generic', 'Phụ kiện chung', 'Dùng chung', 'Không thuộc hãng hoặc model máy cụ thể')
         ON DUPLICATE KEY UPDATE family = 'generic', series = 'Dùng chung'`
      );
      const [model] = await query("SELECT id FROM device_models WHERE family = 'generic' AND name = 'Phụ kiện chung' LIMIT 1");
      return model.id;
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
