import { query } from '../config/db.js';

const VAT_RATES = new Set([0, 5, 8, 10]);
const DEFAULT_BANK_TRANSFER = {
  bankId: '970436',
  bankName: 'Vietcombank - Ngân hàng TMCP Ngoại thương Việt Nam',
  accountNo: '1033519890',
  accountName: 'NGUYEN HOANG TRUNG HIEU'
};

function validateBankName(value) {
  const bankName = String(value || '').trim().replace(/\s+/g, ' ');

  if (bankName.length < 3 || bankName.length > 150) {
    return 'Tên ngân hàng phải có từ 3 đến 150 ký tự';
  }
  if (!/^[\p{L}\p{N}][\p{L}\p{N}\s.&,'’()/-]*$/u.test(bankName)) {
    return 'Tên ngân hàng chỉ được chứa chữ, số và dấu câu thông dụng';
  }
  if (!/\p{L}/u.test(bankName)) {
    return 'Tên ngân hàng phải có chữ cái';
  }
  if (!/(ngân\s*hàng|bank|tmcp|tnhh|credit\s*union|finance)/iu.test(bankName)) {
    return 'Tên chưa đúng định dạng ngân hàng, ví dụ: ABC Bank hoặc Ngân hàng TMCP ABC';
  }

  return '';
}

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

export async function getBankTransferSettings(req, res) {
  try {
    const rows = await query(
      "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('bank_id', 'bank_name', 'bank_account_no', 'bank_account_name')"
    );
    const values = Object.fromEntries(rows.map((row) => [row.setting_key, row.setting_value]));

    res.json({
      bankId: values.bank_id || DEFAULT_BANK_TRANSFER.bankId,
      bankName: values.bank_name || DEFAULT_BANK_TRANSFER.bankName,
      accountNo: values.bank_account_no || DEFAULT_BANK_TRANSFER.accountNo,
      accountName: values.bank_account_name || DEFAULT_BANK_TRANSFER.accountName
    });
  } catch (error) {
    res.status(500).json({ message: 'Không thể tải thông tin chuyển khoản', error: error.message });
  }
}

export async function updateBankTransferSettings(req, res) {
  try {
    const bankId = String(req.body.bankId || '').trim();
    const bankName = String(req.body.bankName || '').trim().replace(/\s+/g, ' ');
    const accountNo = String(req.body.accountNo || '').replace(/\s+/g, '');
    const accountName = String(req.body.accountName || '').trim().toUpperCase();

    if (!bankId || !bankName || !accountNo || !accountName) {
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin tài khoản thụ hưởng' });
    }
    if (!/^970\d{3}$/.test(bankId)) {
      return res.status(400).json({ message: 'Mã BIN/NAPAS ngân hàng Việt Nam phải gồm 6 chữ số và bắt đầu bằng 970' });
    }
    const bankNameError = validateBankName(bankName);
    if (bankNameError) {
      return res.status(400).json({ message: bankNameError });
    }
    if (!/^\d{6,20}$/.test(accountNo)) {
      return res.status(400).json({ message: 'Số tài khoản phải gồm từ 6 đến 20 chữ số' });
    }

    await query(
      `INSERT INTO system_settings (setting_key, setting_value, updated_by) VALUES
       ('bank_id', ?, ?), ('bank_name', ?, ?), ('bank_account_no', ?, ?), ('bank_account_name', ?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
      [bankId, req.user.id, bankName, req.user.id, accountNo, req.user.id, accountName, req.user.id]
    );

    res.json({ bankId, bankName, accountNo, accountName });
  } catch (error) {
    res.status(500).json({ message: 'Không thể lưu thông tin chuyển khoản', error: error.message });
  }
}
