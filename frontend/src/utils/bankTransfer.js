import QRCode from 'qrcode';
import { QRPay } from 'vietnam-qr-pay';
import bankConfig from '../config/bank';
import api from '../api/axios';

export const bankOptions = [
  { bankId: '970422', bankName: 'MB Bank - Ngân hàng TMCP Quân đội' },
  { bankId: '970436', bankName: 'Vietcombank - Ngân hàng TMCP Ngoại thương Việt Nam' },
  { bankId: '970418', bankName: 'BIDV - Ngân hàng TMCP Đầu tư và Phát triển Việt Nam' },
  { bankId: '970407', bankName: 'Techcombank - Ngân hàng TMCP Kỹ thương Việt Nam' },
  { bankId: '970416', bankName: 'ACB - Ngân hàng TMCP Á Châu' },
  { bankId: '970415', bankName: 'VietinBank - Ngân hàng TMCP Công thương Việt Nam' },
  { bankId: '970432', bankName: 'VPBank - Ngân hàng TMCP Việt Nam Thịnh Vượng' },
  { bankId: '970423', bankName: 'TPBank - Ngân hàng TMCP Tiên Phong' }
];

export const defaultBankTransferSettings = {
  bankId: bankConfig.bankId,
  bankName: bankConfig.bankName,
  accountNo: bankConfig.accountNumber,
  accountName: bankConfig.accountName
};
let cachedBankTransferSettings = { ...defaultBankTransferSettings };

export function getBankById(bankId) {
  return bankOptions.find((bank) => bank.bankId === bankId);
}

export function validateBankName(value) {
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

export function getBankTransferSettings() {
  return { ...cachedBankTransferSettings };
}

export async function loadBankTransferSettings() {
  const { data } = await api.get('/settings/bank-transfer');
  cachedBankTransferSettings = { ...defaultBankTransferSettings, ...data };
  return getBankTransferSettings();
}

export async function saveBankTransferSettings(settings) {
  const { data } = await api.put('/settings/bank-transfer', settings);
  cachedBankTransferSettings = { ...defaultBankTransferSettings, ...data };
  window.dispatchEvent(new CustomEvent('bank-transfer-settings-updated', { detail: getBankTransferSettings() }));
  return getBankTransferSettings();
}

export function isBankTransferConfigured(settings = getBankTransferSettings()) {
  return Boolean(settings.bankId && settings.accountNo && settings.accountName);
}

export function buildTransferMemo() {
  const timeCode = Date.now().toString().slice(-6);
  const randomCode = Math.floor(1000 + Math.random() * 9000);

  return `ZTECH-${timeCode}-${randomCode}`;
}

export function buildVietQrPayload(settings, amount, memo) {
  const transferAmount = Math.round(Number(amount || 0));
  const purpose = String(memo || '').trim();

  const qrPay = QRPay.initVietQR({
    bankBin: String(settings.bankId || ''),
    bankNumber: String(settings.accountNo || ''),
    amount: String(transferAmount),
    purpose
  });

  return qrPay.build();
}

export async function buildVietQrDataUrl(settings, amount, memo) {
  const payload = buildVietQrPayload(settings, amount, memo);

  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 320,
    color: {
      dark: '#111827',
      light: '#ffffff'
    }
  });
}
