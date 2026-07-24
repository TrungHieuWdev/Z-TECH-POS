import { query } from '../config/db.js';
import { del, put } from '@vercel/blob';

const SETTING_KEYS = [
  'shop_name',
  'shop_address',
  'shop_phone',
  'shop_email',
  'shop_logo_url',
  'print_paper_size',
  'print_header',
  'print_footer',
  'print_copies',
  'print_auto_after_payment',
  'payment_cash_enabled',
  'payment_transfer_enabled',
  'payment_qr_enabled',
  'payment_default_method',
  'bank_id',
  'bank_name',
  'bank_account_no',
  'bank_account_name',
  'bank_transfer_memo',
  'vat_enabled',
  'vat_rate',
  'inventory_low_stock_threshold',
  'inventory_allow_out_of_stock_sale'
];

const DEFAULT_SETTINGS = {
  shopInfo: {
    name: 'Z-TECH POS',
    address: '',
    phone: '0900000000',
    email: '',
    logoUrl: ''
  },
  print: {
    paperSize: 'K80',
    header: 'Z-TECH POS',
    footer: 'Cam on quy khach va hen gap lai',
    copies: 1,
    autoPrintAfterPayment: false
  },
  payment: {
    methods: {
      cash: true,
      transfer: false,
      qr: false
    },
    defaultMethod: 'cash',
    vietQr: {
      bankId: '',
      bankName: '',
      accountNo: '',
      accountName: '',
      memo: 'Thanh toan ZTECH'
    },
    vat: {
      enabled: false,
      rate: 0
    },
    currency: 'VNĐ'
  },
  inventory: {
    lowStockThreshold: 5,
    allowOutOfStockSale: false
  }
};

const DEFAULT_BANK_TRANSFER = {
  bankId: DEFAULT_SETTINGS.payment.vietQr.bankId,
  bankName: DEFAULT_SETTINGS.payment.vietQr.bankName,
  accountNo: DEFAULT_SETTINGS.payment.vietQr.accountNo,
  accountName: DEFAULT_SETTINGS.payment.vietQr.accountName
};

const VAT_RATES = new Set([0, 5, 8, 10]);

