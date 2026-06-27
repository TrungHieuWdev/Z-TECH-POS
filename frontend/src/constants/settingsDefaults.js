export const SETTINGS_TABS = [
  { id: 'shop', label: 'Thông tin cửa hàng' },
  { id: 'print', label: 'In hóa đơn' },
  { id: 'payment', label: 'Thanh toán' },
  { id: 'inventory', label: 'Kho hàng' },
  { id: 'security', label: 'Bảo mật tài khoản' }
];

export const PAPER_SIZE_OPTIONS = [
  { value: 'K80', label: 'K80 / 80mm' },
  { value: 'A4', label: 'A4' }
];

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Tiền mặt' },
  { value: 'transfer', label: 'Chuyển khoản ngân hàng' },
  { value: 'qr', label: 'QR Code' }
];

export const DEFAULT_SETTINGS = {
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
      transfer: true,
      qr: true
    },
    defaultMethod: 'cash',
    vietQr: {
      bankId: '970436',
      bankName: 'Vietcombank - Ngan hang TMCP Ngoai thuong Viet Nam',
      accountNo: '1033519890',
      accountName: 'NGUYEN HOANG TRUNG HIEU',
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
    allowOutOfStockSale: false,
    restockSuggestions: true
  }
};

export const ROLE_BADGES = {
  owner: 'bg-purple-50 text-purple-700 ring-purple-200',
  admin: 'bg-purple-50 text-purple-700 ring-purple-200',
  manager: 'bg-sky-50 text-sky-700 ring-sky-200',
  cashier: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  employee: 'bg-slate-100 text-slate-700 ring-slate-200',
  staff: 'bg-slate-100 text-slate-700 ring-slate-200'
};

export function mergeSettings(settings) {
  return {
    ...DEFAULT_SETTINGS,
    ...(settings || {}),
    shopInfo: { ...DEFAULT_SETTINGS.shopInfo, ...(settings?.shopInfo || {}) },
    print: { ...DEFAULT_SETTINGS.print, ...(settings?.print || {}) },
    payment: {
      ...DEFAULT_SETTINGS.payment,
      ...(settings?.payment || {}),
      methods: { ...DEFAULT_SETTINGS.payment.methods, ...(settings?.payment?.methods || {}) },
      vietQr: { ...DEFAULT_SETTINGS.payment.vietQr, ...(settings?.payment?.vietQr || {}) },
      vat: { ...DEFAULT_SETTINGS.payment.vat, ...(settings?.payment?.vat || {}) }
    },
    inventory: { ...DEFAULT_SETTINGS.inventory, ...(settings?.inventory || {}) }
  };
}
