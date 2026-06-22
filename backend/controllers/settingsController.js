import { query } from '../config/db.js';

const VAT_RATES = new Set([0, 5, 8, 10]);

export async function getVatSettings(req, res) {
  try {
    const rows = await query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('vat_enabled', 'vat_rate')");
    const values = Object.fromEntries(rows.map((row) => [row.setting_key, row.setting_value]));
    res.json({ enabled: values.vat_enabled === '1', rate: Number(values.vat_rate || 0) });
  } catch (error) {
    res.status(500).json({ message: 'Không thể tải cài đặt VAT', error: error.message });
  }
}

export async function updateVatSettings(req, res) {
  try {
    const enabled = Boolean(req.body.enabled);
    const rate = Number(req.body.rate);
    if (!VAT_RATES.has(rate)) {
      return res.status(400).json({ message: 'Mức VAT chỉ được chọn 0%, 5%, 8% hoặc 10%' });
    }

    await query(
      `INSERT INTO system_settings (setting_key, setting_value, updated_by) VALUES
       ('vat_enabled', ?, ?), ('vat_rate', ?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
      [enabled ? '1' : '0', req.user.id, String(rate), req.user.id]
    );
    res.json({ enabled, rate });
  } catch (error) {
    res.status(500).json({ message: 'Không thể lưu cài đặt VAT', error: error.message });
  }
}