function boolFromSetting(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function numberFromSetting(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampInteger(value, fallback, min, max) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function normalizeSettings(rows = []) {
  const values = Object.fromEntries(rows.map((row) => [row.setting_key, row.setting_value]));

  return {
    shopInfo: {
      name: values.shop_name || DEFAULT_SETTINGS.shopInfo.name,
      address: values.shop_address || DEFAULT_SETTINGS.shopInfo.address,
      phone: values.shop_phone || DEFAULT_SETTINGS.shopInfo.phone,
      email: values.shop_email || DEFAULT_SETTINGS.shopInfo.email,
      logoUrl: values.shop_logo_url || DEFAULT_SETTINGS.shopInfo.logoUrl
    },
    print: {
      paperSize: values.print_paper_size || DEFAULT_SETTINGS.print.paperSize,
      header: values.print_header || DEFAULT_SETTINGS.print.header,
      footer: values.print_footer || DEFAULT_SETTINGS.print.footer,
      copies: clampInteger(values.print_copies, DEFAULT_SETTINGS.print.copies, 1, 5),
      autoPrintAfterPayment: boolFromSetting(values.print_auto_after_payment, DEFAULT_SETTINGS.print.autoPrintAfterPayment)
    },
    payment: {
      methods: {
        cash: boolFromSetting(values.payment_cash_enabled, DEFAULT_SETTINGS.payment.methods.cash),
        transfer: boolFromSetting(values.payment_transfer_enabled, DEFAULT_SETTINGS.payment.methods.transfer),
        qr: boolFromSetting(values.payment_qr_enabled, DEFAULT_SETTINGS.payment.methods.qr)
      },
      defaultMethod: values.payment_default_method || DEFAULT_SETTINGS.payment.defaultMethod,
      vietQr: {
        bankId: values.bank_id || DEFAULT_SETTINGS.payment.vietQr.bankId,
        bankName: values.bank_name || DEFAULT_SETTINGS.payment.vietQr.bankName,
        accountNo: values.bank_account_no || DEFAULT_SETTINGS.payment.vietQr.accountNo,
        accountName: values.bank_account_name || DEFAULT_SETTINGS.payment.vietQr.accountName,
        memo: values.bank_transfer_memo || DEFAULT_SETTINGS.payment.vietQr.memo
      },
      vat: {
        enabled: boolFromSetting(values.vat_enabled, DEFAULT_SETTINGS.payment.vat.enabled),
        rate: numberFromSetting(values.vat_rate, DEFAULT_SETTINGS.payment.vat.rate)
      },
      currency: DEFAULT_SETTINGS.payment.currency
    },
    inventory: {
      lowStockThreshold: clampInteger(values.inventory_low_stock_threshold, DEFAULT_SETTINGS.inventory.lowStockThreshold, 0, 999),
      allowOutOfStockSale: boolFromSetting(values.inventory_allow_out_of_stock_sale, DEFAULT_SETTINGS.inventory.allowOutOfStockSale)
    }
  };
}

function flattenSettings(settings) {
  const shopInfo = { ...DEFAULT_SETTINGS.shopInfo, ...(settings.shopInfo || {}) };
  const print = { ...DEFAULT_SETTINGS.print, ...(settings.print || {}) };
  const payment = {
    ...DEFAULT_SETTINGS.payment,
    ...(settings.payment || {}),
    methods: { ...DEFAULT_SETTINGS.payment.methods, ...(settings.payment?.methods || {}) },
    vietQr: { ...DEFAULT_SETTINGS.payment.vietQr, ...(settings.payment?.vietQr || {}) },
    vat: { ...DEFAULT_SETTINGS.payment.vat, ...(settings.payment?.vat || {}) }
  };
  const inventory = { ...DEFAULT_SETTINGS.inventory, ...(settings.inventory || {}) };

  return {
    shop_name: String(shopInfo.name || '').trim(),
    shop_address: String(shopInfo.address || '').trim(),
    shop_phone: String(shopInfo.phone || '').trim(),
    shop_email: String(shopInfo.email || '').trim(),
    shop_logo_url: String(shopInfo.logoUrl || '').trim(),
    print_paper_size: ['K80', 'A4'].includes(print.paperSize) ? print.paperSize : DEFAULT_SETTINGS.print.paperSize,
    print_header: String(print.header || '').trim(),
    print_footer: String(print.footer || '').trim(),
    print_copies: String(clampInteger(print.copies, DEFAULT_SETTINGS.print.copies, 1, 5)),
    print_auto_after_payment: print.autoPrintAfterPayment ? '1' : '0',
    payment_cash_enabled: payment.methods.cash ? '1' : '0',
    payment_transfer_enabled: payment.methods.transfer ? '1' : '0',
    payment_qr_enabled: payment.methods.qr ? '1' : '0',
    payment_default_method: ['cash', 'transfer', 'qr'].includes(payment.defaultMethod) ? payment.defaultMethod : 'cash',
    bank_id: String(payment.vietQr.bankId || '').trim(),
    bank_name: String(payment.vietQr.bankName || '').trim(),
    bank_account_no: String(payment.vietQr.accountNo || '').replace(/\s+/g, ''),
    bank_account_name: String(payment.vietQr.accountName || '').trim().toUpperCase(),
    bank_transfer_memo: String(payment.vietQr.memo || '').trim(),
    vat_enabled: payment.vat.enabled ? '1' : '0',
    vat_rate: String(Math.max(0, Math.min(100, Number(payment.vat.rate) || 0))),
    inventory_low_stock_threshold: String(clampInteger(inventory.lowStockThreshold, DEFAULT_SETTINGS.inventory.lowStockThreshold, 0, 999)),
    inventory_allow_out_of_stock_sale: inventory.allowOutOfStockSale ? '1' : '0'
  };
}

function validateSettings(flatSettings) {
  if (!flatSettings.shop_name) return 'Tên cửa hàng không được để trống';
  if (!/^0\d{9}$/.test(flatSettings.shop_phone)) return 'Số điện thoại phải gồm 10 số và bắt đầu bằng 0';
  if (flatSettings.shop_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(flatSettings.shop_email)) return 'Email không đúng định dạng';

  const enabledMethods = ['cash', 'transfer', 'qr'].filter((method) => flatSettings[`payment_${method}_enabled`] === '1');
  if (enabledMethods.length === 0) return 'Cần bật ít nhất một phương thức thanh toán';
  if (!enabledMethods.includes(flatSettings.payment_default_method)) return 'Phương thức mặc định phải là phương thức đang bật';
  if (flatSettings.bank_id && !/^970\d{3}$/.test(flatSettings.bank_id)) return 'Mã ngân hàng VietQR phải gồm 6 số và bắt đầu bằng 970';
  if (flatSettings.bank_account_no && !/^\d{6,20}$/.test(flatSettings.bank_account_no)) return 'Số tài khoản phải gồm từ 6 đến 20 chữ số';

  return '';
}

async function readSettingsRows() {
  return query(
    `SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (${SETTING_KEYS.map(() => '?').join(',')})`,
    SETTING_KEYS
  );
}

async function saveSettingsMap(values, userId) {
  const entries = Object.entries(values);
  if (!entries.length) return;

  const placeholders = entries.map(() => '(?, ?, ?)').join(', ');
  const params = entries.flatMap(([key, value]) => [key, String(value || ''), userId || null]);

  await query(
    `INSERT INTO system_settings (setting_key, setting_value, updated_by) VALUES ${placeholders}
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
    params
  );
}

export async function getSettings(req, res) {
  try {
    const rows = await readSettingsRows();
    res.json(normalizeSettings(rows));
  } catch (error) {
    res.status(500).json({ message: 'Không thể tải cài đặt hệ thống', error: error.message });
  }
}

export async function updateSettings(req, res) {
  try {
    const current = normalizeSettings(await readSettingsRows());
    const flatSettings = flattenSettings({ ...current, ...(req.body || {}) });
    const validationMessage = validateSettings(flatSettings);

    if (validationMessage) return res.status(400).json({ message: validationMessage });

    await saveSettingsMap(flatSettings, req.user?.id);
    res.json(normalizeSettings(await readSettingsRows()));
  } catch (error) {
    res.status(500).json({ message: 'Không thể lưu cài đặt hệ thống', error: error.message });
  }
}

export async function uploadShopLogo(req, res) {
  try {
    if (!req.file) return res.status(400).json({ message: 'Vui lòng chọn file logo' });

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(503).json({ message: 'Chưa cấu hình kho lưu trữ logo production' });
    }

    const extension = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp'
    }[req.file.mimetype];
    const currentSettings = normalizeSettings(await readSettingsRows());
    const blob = await put(`settings/shop-logo-${Date.now()}.${extension}`, req.file.buffer, {
      access: 'public',
      addRandomSuffix: true,
      contentType: req.file.mimetype
    });
    const logoUrl = blob.url;
    await saveSettingsMap({ shop_logo_url: logoUrl }, req.user?.id);

    const previousUrl = currentSettings.shopInfo.logoUrl;
    if (previousUrl && previousUrl.includes('.public.blob.vercel-storage.com/')) {
      del(previousUrl).catch((error) => {
        console.warn('Khong the xoa logo Blob cu:', error.message);
      });
    }
    res.json({ logoUrl });
  } catch (error) {
    res.status(500).json({ message: 'Không thể tải logo cửa hàng', error: error.message });
  }
}

export async function getVatSettings(req, res) {
  try {
    const settings = normalizeSettings(await readSettingsRows());
    res.json(settings.payment.vat);
  } catch (error) {
    res.status(500).json({ message: 'Không thể tải cài đặt VAT', error: error.message });
  }
}

export async function updateVatSettings(req, res) {
  try {
    const enabled = Boolean(req.body.enabled);
    const rate = Number(req.body.rate);
    if (!VAT_RATES.has(rate)) return res.status(400).json({ message: 'Mức VAT chỉ được chọn 0%, 5%, 8% hoặc 10%' });

    await saveSettingsMap({ vat_enabled: enabled ? '1' : '0', vat_rate: String(rate) }, req.user?.id);
    res.json({ enabled, rate });
  } catch (error) {
    res.status(500).json({ message: 'Không thể lưu cài đặt VAT', error: error.message });
  }
}

export async function getBankTransferSettings(req, res) {
  try {
    const settings = normalizeSettings(await readSettingsRows());
    res.json({
      bankId: settings.payment.vietQr.bankId || DEFAULT_BANK_TRANSFER.bankId,
      bankName: settings.payment.vietQr.bankName || DEFAULT_BANK_TRANSFER.bankName,
      accountNo: settings.payment.vietQr.accountNo || DEFAULT_BANK_TRANSFER.accountNo,
      accountName: settings.payment.vietQr.accountName || DEFAULT_BANK_TRANSFER.accountName
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

    if (!bankId || !bankName || !accountNo || !accountName) return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin tài khoản thụ hưởng' });
    if (!/^970\d{3}$/.test(bankId)) return res.status(400).json({ message: 'Mã BIN/NAPAS ngân hàng Việt Nam phải gồm 6 chữ số và bắt đầu bằng 970' });
    if (!/^\d{6,20}$/.test(accountNo)) return res.status(400).json({ message: 'Số tài khoản phải gồm từ 6 đến 20 chữ số' });

    await saveSettingsMap({
      bank_id: bankId,
      bank_name: bankName,
      bank_account_no: accountNo,
      bank_account_name: accountName
    }, req.user?.id);

    res.json({ bankId, bankName, accountNo, accountName });
  } catch (error) {
    res.status(500).json({ message: 'Không thể lưu thông tin chuyển khoản', error: error.message });
  }
}
