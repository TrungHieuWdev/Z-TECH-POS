import QRCode from 'qrcode';
import { QRPay } from 'vietnam-qr-pay';

export const BANK_TRANSFER_STORAGE_KEY = 'ztech-bank-transfer-settings';

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
  bankId: '970422',
  bankName: 'MB Bank - Ngân hàng TMCP Quân đội',
  accountNo: '0877724374',
  accountName: 'MAI TRAN THIEN TAM'
};

export function getBankById(bankId) {
  return bankOptions.find((bank) => bank.bankId === bankId);
}

export function getBankTransferSettings() {
  try {
    const saved = localStorage.getItem(BANK_TRANSFER_STORAGE_KEY);
    const settings = saved ? { ...defaultBankTransferSettings, ...JSON.parse(saved) } : defaultBankTransferSettings;
    const selectedBank = getBankById(settings.bankId);

    return {
      ...settings,
      bankName: selectedBank?.bankName || settings.bankName
    };
  } catch (error) {
    return defaultBankTransferSettings;
  }
}

export function saveBankTransferSettings(settings) {
  const selectedBank = getBankById(settings.bankId);
  const nextSettings = {
    ...defaultBankTransferSettings,
    ...settings,
    bankName: selectedBank?.bankName || settings.bankName,
    accountNo: String(settings.accountNo || '').trim(),
    accountName: String(settings.accountName || '').trim().toUpperCase()
  };

  localStorage.setItem(BANK_TRANSFER_STORAGE_KEY, JSON.stringify(nextSettings));
  return nextSettings;
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
