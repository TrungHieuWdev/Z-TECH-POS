import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  CreditCard,
  Minus,
  Plus,
  Printer,
  ReceiptText,
  ScanLine,
  Search,
  Smartphone,
  UserRound,
  UserSearch,
  UsersRound,
  WalletCards,
  X
} from 'lucide-react';
import api from '../api/axios';
import Modal from '../components/Modal';``
import ProductImage from '../components/ProductImage';
import { DEFAULT_SETTINGS, mergeSettings } from '../constants/settingsDefaults';
import { getSettings, getUploadedAssetUrl } from '../services/settingsService';
import {
  buildTransferMemo,
  buildVietQrDataUrl,
  getBankTransferSettings,
  isBankTransferConfigured,
  loadBankTransferSettings
} from '../utils/bankTransfer';
import { formatCurrency } from '../utils/format';
import { getWarrantyLabel } from '../utils/warrantyPolicy';
import { getPromotionDiscount, getPromotions, isPromotionEligible } from '../services/promotionService';
import { initialPromotions } from './Promotions';
import { isVietnamPhone, normalizePhone, vietnamPhoneMessage } from '../utils/phone';
import { customerNameMessage, isValidCustomerName, normalizeCustomerName } from '../utils/customerName';
import { getUser } from '../utils/auth';

const paymentOptions = [
  { value: 'cash', label: 'Tiền mặt', icon: Banknote },
  { value: 'transfer', label: 'Chuyển khoản', icon: WalletCards }
];

const paymentLabels = {
  cash: 'Tiền mặt',
  transfer: 'Chuyển khoản'
};

function getPaymentLabel(method) {
  if (method === 'qr') return 'QR Code';
  return paymentLabels[method] || method;
}

const TRANSFER_CONFIRM_TIMEOUT_SECONDS = 10 * 60;

const deviceFamilyOptions = [
  { value: 'apple', label: 'Phụ kiện Apple' },
  { value: 'samsung', label: 'Phụ kiện Samsung' },
  { value: 'vivo', label: 'Phụ kiện Vivo' },
  { value: 'oppo', label: 'Phụ kiện Oppo' },
  { value: 'xiaomi', label: 'Phụ kiện Xiaomi' },
  { value: 'other', label: 'Phụ kiện chung' }
];

const initialCustomerForm = { name: '', phone: '', email: '', address: '' };

function toMoneyAmount(value) {
  return Math.max(Number(value || 0), 0);
}

function formatCountdown(totalSeconds) {
  const safeSeconds = Math.max(Number(totalSeconds || 0), 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getProductSku(product) {
  return `SKU: PRD-${String(product.id).padStart(4, '0')}`;
}

function getStockTone(stock) {
  const value = Number(stock || 0);

  if (value <= 0) return 'bg-red-100 text-red-700';
  if (value <= 8) return 'bg-amber-100 text-amber-700';
  return 'bg-green-100 text-green-700';
}

function buildOrderItems(cart) {
  return cart.map((item) => ({ product_id: item.id, quantity: item.quantity }));
}

function buildReceiptItems(cart) {
  return cart.map((item) => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unitPrice: Number(item.price || 0),
    lineTotal: Number(item.price || 0) * item.quantity,
    warranty_enabled: item.warranty_enabled,
    warranty_period_days: item.warranty_period_days,
    warranty_type: item.warranty_type,
    warranty_note: item.warranty_note
  }));
}

function MobileCartLauncher({ itemCount, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="no-print fixed right-0 top-1/2 z-50 flex h-14 -translate-y-1/2 items-center gap-1 bg-[#0f3b46] px-2 text-white shadow-[0_10px_30px_rgba(15,59,70,0.3)] xl:hidden"
      aria-label="Mở giỏ hàng"
    >
      <ChevronLeft size={20} />
      <span className="grid h-6 min-w-6 place-items-center bg-[#74B8E0] px-1 text-xs font-extrabold text-white">{itemCount}</span>
    </button>
  );
}

function ReceiptContent({ receipt }) {
  if (!receipt) return null;

  const shopInfo = receipt.shopInfo || {};
  const logoSrc = getUploadedAssetUrl(shopInfo.logoUrl);
  const shopName = shopInfo.name || 'Z-TECH POS';
  const createdAt = receipt.createdAt ? new Date(receipt.createdAt) : new Date();
  const createdAtLabel = Number.isNaN(createdAt.getTime())
    ? String(receipt.createdAt || '')
    : createdAt.toLocaleString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
  const discountTotal = Number(receipt.discount || 0) + Number(receipt.pointsDiscountAmount || 0);
  const infoRows = [
    { label: 'Mã đơn', value: receipt.orderNumber, icon: ReceiptText, emphasize: true },
    { label: 'Ngày giờ', value: createdAtLabel, icon: CalendarDays },
    { label: 'Thu ngân', value: receipt.cashierName || 'Nhân viên', icon: UserRound },
    { label: 'Khách hàng', value: receipt.customerName || 'Khách thường', icon: UsersRound },
    { label: 'Phương thức thanh toán', value: getPaymentLabel(receipt.paymentMethod), icon: CreditCard }
  ];

  return (
    <div className="space-y-3 text-sm text-gray-950">
      <div className="text-center">
        {logoSrc && <img src={logoSrc} alt={`Logo ${shopName}`} className="mx-auto mb-1.5 h-14 w-14 object-contain sm:h-16 sm:w-16" />}
        <div className="text-xl font-extrabold tracking-tight text-[#74B8E0]">{shopName}</div>
        {shopInfo.address && <div className="mt-1 text-xs font-medium text-gray-600">{shopInfo.address}</div>}
        {shopInfo.phone && <div className="mt-0.5 text-xs font-semibold text-gray-700">Hotline: {shopInfo.phone}</div>}
        <div className="mt-2 flex items-center justify-center gap-3 text-base font-extrabold uppercase tracking-wide text-[#74B8E0] before:h-px before:w-8 before:bg-gray-300 after:h-px after:w-8 after:bg-gray-300 sm:text-lg">
          Hóa đơn bán hàng
        </div>
      </div>

      <div className="grid gap-2 rounded-lg border border-gray-200 bg-gray-50/70 p-3 sm:grid-cols-2 sm:gap-x-8">
        {infoRows.map(({ label, value, icon: Icon, emphasize }, index) => (
          <div key={label} className={`grid grid-cols-[22px_115px_minmax(0,1fr)] items-center gap-1.5 ${index === infoRows.length - 1 ? 'sm:col-span-2' : ''}`}>
            <Icon size={16} className="text-[#74B8E0]" />
            <span className="font-medium text-gray-600">{label}</span>
            <span className={`min-w-0 break-words font-semibold ${emphasize ? 'text-[#74B8E0]' : 'text-gray-950'}`}>{value}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col overflow-hidden rounded-lg border border-gray-200 sm:min-h-[380px]">
        <div className="overflow-x-auto sm:flex-1">
          <table className="w-full min-w-[620px] table-fixed text-left text-xs sm:text-sm">
            <thead className="bg-[#74B8E0] text-white">
              <tr>
                <th className="w-12 px-3 py-2 text-center font-bold">STT</th>
                <th className="px-3 py-2 font-bold">Tên sản phẩm</th>
                <th className="w-20 px-3 py-2 text-center font-bold">Số lượng</th>
                <th className="w-32 px-3 py-2 text-right font-bold">Đơn giá</th>
                <th className="w-32 px-3 py-2 text-right font-bold">Thành tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {receipt.items.map((item, index) => (
                <tr key={item.id} className="align-top">
                  <td className="px-3 py-2 text-center text-gray-600">{index + 1}</td>
                  <td className="px-3 py-2">
                    <div className="font-semibold text-gray-950">{item.name}</div>
                    <div className="mt-0.5 text-[11px] text-gray-500">
                      {getWarrantyLabel(item)}{Number(item.warranty_period_days || 0) > 0 ? ` · ${Number(item.warranty_period_days).toLocaleString('vi-VN')} ngày` : ''}
                    </div>
                    {item.warranty_note && <div className="mt-0.5 text-[11px] text-gray-500">{item.warranty_note}</div>}
                  </td>
                  <td className="px-3 py-2 text-center">{item.quantity}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(item.unitPrice)}</td>
                  <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{formatCurrency(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-auto border-t border-gray-200 bg-gray-50/50 px-3 py-2.5 sm:px-4">
          <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-8 gap-y-1.5">
            <span className="text-gray-600">Tạm tính</span><span className="text-right font-medium">{formatCurrency(receipt.subtotal)}</span>
            <span className="text-gray-600">Giảm giá</span><span className="text-right font-medium">{discountTotal > 0 ? `-${formatCurrency(discountTotal)}` : formatCurrency(0)}</span>
            <span className="text-gray-600">VAT ({Number(receipt.vatRate || 0).toLocaleString('vi-VN')}%)</span><span className="text-right font-medium">{formatCurrency(receipt.vatAmount)}</span>
            {receipt.paymentMethod === 'cash' && (
              <>
                <span className="text-gray-600">Tiền khách đưa</span><span className="text-right font-medium">{formatCurrency(receipt.customerPaid)}</span>
                <span className="text-gray-600">Tiền thừa</span><span className="text-right font-medium text-emerald-700">{formatCurrency(receipt.changeDue)}</span>
              </>
            )}
            <span className="mt-1 border-t border-dashed border-gray-300 pt-2 text-base font-extrabold">Tổng cộng</span>
            <span className="mt-1 border-t border-dashed border-gray-300 pt-2 text-right text-lg font-extrabold">{formatCurrency(receipt.total)}</span>
          </div>
        </div>
      </div>

      {Number(receipt.pointsEarned || 0) > 0 && <p className="text-center text-xs font-semibold text-[#74B8E0]">Khách hàng được cộng {Number(receipt.pointsEarned).toLocaleString('vi-VN')} điểm sau giao dịch này.</p>}
    </div>
  );
}

function ThermalReceiptContent({ receipt }) {
  if (!receipt) return null;

  const shopInfo = receipt.shopInfo || {};
  const logoSrc = getUploadedAssetUrl(shopInfo.logoUrl);
  const shopName = shopInfo.name || 'Z-TECH POS';
  const createdAt = receipt.createdAt ? new Date(receipt.createdAt) : new Date();
  const createdAtLabel = Number.isNaN(createdAt.getTime())
    ? String(receipt.createdAt || '')
    : createdAt.toLocaleString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
  const printedAtLabel = createdAtLabel;
  const discountTotal = Number(receipt.discount || 0) + Number(receipt.pointsDiscountAmount || 0);
  const footer = receipt.print?.footer || 'Cảm ơn quý khách và hẹn gặp lại.';

  return (
    <div className="thermal-receipt">
      <div className="thermal-meta">
        <span>{printedAtLabel}</span>
        <span>Hóa đơn {receipt.orderNumber} - {shopName}</span>
      </div>
      <header className="thermal-header">
        {logoSrc && <img src={logoSrc} alt={`Logo ${shopName}`} />}
        <h1>{shopName}</h1>
        {shopInfo.address && <p>{shopInfo.address}</p>}
        {shopInfo.phone && <p>Hotline: {shopInfo.phone}</p>}
      </header>

      <section className="thermal-section thermal-title">HÓA ĐƠN BÁN HÀNG</section>

      <section className="thermal-info">
        <div><strong>Mã hóa đơn:</strong><p>{receipt.orderNumber}</p></div>
        <div><strong>Ngày giờ:</strong><p>{createdAtLabel}</p></div>
        <div><strong>Thu ngân:</strong><p>{receipt.cashierName || 'Nhân viên'}</p></div>
        <div><strong>Khách hàng:</strong><p>{receipt.customerName || 'Khách thường'}</p></div>
      </section>

      <section className="thermal-products">
        <div className="thermal-product-head">
          <strong>Tên sản phẩm</strong><strong>SL</strong><strong>Đơn giá</strong><strong>Thành tiền</strong>
        </div>
        {receipt.items.map((item) => (
          <div key={item.id} className="thermal-product-row">
            <div>
              <strong>{item.name}</strong>
              <small>PRD-{String(item.id).padStart(4, '0')}</small>
              <small>{getWarrantyLabel(item)}</small>
              {item.warranty_note && <small>{item.warranty_note}</small>}
            </div>
            <span>{item.quantity}</span>
            <span>{Number(item.unitPrice || 0).toLocaleString('vi-VN')}</span>
            <strong>{Number(item.lineTotal || 0).toLocaleString('vi-VN')}</strong>
          </div>
        ))}
      </section>

      <section className="thermal-totals">
        <div><span>Tạm tính</span><span>{Number(receipt.subtotal || 0).toLocaleString('vi-VN')}</span></div>
        {discountTotal > 0 && <div><span>Giảm giá</span><span>-{discountTotal.toLocaleString('vi-VN')}</span></div>}
        {Number(receipt.vatAmount || 0) > 0 && <div><span>VAT ({Number(receipt.vatRate || 0).toLocaleString('vi-VN')}%)</span><span>{Number(receipt.vatAmount || 0).toLocaleString('vi-VN')}</span></div>}
        <div><span>Hình thức thanh toán</span><span>{getPaymentLabel(receipt.paymentMethod)}</span></div>
        {receipt.paymentMethod === 'cash' && (
          <>
            <div><span>Tiền khách đưa</span><span>{Number(receipt.customerPaid || 0).toLocaleString('vi-VN')}</span></div>
            <div className="thermal-change"><strong>Tiền thừa</strong><strong>{Number(receipt.changeDue || 0).toLocaleString('vi-VN')}</strong></div>
          </>
        )}
        <div className="thermal-total"><strong>TỔNG CỘNG</strong><strong>{Number(receipt.total || 0).toLocaleString('vi-VN')}</strong></div>
      </section>

      <footer className="thermal-footer">
        <strong>Cảm ơn quý khách đã mua sắm!</strong>
        <p>{footer}</p>
        <small>POWERED BY {shopName}</small>
      </footer>
    </div>
  );
}

export default function POS() {
  const [searchParams] = useSearchParams();
  const routeSearch = searchParams.get('search') || '';
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cart, setCart] = useState([]);
  const [quantityDrafts, setQuantityDrafts] = useState({});
  const [search, setSearch] = useState(routeSearch);
  const [scanCode, setScanCode] = useState('');
  const [scanMode, setScanMode] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const scanInputRef = useRef(null);
  const scanModeRef = useRef(false);
  const [categoryId, setCategoryId] = useState('');
  const [deviceFamily, setDeviceFamily] = useState('');
  const [usedPoints, setUsedPoints] = useState(0);
  const [promotions, setPromotions] = useState(() => getPromotions(initialPromotions));
  const [selectedPromotion, setSelectedPromotion] = useState(null);
  const [isPromotionOpen, setIsPromotionOpen] = useState(false);
  const [customerPaid, setCustomerPaid] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [customerName, setCustomerName] = useState('Khách thường');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerMode, setCustomerMode] = useState('regular');
  const [customerLookup, setCustomerLookup] = useState('');
  const [customerForm, setCustomerForm] = useState(initialCustomerForm);
  const [loading, setLoading] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isClearCartOpen, setIsClearCartOpen] = useState(false);
  const [isCustomerPickerOpen, setIsCustomerPickerOpen] = useState(false);
  const [isCustomerFormOpen, setIsCustomerFormOpen] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [mobileCartView, setMobileCartView] = useState('cart');
  const [receipt, setReceipt] = useState(null);
  const [posSettings, setPosSettings] = useState(DEFAULT_SETTINGS);
  const [transferMemo, setTransferMemo] = useState('');
  const [bankTransfer, setBankTransfer] = useState(getBankTransferSettings);
  const [vietQrDataUrl, setVietQrDataUrl] = useState('');
  const [checkoutStep, setCheckoutStep] = useState('confirm');
  const [transferCountdown, setTransferCountdown] = useState(TRANSFER_CONFIRM_TIMEOUT_SECONDS);
  const [pageError, setPageError] = useState('');
  const [isPageLoading, setIsPageLoading] = useState(true);

  useEffect(() => {
    loadBankTransferSettings()
      .then(setBankTransfer)
      .catch(() => {});

    const handleBankSettingsUpdate = (event) => setBankTransfer(event.detail);
    window.addEventListener('bank-transfer-settings-updated', handleBankSettingsUpdate);
    return () => window.removeEventListener('bank-transfer-settings-updated', handleBankSettingsUpdate);
  }, []);

  useEffect(() => {
    let isMounted = true;
    getSettings()
      .then((data) => {
        if (isMounted) setPosSettings(mergeSettings(data));
      })
      .catch(() => {});

    const handleSettingsUpdate = (event) => {
      setPosSettings(mergeSettings(event.detail));
    };

    window.addEventListener('settings-updated', handleSettingsUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('settings-updated', handleSettingsUpdate);
    };
  }, []);

  useEffect(() => {
    scanModeRef.current = scanMode;
    if (scanMode) {
      requestAnimationFrame(() => scanInputRef.current?.focus());
    }
  }, [scanMode]);

  useEffect(() => {
    const pauseScanningForAnotherField = (event) => {
      if (!scanModeRef.current || event.target === scanInputRef.current) return;
      if (event.target.matches?.('input, textarea, select, [contenteditable="true"]')) {
        setScanMode(false);
      }
    };

    document.addEventListener('focusin', pauseScanningForAnotherField);
    return () => document.removeEventListener('focusin', pauseScanningForAnotherField);
  }, []);

  useEffect(() => {
    if (isConfirmOpen || isCustomerPickerOpen || isCustomerFormOpen || isPromotionOpen) {
      setScanMode(false);
    }
  }, [isConfirmOpen, isCustomerPickerOpen, isCustomerFormOpen, isPromotionOpen]);


  useEffect(() => {
    if (!isMobileCartOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileCartOpen]);

  async function loadProducts() {
    const params = new URLSearchParams();

    if (search) params.set('search', search);
    if (categoryId) params.set('category_id', categoryId);
    if (deviceFamily) params.set('device_family', deviceFamily);

    const response = await api.get(`/products?${params.toString()}`);
    setProducts(Array.isArray(response.data) ? response.data : []);
  }

  async function loadCustomers(searchValue = customerLookup) {
    const params = new URLSearchParams();
    if (searchValue) params.set('search', searchValue);

    const response = await api.get(`/customers?${params.toString()}`);
    setCustomers(Array.isArray(response.data) ? response.data : []);
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      setIsPageLoading(true);
      setPageError('');

      try {
        const [categoriesResponse] = await Promise.all([
          api.get('/categories'),
          loadCustomers(''),
          loadProducts()
        ]);

        if (!isMounted) {
          return;
        }

        setCategories(Array.isArray(categoriesResponse.data) ? categoriesResponse.data : []);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setCategories([]);
        setProducts([]);
        setCustomers([]);
        setPageError(error.response?.data?.message || 'Không thể tải dữ liệu bán hàng');
      } finally {
        if (isMounted) {
          setIsPageLoading(false);
        }
      }
    }

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    // Tu khoa den tu thanh tim nhanh header se tim toan bo POS, khong giu bo loc cu.
    setSearch(routeSearch);
    setCategoryId('');
    setDeviceFamily('');
  }, [routeSearch]);

  useEffect(() => {
    let isMounted = true;

    loadProducts().catch((error) => {
      if (!isMounted) {
        return;
      }

      setProducts([]);
      setPageError(error.response?.data?.message || 'Không thể tải sản phẩm cho POS');
    });

    return () => {
      isMounted = false;
    };
  }, [search, categoryId, deviceFamily]);

  useEffect(() => {
    let isMounted = true;

    loadCustomers(customerLookup).catch((error) => {
      if (!isMounted) {
        return;
      }

      setCustomers([]);
      setPageError(error.response?.data?.message || 'Không thể tải danh sách khách hàng');
    });

    return () => {
      isMounted = false;
    };
  }, [customerLookup]);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0),
    [cart]
  );

  const eligiblePromotions = useMemo(() => promotions.filter((promotion) => isPromotionEligible(promotion, { cart, subtotal, isMember: Boolean(selectedCustomer) })), [promotions, cart, subtotal, selectedCustomer]);
  const promotionDiscount = selectedPromotion ? getPromotionDiscount(selectedPromotion, subtotal) : 0;

  const amountAfterPromotion = Math.max(subtotal - promotionDiscount, 0);
  const availablePoints = selectedCustomer ? Math.max(Number(selectedCustomer.points) || 0, 0) : 0;
  const maxRedeemValue = amountAfterPromotion * 0.2;
  const maxRedeemPoints = cart.length > 0
    ? Math.floor(Math.min(availablePoints, maxRedeemValue / 1000))
    : 0;
  const normalizedUsedPoints = Math.min(Math.max(Math.floor(Number(usedPoints) || 0), 0), maxRedeemPoints);
  const pointsDiscountAmount = normalizedUsedPoints * 1000;
  const amountAfterPoints = Math.max(amountAfterPromotion - pointsDiscountAmount, 0);
  const vatEnabled = Boolean(posSettings.payment?.vat?.enabled);
  const vatRate = vatEnabled ? Math.max(0, Math.min(100, Number(posSettings.payment?.vat?.rate) || 0)) : 0;
  const vatAmount = vatRate > 0 ? Math.round((amountAfterPoints * vatRate) / 100) : 0;
  const totalBeforeVat = amountAfterPoints;
  const total = totalBeforeVat + vatAmount;
  const allowOutOfStockSale = Boolean(posSettings.inventory?.allowOutOfStockSale);
  const earnedPoints = selectedCustomer ? Math.floor(total / 10000) : 0;
  const hasCustomerPaid = String(customerPaid).trim() !== '';
  const customerPaidValue = toMoneyAmount(customerPaid);
  const changeDue = paymentMethod === 'cash' ? Math.max(customerPaidValue - total, 0) : 0;
  const amountMissing =
    paymentMethod === 'cash' && hasCustomerPaid ? Math.max(total - customerPaidValue, 0) : 0;
  const enabledPaymentOptions = useMemo(() => {
    const methods = posSettings.payment?.methods || {};
    const options = [];

    if (methods.cash !== false) {
      options.push(paymentOptions.find((option) => option.value === 'cash'));
    }
    if (methods.transfer !== false) {
      options.push(paymentOptions.find((option) => option.value === 'transfer'));
    }
    if (methods.qr) {
      options.push({ value: 'qr', label: 'QR Code', icon: Smartphone });
    }

    return options.filter(Boolean);
  }, [posSettings.payment?.methods]);

  useEffect(() => {
    const refresh = () => setPromotions(getPromotions(initialPromotions));
    window.addEventListener('ztech-promotions-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('ztech-promotions-changed', refresh); window.removeEventListener('storage', refresh); };
  }, []);

  useEffect(() => {
    if (selectedPromotion && !isPromotionEligible(selectedPromotion, { cart, subtotal, isMember: Boolean(selectedCustomer) })) {
      setSelectedPromotion(null);
      toast.error('Khuyến mãi đã được gỡ vì giỏ hàng không còn đủ điều kiện.');
    }
  }, [cart, subtotal, selectedCustomer, selectedPromotion]);

  useEffect(() => {
    if (Number(usedPoints) > maxRedeemPoints) {
      setUsedPoints(maxRedeemPoints);
    }
  }, [maxRedeemPoints, usedPoints]);

  useEffect(() => {
    if (!enabledPaymentOptions.length) return;
    if (enabledPaymentOptions.some((option) => option.value === paymentMethod)) return;

    const configuredDefault = posSettings.payment?.defaultMethod;
    const nextMethod = enabledPaymentOptions.some((option) => option.value === configuredDefault)
      ? configuredDefault
      : enabledPaymentOptions[0].value;
    setPaymentMethod(nextMethod);
  }, [enabledPaymentOptions, paymentMethod, posSettings.payment?.defaultMethod]);

  const toggleDeviceFamily = (value) => {
    // Tim nhanh theo dong may tach rieng voi loc danh muc san pham chung.
    setDeviceFamily((current) => (current === value ? '' : value));
  };

  const handlePointsChange = (value) => {
    if (value === '') {
      setUsedPoints('');
      return;
    }

    if (!/^\d+$/.test(value)) return;
    const requested = Math.floor(Number(value));
    if (requested > maxRedeemPoints) {
      setUsedPoints(maxRedeemPoints);
      toast.error(`Chỉ có thể dùng tối đa ${maxRedeemPoints} điểm`);
      return;
    }
    setUsedPoints(requested);
  };

  const addToCart = (product) => {
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);

      if (found) {
        if (!allowOutOfStockSale && found.quantity >= Number(product.stock_quantity)) {
          toast.error('Không đủ tồn kho');
          return current;
        }

        return current.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }

      if (!allowOutOfStockSale && Number(product.stock_quantity) <= 0) {
        toast.error('Sản phẩm đã hết hàng');
        return current;
      }

      return [...current, { ...product, quantity: 1 }];
    });
  };

  const handleScanSubmit = async (event) => {
    event.preventDefault();
    const code = scanCode.trim();
    if (!scanMode || !code || isScanning) return;

    setIsScanning(true);
    try {
      const response = await api.get(`/products/barcode/${encodeURIComponent(code)}`);
      const product = response.data;

      if (!allowOutOfStockSale && Number(product.stock_quantity) <= 0) {
        toast.error('Sản phẩm đã hết hàng');
        setScanCode('');
        return;
      }

      const existingItem = cart.find((item) => item.id === product.id);
      if (!allowOutOfStockSale && existingItem && existingItem.quantity >= Number(product.stock_quantity)) {
        toast.error('Không đủ tồn kho');
        setScanCode('');
        return;
      }

      addToCart(product);
      toast.success('Đã thêm sản phẩm vào giỏ hàng');
      setScanCode('');
    } catch (error) {
      setScanCode('');
      toast.error(error.response?.status === 404
        ? 'Không tìm thấy sản phẩm với mã vạch này'
        : error.response?.data?.message || 'Không thể kiểm tra mã sản phẩm');
    } finally {
      setIsScanning(false);
      if (scanModeRef.current) {
        requestAnimationFrame(() => scanInputRef.current?.focus());
      }
    }
  };

  const updateQuantity = (productId, nextQuantity) => {
    const normalizedQuantity = Number.isFinite(Number(nextQuantity))
      ? Math.floor(Number(nextQuantity))
      : 0;

    setCart((current) =>
      current
        .map((item) =>
          item.id === productId
            ? {
                ...item,
                quantity: allowOutOfStockSale
                  ? Math.max(normalizedQuantity, 0)
                  : Math.min(Math.max(normalizedQuantity, 0), Number(item.stock_quantity))
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const setCartQuantity = (productId, nextQuantity) => {
    setQuantityDrafts((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
    updateQuantity(productId, nextQuantity);
  };

  const handleQuantityInput = (productId, value) => {
    if (!/^\d*$/.test(value)) return;

    setQuantityDrafts((current) => ({ ...current, [productId]: value }));

    if (value !== '') {
      updateQuantity(productId, Number(value));
    }
  };

  const commitQuantityInput = (productId, value) => {
    if (value === '') {
      setQuantityDrafts((current) => {
        const next = { ...current };
        delete next[productId];
        return next;
      });
      return;
    }

    setCartQuantity(productId, Number(value));
  };

  const removeItem = (productId) => {
    setQuantityDrafts((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
    setCart((current) => current.filter((item) => item.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setQuantityDrafts({});
    setUsedPoints(0);
    setSelectedPromotion(null);
    setCustomerPaid('');
    setIsClearCartOpen(false);
  };

  const requestClearCart = () => {
    if (cart.length === 0) {
      toast.error('Giỏ hàng đang trống');
      return;
    }

    setIsClearCartOpen(true);
  };

  const selectWalkInCustomer = () => {
    setUsedPoints(0);
    setCustomerMode('regular');
    setSelectedCustomer(null);
    setCustomerName('Khách thường');
    setIsCustomerPickerOpen(false);
  };

  const selectCustomer = (customer) => {
    setUsedPoints(0);
    setCustomerMode('member');
    setSelectedCustomer(customer);
    setCustomerName(customer.name || 'Khách thường');
    setIsCustomerPickerOpen(false);
  };

  const openCustomerForm = () => {
    setCustomerForm(initialCustomerForm);
    setIsCustomerPickerOpen(false);
    setIsCustomerFormOpen(true);
  };

  const createCustomerFromPos = async (event) => {
    event.preventDefault();

    const payload = {
      ...customerForm,
      name: normalizeCustomerName(customerForm.name),
      phone: normalizePhone(customerForm.phone)
    };

    if (!isValidCustomerName(payload.name)) {
      toast.error(customerNameMessage);
      return;
    }

    if (!isVietnamPhone(payload.phone)) {
      toast.error(vietnamPhoneMessage);
      return;
    }

    try {
      const response = await api.post('/customers', payload);
      const createdCustomer = response.data;

      selectCustomer(createdCustomer);
      setCustomerForm(initialCustomerForm);
      setIsCustomerFormOpen(false);
      await loadCustomers(customerLookup);
      toast.success('Đã thêm khách hàng để tích điểm');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể thêm khách hàng');
    }
  };

  const openCheckoutConfirm = () => {
    if (cart.length === 0) {
      toast.error('Giỏ hàng đang trống');
      return;
    }

    const latestBankTransfer = bankTransfer;
    if ((paymentMethod === 'transfer' || paymentMethod === 'qr') && !isBankTransferConfigured(latestBankTransfer)) {
      toast.error('Chưa cấu hình thông tin ngân hàng chuyển khoản');
      return;
    }

    setBankTransfer(latestBankTransfer);
    setTransferMemo('');
    setVietQrDataUrl('');
    setCheckoutStep('confirm');
    setIsConfirmOpen(true);
  };

  const continueToTransferPayment = async () => {
    const latestBankTransfer = bankTransfer;

    if (!isBankTransferConfigured(latestBankTransfer)) {
      toast.error('Chưa cấu hình thông tin ngân hàng chuyển khoản');
      return;
    }

    const nextTransferMemo = buildTransferMemo();

    setLoading(true);

    try {
      const nextVietQrDataUrl = await buildVietQrDataUrl(latestBankTransfer, total, nextTransferMemo);

      setBankTransfer(latestBankTransfer);
      setTransferMemo(nextTransferMemo);
      setVietQrDataUrl(nextVietQrDataUrl);
      setCheckoutStep('transfer');
    } catch (error) {
      toast.error('Không thể tạo mã QR chuyển khoản');
    } finally {
      setLoading(false);
    }
  };

  const confirmCheckout = async () => {
    const receiptItems = buildReceiptItems(cart);

    setLoading(true);

    try {
      const response = await api.post('/orders', {
        customer_id: selectedCustomer?.id || null,
        items: buildOrderItems(cart),
        promotion_discount: promotionDiscount,
        points_used: normalizedUsedPoints,
        payment_method: paymentMethod === 'qr' ? 'transfer' : paymentMethod
      });

      setReceipt({
        orderNumber: response.data.order_number,
        createdAt: response.data.created_at || new Date().toISOString(),
        cashierName: getUser()?.name || 'Nhân viên',
        customerName,
        paymentMethod,
        items: receiptItems,
        subtotal,
        discount: promotionDiscount,
        pointsUsed: normalizedUsedPoints,
        pointsDiscountAmount,
        pointsEarned: Number(response.data.points_earned || earnedPoints),
        total,
        customerPaid: paymentMethod === 'cash' && hasCustomerPaid ? customerPaidValue : total,
        changeDue,
        vatRate,
        vatAmount,
        totalBeforeVat,
        shopInfo: posSettings.shopInfo,
        print: posSettings.print,
        transferMemo: paymentMethod === 'transfer' || paymentMethod === 'qr' ? transferMemo : ''
      });
      setIsConfirmOpen(false);
      setCheckoutStep('confirm');
      clearCart();
      selectWalkInCustomer();
      await loadCustomers(customerLookup);
      await loadProducts();
      toast.success('Thanh toán thành công');
      if (posSettings.print?.autoPrintAfterPayment) {
        setTimeout(() => printReceipt(), 250);
      }
      setIsMobileCartOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể thanh toán');
    } finally {
      setLoading(false);
    }
  };

  const printReceipt = async () => {
    if (document.fonts?.ready) await document.fonts.ready;

    const receiptImages = Array.from(document.querySelectorAll('.print-receipt img'));
    await Promise.all(receiptImages.map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise((resolve) => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
      });
    }));

    const dynamicPageStyle = document.createElement('style');
    dynamicPageStyle.setAttribute('data-thermal-page-size', 'true');
    document.head.appendChild(dynamicPageStyle);

    const prepareThermalPage = () => {
      const bill = document.querySelector('.thermal-receipt');
      if (!bill) return;

      const contentHeightPx = Math.max(bill.scrollHeight, bill.getBoundingClientRect().height);
      const contentHeightMm = (contentHeightPx * 25.4) / 96;
      const pageHeightMm = Math.max(80, Math.ceil(contentHeightMm + 1));
      dynamicPageStyle.textContent = `@page { size: 80mm ${pageHeightMm}mm; margin: 0; }`;
    };

    const cleanupPrintStyle = () => {
      dynamicPageStyle.remove();
      window.removeEventListener('beforeprint', prepareThermalPage);
      window.removeEventListener('afterprint', cleanupPrintStyle);
    };

    window.addEventListener('beforeprint', prepareThermalPage);
    window.addEventListener('afterprint', cleanupPrintStyle, { once: true });
    window.print();
  };

  const copyToClipboard = async (value, label) => {
    try {
      await navigator.clipboard.writeText(String(value));
      toast.success(`Đã sao chép ${label}`);
    } catch (error) {
      toast.error(`Không thể sao chép ${label}`);
    }
  };

  const closeCheckoutConfirm = () => {
    if (loading) return;

    setIsConfirmOpen(false);
    setCheckoutStep('confirm');
  };

  const isTransferQrStep = (paymentMethod === 'transfer' || paymentMethod === 'qr') && checkoutStep === 'transfer';

  return (
    <>
    <div className="no-print mb-4">
    </div>
    {pageError && (
      <div className="no-print mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
        {pageError}
      </div>
    )}
    <div className="no-print grid min-h-0 overflow-visible border border-[#c3c6d7] bg-[#f7f9fb] xl:h-[calc(100vh-10.5rem)] xl:min-h-[680px] xl:overflow-hidden xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
      <section className="flex min-w-0 flex-col overflow-visible p-3 pb-24 sm:p-4 sm:pb-24 xl:overflow-hidden xl:p-5">
        <form onSubmit={handleScanSubmit} className="mb-3">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px]">
            <div className="relative">
              <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-strong" />
              <input
                ref={scanInputRef}
                value={scanCode}
                onChange={(event) => setScanCode(event.target.value)}
                disabled={isScanning}
                readOnly={!scanMode}
                inputMode="none"
                autoComplete="off"
                aria-label="Ô nhập mã vạch"
                className={`h-11 w-full border bg-white pl-10 pr-4 text-sm font-semibold text-[#191c1e] outline-none focus:ring-2 focus:ring-brand-soft disabled:opacity-60 ${scanMode ? 'border-brand' : 'cursor-default border-[#c3c6d7]'}`}
                placeholder={scanMode ? 'Đang sẵn sàng quét' : 'Bấm “Quét sản phẩm” để bắt đầu'}
              />
            </div>
            <button
              type="button"
              onClick={() => setScanMode((current) => !current)}
              aria-pressed={scanMode}
              className={`h-11 border px-4 text-sm font-bold ${scanMode ? 'border-[#74B8E0] bg-red-50 text-[#ba1a1a]' : 'border-brand bg-brand text-brand-ink'}`}
            >
              {scanMode ? 'Tắt quét' : 'Quét sản phẩm'}
            </button>
          </div>
        </form>

        <div className="mb-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_260px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#737686]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 w-full rounded-lg border border-transparent bg-[#eceef0] pl-10 pr-4 text-sm font-medium text-[#191c1e] outline-none focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand-soft"
              placeholder="Tìm sản phẩm..."
            />
          </div>
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="h-11 rounded-lg border border-[#c3c6d7] bg-white px-3 text-sm font-semibold text-[#191c1e] outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
          >
            <option value="">Tất cả danh mục</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible">
          {deviceFamilyOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={deviceFamily === option.value}
              onClick={() => toggleDeviceFamily(option.value)}
              className={`h-10 shrink-0 rounded-full px-4 text-sm font-semibold sm:px-5 ${
                deviceFamily === option.value
                  ? 'bg-brand text-brand-ink'
                  : 'border border-[#c3c6d7] bg-white text-[#191c1e]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-visible pr-0 xl:overflow-y-auto xl:pr-1">
          {isPageLoading ? (
            <div className="grid grid-cols-2 gap-2 pb-5 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="overflow-hidden rounded-xl border border-[#c3c6d7] bg-white">
                  <div className="aspect-square animate-pulse bg-[#eef2f4]" />
                  <div className="space-y-3 p-4">
                    <div className="h-4 animate-pulse rounded bg-[#eef2f4]" />
                    <div className="h-3 w-2/3 animate-pulse rounded bg-[#eef2f4]" />
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div className="h-5 w-20 animate-pulse rounded bg-[#eef2f4]" />
                      <div className="h-8 w-8 animate-pulse rounded-lg bg-[#eef2f4]" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#c3c6d7] bg-white p-8 text-center text-sm font-semibold text-[#737686]">
              Chưa có sản phẩm nào để hiển thị. Bạn có thể thử đổi từ khóa tìm kiếm hoặc bộ lọc.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 pb-5 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {products.map((product) => {
              const stock = Number(product.stock_quantity || 0);
              const isOutOfStock = stock <= 0;

              return (
                <div
                  key={product.id}
                  className="flex min-h-[280px] flex-col overflow-hidden rounded-xl border border-[#c3c6d7] bg-white text-left sm:min-h-[360px]"
                >
                  <div className="relative aspect-square shrink-0 overflow-hidden bg-[#f2f4f6] sm:h-[180px] sm:aspect-auto">
                    <ProductImage product={product} className="h-full w-full" />
                    <span
                      className={`absolute right-2 top-2 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${getStockTone(stock)}`}
                    >
                      {isOutOfStock ? 'Hết hàng' : `Còn ${stock}`}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col px-2.5 pb-3 pt-3 sm:px-4 sm:pb-5 sm:pt-4">
                    <h3 className="min-h-[40px] overflow-hidden text-xs font-bold leading-5 text-[#191c1e] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] sm:min-h-[60px] sm:text-sm sm:[-webkit-line-clamp:3]">
                      {product.name}
                    </h3>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-tight text-[#737686]">
                      {getProductSku(product)}
                    </p>
                    <span className="mt-auto pt-2 text-sm font-bold leading-6 text-brand-strong sm:pt-4 sm:text-lg">
                      {formatCurrency(product.price)}
                    </span>
                    <button
                      type="button"
                      onClick={() => addToCart(product)}
                      disabled={isOutOfStock}
                      className={`mt-2 inline-flex h-10 w-full items-center justify-center gap-1 rounded-lg border px-1 text-xs font-bold transition sm:mt-4 sm:h-11 sm:gap-2 sm:text-sm ${
                        isOutOfStock
                          ? 'cursor-not-allowed border-[#d7dbe0] bg-[#eceef0] text-[#737686]'
                          : 'border-[#74B8E0] bg-[#f8fdfe] text-[#2f8dc5] hover:bg-[#edf7fd]'
                      }`}
                    >
                      {isOutOfStock ? <X size={18} /> : <Plus size={18} />}
                      <span>{isOutOfStock ? 'Hết hàng' : 'Thêm vào giỏ'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
      </section>

      {isMobileCartOpen && (
        <button
          type="button"
          className="fixed inset-0 z-[55] bg-black/45 xl:hidden"
          onClick={() => setIsMobileCartOpen(false)}
          aria-label="Đóng giỏ hàng"
        />
      )}

      <aside className={`fixed inset-x-0 bottom-0 z-[60] flex max-h-[88dvh] min-h-0 flex-col overflow-y-auto border-t border-[#c3c6d7] bg-white pb-14 shadow-[0_-12px_36px_rgba(15,59,70,0.18)] transition-transform duration-200 xl:static xl:max-h-none xl:translate-y-0 xl:overflow-hidden xl:border-l xl:border-t-0 xl:pb-0 xl:shadow-none ${isMobileCartOpen ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className={`border-b border-[#c3c6d7] bg-white px-2.5 py-2 xl:block ${mobileCartView === 'checkout' ? 'hidden' : 'block'}`}>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-bold text-[#191c1e]">Khách hàng</span>
            <button type="button" onClick={openCustomerForm} className="text-xs font-bold text-brand-strong">Thêm mới (+)</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={selectWalkInCustomer}
              className={`flex min-h-14 items-center gap-2 border px-2.5 text-left text-[#191c1e] transition ${customerMode === 'regular' ? 'border-[#69afd6] bg-[#69afd6]' : 'border-[#c3c6d7] bg-white hover:bg-[#f7f9fb]'}`}
            >
              <UserRound className="h-5 w-5 shrink-0" />
              <span><span className="block text-sm font-bold">Khách thường</span><span className="block text-[11px] font-semibold opacity-75">Không tích điểm</span></span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCustomerMode('member');
                setIsCustomerPickerOpen(true);
              }}
              className={`flex min-h-14 items-center gap-2 border px-2.5 text-left text-[#191c1e] transition ${customerMode === 'member' ? 'border-[#69afd6] bg-[#69afd6]' : 'border-[#c3c6d7] bg-white hover:bg-[#f7f9fb]'}`}
            >
              <UserSearch className="h-5 w-5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{selectedCustomer ? customerName : 'Thành viên'}</span>
                <span className="block truncate text-[11px] font-semibold opacity-75">
                  {selectedCustomer ? `${selectedCustomer.phone || 'Chưa có SĐT'} · ${Number(selectedCustomer.points || 0).toLocaleString('vi-VN')} điểm` : 'Chọn khách tích điểm'}
                </span>
              </span>
            </button>
          </div>
        </div>

        <div className={`min-h-0 flex-none flex-col overflow-hidden px-2.5 py-2 xl:flex xl:flex-1 ${mobileCartView === 'checkout' ? 'hidden' : 'flex'}`}>
          <div className="mb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-[#191c1e]">
              <Smartphone size={19} className="text-brand-strong" />
              <span>Giỏ hàng ({cart.length})</span>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={requestClearCart} className="rounded px-2 py-1 text-xs font-bold text-[#ba1a1a]">
                Xóa hết
              </button>
              <button type="button" onClick={() => setIsMobileCartOpen(false)} className="grid h-8 w-8 place-items-center text-[#434655] xl:hidden" aria-label="Đóng giỏ hàng">
                <X size={19} />
              </button>
            </div>
          </div>

          <div className="max-h-[52dvh] min-h-0 flex-1 touch-pan-y space-y-2 overflow-y-auto overscroll-contain pr-1 xl:max-h-none">
            {cart.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#c3c6d7] bg-[#f7f9fb] p-6 text-center text-sm font-medium text-[#737686]">
                Chưa có sản phẩm trong giỏ hàng
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="flex gap-2 border border-[#e0e3e5] bg-white p-1.5">
                  <div className="h-14 w-14 shrink-0 overflow-hidden border border-[#c3c6d7] bg-[#f2f4f6]">
                    <ProductImage product={item} iconSize={24} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="line-clamp-2 text-sm font-bold leading-5 text-[#191c1e]">{item.name}</h4>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="grid h-6 w-6 shrink-0 place-items-center text-[#737686]"
                        title="Xóa"
                        aria-label="Xóa"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="mt-1.5 flex items-end justify-between gap-3">
                      <div className="flex overflow-hidden rounded-lg border border-[#c3c6d7] bg-[#eceef0]">
                        <button
                          type="button"
                          onClick={() => setCartQuantity(item.id, item.quantity - 1)}
                          className="grid h-8 w-8 place-items-center text-[#434655]"
                          title="Giảm"
                          aria-label="Giảm"
                        >
                          <Minus size={15} />
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          min="0"
                          max={allowOutOfStockSale ? undefined : Number(item.stock_quantity || 0)}
                          value={quantityDrafts[item.id] ?? item.quantity}
                          onChange={(event) => handleQuantityInput(item.id, event.target.value)}
                          onBlur={(event) => commitQuantityInput(item.id, event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.currentTarget.blur();
                            }
                          }}
                          className="h-8 w-10 border-x border-[#c3c6d7] bg-[#eceef0] text-center text-xs font-bold text-[#191c1e] outline-none focus:bg-white focus:ring-1 focus:ring-[#76b8dc]"
                          aria-label="So luong"
                        />
                        <button
                          type="button"
                          onClick={() => setCartQuantity(item.id, item.quantity + 1)}
                          className="grid h-8 w-8 place-items-center text-[#434655]"
                          title="Tăng"
                          aria-label="Tăng"
                        >
                          <Plus size={15} />
                        </button>
                      </div>
                      <span className="text-sm font-bold text-[#191c1e]">
                        {formatCurrency(Number(item.price) * item.quantity)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={`border-t border-[#c3c6d7] bg-[#f2f4f6] p-2.5 xl:block ${mobileCartView === 'checkout' ? 'block' : 'hidden'}`}>
          <button
            type="button"
            onClick={() => setMobileCartView('cart')}
            className="mb-3 flex h-10 w-full items-center gap-2 border border-[#c3c6d7] bg-white px-3 text-sm font-bold text-[#0f3b46] xl:hidden"
          >
            <ChevronLeft size={18} />
            Quay lại giỏ hàng
          </button>
          <div className="mb-2 space-y-1.5">
            <div className="flex justify-between text-sm text-[#434655]">
              <span>Tạm tính</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="border-y border-[#d9dde2] py-1.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-[#434655]">Khuyến mãi</span>
                <button type="button" onClick={() => { if (!cart.length) return toast.error('Không thể chọn khuyến mãi khi giỏ hàng trống'); setIsPromotionOpen(true); }} className="font-bold text-brand-strong">Chọn khuyến mãi</button>
              </div>
              {!selectedPromotion ? <p className="mt-1 text-xs text-[#737686]">Chưa áp dụng</p> : <div className="mt-2 bg-white p-2">
                <p className="text-xs font-bold text-[#191c1e]">{selectedPromotion.name}</p>
                <div className="mt-1 flex items-center justify-between"><span className="font-bold text-emerald-700">-{formatCurrency(promotionDiscount)}</span><button type="button" onClick={() => setSelectedPromotion(null)} className="text-xs font-bold text-red-600">Bỏ áp dụng</button></div>
              </div>}
            </div>
            <div className="border-b border-[#d9dde2] pb-1.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-[#434655]">Điểm tích lũy</span>
                <span className="text-xs font-bold text-[#737686]">
                  {selectedCustomer ? `Có ${availablePoints.toLocaleString('vi-VN')} điểm` : 'Chỉ áp dụng cho thành viên'}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={usedPoints}
                  onChange={(event) => handlePointsChange(event.target.value)}
                  disabled={!selectedCustomer || cart.length === 0 || maxRedeemPoints === 0}
                  className="h-8 min-w-0 flex-1 border border-[#c3c6d7] bg-white px-2 text-right text-sm font-semibold outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft disabled:bg-[#e7e9ec] disabled:text-[#8b8e98]"
                  placeholder="Số điểm muốn dùng"
                  aria-label="Số điểm muốn dùng"
                />
                <button
                  type="button"
                  onClick={() => setUsedPoints(maxRedeemPoints)}
                  disabled={!selectedCustomer || maxRedeemPoints === 0}
                  className="h-8 shrink-0 border border-brand bg-white px-2 text-xs font-bold text-brand-strong disabled:border-[#c3c6d7] disabled:text-[#8b8e98]"
                >
                  Dùng tối đa
                </button>
                {normalizedUsedPoints > 0 && (
                  <button type="button" onClick={() => setUsedPoints(0)} className="h-8 px-1 text-xs font-bold text-red-600" aria-label="Bỏ điểm đã dùng">
                    Xóa
                  </button>
                )}
              </div>
              {selectedCustomer && (
                <div className="mt-1 flex justify-between text-xs">
                  <span className="text-[#737686]">Tối đa {maxRedeemPoints.toLocaleString('vi-VN')} điểm</span>
                  <span className="font-bold text-emerald-700">-{formatCurrency(pointsDiscountAmount)}</span>
                </div>
              )}
            </div>
            {paymentMethod === 'cash' && (
              <>
                <label className="flex items-center justify-between gap-3 text-sm text-[#434655]">
                  <span>Tiền khách đưa</span>
                  <input
                    type="number"
                    min="0"
                    value={customerPaid}
                    onChange={(event) => setCustomerPaid(event.target.value)}
                    className="h-8 w-32 border border-[#c3c6d7] bg-white px-3 text-right text-sm font-semibold text-[#191c1e] outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
                    placeholder="0"
                  />
                </label>
                <div className="flex items-center justify-between text-sm text-[#434655]">
                  <span>
                    {amountMissing > 0 ? 'Còn thiếu' : 'Tiền thừa'}
                  </span>
                  <span className={`font-bold ${amountMissing > 0 ? 'text-[#ba1a1a]' : 'text-[#008a45]'}`}>
                    {amountMissing > 0 ? formatCurrency(amountMissing) : formatCurrency(changeDue)}
                  </span>
                </div>
              </>
            )}
            {vatAmount > 0 && (
              <div className="flex items-center justify-between text-sm text-[#434655]">
                <span>VAT {vatRate.toLocaleString('vi-VN')}%</span>
                <span className="font-bold">{formatCurrency(vatAmount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-[#c3c6d7] pt-2">
              <span className="text-base font-bold uppercase text-[#191c1e]">Tổng cộng</span>
              <span className="text-base font-extrabold text-brand-strong">{formatCurrency(total)}</span>
            </div>
          </div>

          <div className="mb-2 grid grid-cols-2 gap-2">
            {enabledPaymentOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = paymentMethod === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPaymentMethod(option.value)}
                  className={`flex h-10 items-center justify-center gap-2 border px-2 ${
                    isSelected
                      ? 'border-2 border-brand bg-brand-soft text-brand-strong'
                      : 'border-[#c3c6d7] bg-white text-[#434655]'
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-center text-[10px] font-bold uppercase leading-3 tracking-tight">
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={openCheckoutConfirm}
            disabled={loading}
            className="hidden h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#74B8E0] px-4 text-sm font-bold uppercase text-white shadow-[0_8px_20px_rgba(116,184,224,0.22)] disabled:opacity-70 xl:flex"
          >
            <ReceiptText size={18} />
            <span>Thanh toán</span>
          </button>
        </div>
        {mobileCartView === 'cart' ? (
          <button
            type="button"
            onClick={() => setMobileCartView('checkout')}
            disabled={!cart.length}
            className="fixed inset-x-0 bottom-0 z-10 flex h-14 items-center justify-center gap-2 border-t border-[#c3c6d7] bg-[#0f3b46] px-4 text-sm font-bold uppercase text-white shadow-[0_-8px_20px_rgba(15,59,70,0.16)] disabled:opacity-50 xl:hidden"
          >
            <span>Tiếp tục thanh toán · {formatCurrency(total)}</span>
            <ChevronRight size={19} />
          </button>
        ) : (
          <button
            type="button"
            onClick={openCheckoutConfirm}
            disabled={loading}
            className="fixed inset-x-0 bottom-0 z-10 flex h-14 items-center justify-center gap-2 border-t border-[#c3c6d7] bg-[#74B8E0] px-4 text-sm font-bold uppercase text-white shadow-[0_-8px_20px_rgba(15,59,70,0.16)] disabled:opacity-70 xl:hidden"
          >
            <ReceiptText size={18} />
            <span>Thanh toán · {formatCurrency(total)}</span>
          </button>
        )}
      </aside>
    </div>
    <MobileCartLauncher itemCount={cart.length} onOpen={() => { setMobileCartView('cart'); setIsMobileCartOpen(true); }} />
    <div className="no-print">
    <Modal isOpen={isPromotionOpen} onClose={() => setIsPromotionOpen(false)} title="Khuyến mãi khả dụng" maxWidth="max-w-2xl">
      <button type="button" onClick={() => { setSelectedPromotion(null); setIsPromotionOpen(false); }} className="mb-3 h-10 w-full border border-[#c3c6d7] bg-white text-sm font-bold text-[#434655]">Không áp dụng khuyến mãi</button>
      {eligiblePromotions.length === 0 ? <div className="border border-dashed border-[#c3c6d7] p-8 text-center text-sm font-semibold text-[#737686]">Hiện chưa có khuyến mãi phù hợp với giỏ hàng này.</div> : <div className="max-h-[60vh] space-y-3 overflow-y-auto">
        {eligiblePromotions.map((promotion) => <article key={promotion.id} className="border border-[#d8e4eb] bg-white p-4">
          <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-[#191c1e]">{promotion.name}</h3><p className="mt-1 text-sm text-[#5f6670]">{promotion.description || promotion.condition}</p></div><span className="shrink-0 bg-brand-soft px-2 py-1 text-sm font-bold text-brand-strong">-{formatCurrency(getPromotionDiscount(promotion, subtotal))}</span></div>
          <div className="mt-3 grid gap-1 text-xs text-[#5f6670] sm:grid-cols-2"><p>Điều kiện: {promotion.condition || 'Không có'}</p><p>Giá trị: {promotion.discountType === 'percent' ? `${promotion.discountValue}%` : formatCurrency(promotion.discountValue)}</p><p>Hiệu lực: {promotion.startDate || '-'} đến {promotion.endDate || '-'}</p></div>
          <button type="button" onClick={() => { setSelectedPromotion(promotion); setIsPromotionOpen(false); toast.success('Đã áp dụng khuyến mãi'); }} className="mt-3 h-10 w-full bg-brand px-4 text-sm font-bold text-white">Áp dụng</button>
        </article>)}
      </div>}
    </Modal>
    <Modal
      isOpen={isClearCartOpen}
      onClose={() => setIsClearCartOpen(false)}
      title="Xác nhận xóa giỏ hàng"
      maxWidth="max-w-md"
    >
      <div className="space-y-5">
        <p className="text-sm font-medium leading-6 text-[#434655]">
          Bạn có chắc muốn xóa tất cả sản phẩm trong giỏ hàng hiện tại không?
        </p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setIsClearCartOpen(false)}
            className="rounded-lg border border-[#c3c6d7] px-4 py-2 font-semibold text-[#434655]"
          >
            Giữ lại
          </button>
          <button
            type="button"
            onClick={clearCart}
            className="rounded-lg bg-[#ba1a1a] px-4 py-2 font-bold text-white"
          >
            Xóa giỏ hàng
          </button>
        </div>
      </div>
    </Modal>

    <Modal
      isOpen={isCustomerPickerOpen}
      onClose={() => setIsCustomerPickerOpen(false)}
      title="Chọn khách hàng"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#737686]" />
          <input
            value={customerLookup}
            onChange={(event) => setCustomerLookup(event.target.value)}
            className="h-11 w-full rounded-lg border border-[#c3c6d7] bg-white pl-10 pr-4 text-sm font-semibold text-[#191c1e] outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
            placeholder="Tìm tên hoặc số điện thoại"
          />
        </div>

        <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
          {customers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#c3c6d7] p-5 text-center text-sm font-semibold text-[#737686]">
              Chưa tìm thấy khách hàng
            </div>
          ) : (
            customers.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => selectCustomer(customer)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-[#e0e3e5] bg-white p-3 text-left hover:border-brand hover:bg-brand-surface"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-[#191c1e]">{customer.name}</span>
                  <span className="mt-0.5 block truncate text-xs font-semibold text-[#737686]">
                    {customer.phone || 'Chưa có SĐT'}{customer.email ? ` · ${customer.email}` : ''}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-brand-soft px-3 py-1 text-xs font-extrabold text-brand-strong">
                  {Number(customer.points || 0).toLocaleString('vi-VN')} điểm
                </span>
              </button>
            ))
          )}
        </div>

        <div className="flex justify-between gap-3 border-t border-[#e0e3e5] pt-4">
          <button
            type="button"
            onClick={openCustomerForm}
            className="rounded-lg bg-brand px-4 py-2 font-bold text-brand-ink"
          >
            Thêm mới (+)
          </button>
          <button
            type="button"
            onClick={() => setIsCustomerPickerOpen(false)}
            className="rounded-lg border border-[#c3c6d7] px-4 py-2 font-semibold text-[#434655]"
          >
            Đóng
          </button>
        </div>
      </div>
    </Modal>

    <Modal
      isOpen={isCustomerFormOpen}
      onClose={() => setIsCustomerFormOpen(false)}
      title="Thêm khách hàng tích điểm"
      maxWidth="max-w-xl"
    >
      <form onSubmit={createCustomerFromPos} className="grid gap-4 md:grid-cols-2">
        <label className="md:col-span-2">
          <span className="mb-1 block text-sm font-semibold text-[#434655]">Tên khách hàng</span>
          <input
            value={customerForm.name}
            onChange={(event) => setCustomerForm({ ...customerForm, name: event.target.value })}
            className="h-10 w-full rounded-lg border border-[#c3c6d7] px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
            maxLength={100}
            pattern="(?=.*\p{L})[\p{L} .]{2,100}"
            title={customerNameMessage}
            required
          />
        </label>
        <label>
          <span className="mb-1 block text-sm font-semibold text-[#434655]">Số điện thoại</span>
          <input
            value={customerForm.phone}
            onChange={(event) =>
              setCustomerForm({ ...customerForm, phone: normalizePhone(event.target.value) })
            }
            className="h-10 w-full rounded-lg border border-[#c3c6d7] px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
            inputMode="numeric"
            maxLength={10}
            pattern="(03|05|07|08|09)[0-9]{8}"
            required
          />
        </label>
        <label>
          <span className="mb-1 block text-sm font-semibold text-[#434655]">Email</span>
          <input
            type="email"
            value={customerForm.email}
            onChange={(event) => setCustomerForm({ ...customerForm, email: event.target.value })}
            className="h-10 w-full rounded-lg border border-[#c3c6d7] px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
          />
        </label>
        <label className="md:col-span-2">
          <span className="mb-1 block text-sm font-semibold text-[#434655]">Địa chỉ</span>
          <input
            value={customerForm.address}
            onChange={(event) => setCustomerForm({ ...customerForm, address: event.target.value })}
            className="h-10 w-full rounded-lg border border-[#c3c6d7] px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
          />
        </label>
        <div className="flex justify-end gap-3 md:col-span-2">
          <button
            type="button"
            onClick={() => setIsCustomerFormOpen(false)}
            className="rounded-lg border border-[#c3c6d7] px-4 py-2 font-semibold text-[#434655]"
          >
            Hủy
          </button>
          <button type="submit" className="rounded-lg bg-brand px-4 py-2 font-bold text-brand-ink">
            Lưu và chọn khách
          </button>
        </div>
      </form>
    </Modal>

    <Modal
      isOpen={isConfirmOpen}
      onClose={closeCheckoutConfirm}
      title={isTransferQrStep ? 'Thanh toán chuyển khoản VietQR' : 'Xác nhận thanh toán'}
      maxWidth={isTransferQrStep ? 'max-w-6xl' : 'max-w-2xl'}
    >
      <div className={isTransferQrStep ? 'space-y-3' : 'space-y-5'}>
        {isTransferQrStep && (
          <div className="grid gap-4 lg:grid-cols-[minmax(220px,0.75fr)_minmax(0,1.25fr)]">
            <div className="rounded-lg border border-[#d7eef3] bg-[#f8fdfe] p-3">
              <div className="mx-auto grid max-w-[230px] place-items-center rounded-lg bg-white p-3 shadow-sm ring-1 ring-[#d7eef3]">
                <img
                  src={vietQrDataUrl}
                  alt="Mã QR chuyển khoản VietQR"
                  className="h-52 w-52 object-contain"
                />
              </div>
              <div className="mx-auto mt-3 w-fit rounded-full border border-[#c0edf7] bg-white px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-[#2563eb]">
                VietQR / Napas 247
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <p className="text-xs font-extrabold uppercase tracking-wide text-[#98a2b3]">Ngân hàng thụ hưởng</p>
                <p className="mt-1 text-lg font-extrabold text-[#191c1e]">{bankTransfer.bankName}</p>
              </div>

              <div className="border-t border-[#edf7f9] pt-3">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-[#98a2b3]">Số tài khoản</p>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(bankTransfer.accountNo, 'số tài khoản')}
                    className="rounded p-1 text-[#2563eb] hover:bg-[#f4fcfe]"
                    title="Sao chép số tài khoản"
                    aria-label="Sao chép số tài khoản"
                  >
                    <Copy size={17} />
                  </button>
                </div>
                <p className="text-base font-bold text-[#191c1e]">{bankTransfer.accountNo}</p>
              </div>

              <div className="border-t border-[#edf7f9] pt-3">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-[#98a2b3]">Chủ tài khoản</p>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(bankTransfer.accountName, 'chủ tài khoản')}
                    className="rounded p-1 text-[#2563eb] hover:bg-[#f4fcfe]"
                    title="Sao chép chủ tài khoản"
                    aria-label="Sao chép chủ tài khoản"
                  >
                    <Copy size={17} />
                  </button>
                </div>
                <p className="text-base font-bold text-[#191c1e]">{bankTransfer.accountName}</p>
              </div>

              <div className="border-t border-[#edf7f9] pt-3">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-[#98a2b3]">Số tiền thanh toán</p>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(Math.round(total), 'số tiền')}
                    className="rounded p-1 text-[#2563eb] hover:bg-[#f4fcfe]"
                    title="Sao chép số tiền"
                    aria-label="Sao chép số tiền"
                  >
                    <Copy size={17} />
                  </button>
                </div>
                <p className="text-xl font-extrabold text-[#2563eb]">{formatCurrency(total)}</p>
              </div>

              <div className="border-t border-[#edf7f9] pt-3">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-[#98a2b3]">
                    Nội dung chuyển khoản
                  </p>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(transferMemo, 'nội dung chuyển khoản')}
                    className="rounded p-1 text-[#c05621] hover:bg-orange-50"
                    title="Sao chép nội dung chuyển khoản"
                    aria-label="Sao chép nội dung chuyển khoản"
                  >
                    <Copy size={17} />
                  </button>
                </div>
                <div className="rounded border border-orange-200 bg-orange-50 px-3 py-2 text-base font-extrabold text-[#9a3412]">
                  {transferMemo}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className={isTransferQrStep ? 'rounded-lg border border-[#d7eef3] bg-[#f8fdfe] p-3' : 'rounded-lg border border-[#d7eef3] bg-[#f8fdfe] p-4'}>
          <div className={isTransferQrStep ? 'mb-2 flex items-center gap-2 text-sm font-bold text-[#0f3b46]' : 'mb-3 flex items-center gap-2 text-sm font-bold text-[#0f3b46]'}>
            <ReceiptText size={18} />
            <span>{isTransferQrStep ? 'Sản phẩm trong đơn chuyển khoản' : 'Kiểm tra lại đơn trước khi thanh toán'}</span>
          </div>
          <div className={isTransferQrStep ? 'max-h-28 space-y-2 overflow-y-auto pr-1' : 'space-y-3'}>
            {cart.map((item) => (
              <div key={item.id} className={isTransferQrStep ? 'flex items-start justify-between gap-4 border-b border-dashed border-[#d7eef3] pb-2 last:border-0 last:pb-0' : 'flex items-start justify-between gap-4 border-b border-dashed border-[#d7eef3] pb-3 last:border-0 last:pb-0'}>
                <div className="min-w-0">
                  <p className="font-bold text-[#191c1e]">{item.name}</p>
                  <p className="mt-1 text-xs font-semibold text-[#737686]">
                    Số lượng: {item.quantity} x {formatCurrency(item.price)}
                  </p>
                </div>
                <span className="shrink-0 font-extrabold text-[#0f3b46]">
                  {formatCurrency(Number(item.price) * item.quantity)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className={isTransferQrStep ? 'grid gap-x-6 gap-y-1 rounded-lg border border-[#d7eef3] p-3 text-sm md:grid-cols-2' : 'space-y-2 rounded-lg border border-[#d7eef3] p-4 text-sm'}>
          <div className="flex justify-between">
            <span>Tạm tính</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {promotionDiscount > 0 && <div className="flex justify-between"><span>Khuyến mãi</span><span>-{formatCurrency(promotionDiscount)}</span></div>}
          {normalizedUsedPoints > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Dùng {normalizedUsedPoints.toLocaleString('vi-VN')} điểm</span>
              <span>-{formatCurrency(pointsDiscountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Phương thức</span>
            <span className="font-bold">{getPaymentLabel(paymentMethod)}</span>
          </div>
          {paymentMethod === 'cash' && (
            <>
              <div className="flex justify-between">
                <span>Tiền khách đưa</span>
                <span>{formatCurrency(customerPaidValue)}</span>
              </div>
              <div className="flex justify-between font-bold text-emerald-700">
                <span>Tiền thừa</span>
                <span>{formatCurrency(changeDue)}</span>
              </div>
            </>
          )}
          {vatAmount > 0 && (
            <div className="flex justify-between">
              <span>VAT {vatRate.toLocaleString('vi-VN')}%</span>
              <span>{formatCurrency(vatAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-extrabold text-[#191c1e]">
            <span>Tổng cộng</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        <div className={isTransferQrStep ? 'sticky bottom-0 z-10 -mx-6 -mb-6 flex justify-end gap-3 border-t border-[#edf7f9] bg-white px-6 py-3' : 'flex justify-end gap-3'}>
          <button
            type="button"
            onClick={isTransferQrStep ? () => setCheckoutStep('confirm') : closeCheckoutConfirm}
            disabled={loading}
            className="rounded-lg border border-[#c3c6d7] px-4 py-2 font-semibold text-[#434655] disabled:opacity-60"
          >
            {isTransferQrStep ? 'Quay lại xác nhận' : 'Kiểm tra lại'}
          </button>
          <button
            type="button"
            onClick={(paymentMethod === 'transfer' || paymentMethod === 'qr') && checkoutStep === 'confirm' ? continueToTransferPayment : confirmCheckout}
            disabled={loading}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 font-bold text-white disabled:opacity-60 ${
              isTransferQrStep ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-[#74B8E0]'
            }`}
          >
            <CheckCircle2 size={18} />
            <span>
              {loading
                ? (paymentMethod === 'transfer' || paymentMethod === 'qr') && checkoutStep === 'confirm'
                  ? 'Đang tạo QR...'
                  : 'Đang thanh toán...'
                : (paymentMethod === 'transfer' || paymentMethod === 'qr') && checkoutStep === 'confirm'
                  ? 'Tiếp tục chuyển khoản'
                  : isTransferQrStep
                    ? 'Xác nhận đã nhận tiền'
                    : 'Xác nhận thanh toán'}
            </span>
          </button>
        </div>
      </div>
    </Modal>

    <Modal
      isOpen={Boolean(receipt)}
      onClose={() => setReceipt(null)}
      maxWidth="max-w-4xl"
      panelClassName="rounded-t-2xl shadow-2xl sm:rounded-2xl"
      headerClassName="sm:mb-3"
      hideClose
      headerActions={(
        <>
          <button
            type="button"
            onClick={() => setReceipt(null)}
            className="hidden h-10 rounded-lg border border-gray-300 bg-white px-4 text-sm font-bold text-gray-700 transition hover:bg-gray-50 sm:inline-flex sm:items-center"
          >
            Hoàn tất
          </button>
          <button
            type="button"
            onClick={printReceipt}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#74B8E0] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#5fa9d4]"
          >
            <Printer size={17} />
            <span className="hidden sm:inline">In hóa đơn</span>
            <span className="sm:hidden">In</span>
          </button>
        </>
      )}
      title={(
        <span className="flex items-center gap-2.5 text-lg font-extrabold text-gray-950 sm:text-xl">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 size={22} strokeWidth={2.7} />
          </span>
          Thanh toán thành công
        </span>
      )}
    >
      <div className="space-y-4">
        <ReceiptContent receipt={receipt} />
        <div className="flex justify-end gap-2 border-t border-gray-100 pt-3 sm:hidden">
          <button
            type="button"
            onClick={() => setReceipt(null)}
            className="h-11 rounded-lg border border-gray-300 bg-white px-5 font-bold text-gray-700 transition hover:bg-gray-50"
          >
            Hoàn tất
          </button>
        </div>
      </div>
    </Modal>
    </div>

    <div className="print-receipt">
      <ThermalReceiptContent receipt={receipt} />
    </div>
    </>
  );
}
