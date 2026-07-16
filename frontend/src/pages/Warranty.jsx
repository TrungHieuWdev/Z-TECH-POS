import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import {
  CalendarDays,
  ChevronsLeft,
  FileBadge,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  TimerReset,
  XCircle
} from 'lucide-react';
import api from '../api/axios';
import KpiCard from '../components/KpiCard';
import Modal from '../components/Modal';
import TablePagination from '../components/TablePagination';
import WarrantySettingsModal from '../components/WarrantySettingsModal';
import WarrantyQr from '../components/WarrantyQr';
import { getWarrantySettings } from '../services/warrantySettingsService';
import { formatCurrency, formatDate, formatTime } from '../utils/format';
import { getUser, isFullAccessRole } from '../utils/auth';

const PAGE_SIZE = 8;

const statusOptions = [
  { value: 'all', label: 'Tất cả' },
  { value: 'active', label: 'Còn bảo hành' },
  { value: 'processing', label: 'Đang xử lý' },
  { value: 'replaced', label: 'Đã đổi mới' },
  { value: 'returned', label: 'Đã trả khách' },
  { value: 'expired', label: 'Hết hạn' },
  { value: 'rejected', label: 'Từ chối' },
  { value: 'initial_exchange', label: 'Chỉ đổi lỗi ban đầu' },
  { value: 'no_warranty', label: 'Không bảo hành' }
];

const updateStatusOptions = statusOptions.filter((option) => option.value !== 'all' && option.value !== 'active');

const periodOptions = [
  { value: 'all', label: 'Tất cả' },
  { value: 'today', label: 'Hôm nay' },
  { value: '7days', label: '7 ngày' },
  { value: '30days', label: '30 ngày' }
];

const statusMeta = {
  active: { label: 'Còn bảo hành', className: 'bg-emerald-100 text-emerald-700', icon: ShieldCheck },
  processing: { label: 'Đang xử lý', className: 'bg-yellow-100 text-yellow-800', icon: TimerReset },
  replaced: { label: 'Đã đổi mới', className: 'bg-blue-100 text-blue-700', icon: RotateCcw },
  returned: { label: 'Đã trả khách', className: 'bg-cyan-100 text-cyan-700', icon: PackageCheck },
  expired: { label: 'Hết hạn', className: 'bg-slate-100 text-slate-600', icon: CalendarDays },
  rejected: { label: 'Từ chối', className: 'bg-red-100 text-red-700', icon: XCircle },
  initial_exchange: { label: 'Chỉ đổi lỗi ban đầu', className: 'bg-amber-100 text-amber-800', icon: TimerReset },
  no_warranty: { label: 'Không bảo hành', className: 'bg-gray-100 text-gray-700', icon: XCircle }
};

const productConditionRules = [
  {
    keywords: ['cap', 'cable'],
    text: 'Cáp sạc: bảo hành lỗi không nhận sạc, không bảo hành đứt gãy hoặc biến dạng đầu cắm.'
  },
  {
    keywords: ['cu sac', 'adapter', 'sac'],
    text: 'Củ sạc: bảo hành lỗi không cấp nguồn, không bảo hành cháy nổ do nguồn điện không ổn định.'
  },
  {
    keywords: ['tai nghe', 'airpods', 'earphone'],
    text: 'Tai nghe: bảo hành lỗi âm thanh, không bảo hành rơi vỡ, vào nước hoặc mất phụ kiện.'
  },
  {
    keywords: ['cuong luc', 'kinh', 'mieng dan'],
    text: 'Cường lực: không bảo hành sau khi đã dán hoặc phát sinh nứt vỡ do sử dụng.'
  },
  {
    keywords: ['op lung', 'case'],
    text: 'Ốp lưng: không bảo hành trầy xước, ố màu hoặc hao mòn trong quá trình sử dụng.'
  }
];

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function startOfDay(date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function getDateFromPeriod(period) {
  if (period === 'all') return '';

  const today = startOfDay(new Date());

  if (period === 'today') {
    return today.toISOString().slice(0, 10);
  }

  const days = period === '7days' ? 6 : 29;
  today.setDate(today.getDate() - days);
  return today.toISOString().slice(0, 10);
}

function getDaysLeft(expiresAt) {
  const today = startOfDay(new Date());
  const expiryDate = startOfDay(new Date(expiresAt));
  return Math.ceil((expiryDate - today) / 86400000);
}

function getCurrentDateInput() {
  return new Date().toISOString().slice(0, 10);
}

function getWarrantySku(warranty) {
  return warranty.sku || `SKU-${String(warranty.id || warranty.code).replace(/\D/g, '').padStart(5, '0')}`;
}

function getWarrantyCondition(warranty) {
  if (warranty.warrantyConditions) return warranty.warrantyConditions;

  const searchable = normalizeText(`${warranty.productName} ${warranty.categoryName}`);
  const matchedRule = productConditionRules.find((rule) =>
    rule.keywords.some((keyword) => searchable.includes(keyword))
  );

  return matchedRule?.text || 'Bảo hành theo chính sách cửa hàng với lỗi kỹ thuật phát sinh trong thời hạn bảo hành.';
}

function createInitialHistory(warranty) {
  const action = warranty.warrantyEnabled
    ? 'Tạo phiếu từ hóa đơn'
    : warranty.warrantyType === 'initial_exchange'
      ? 'Ghi nhận chính sách đổi lỗi'
      : 'Ghi nhận không bảo hành';

  return [
    {
      id: `${warranty.code}-created`,
      time: warranty.purchasedAt,
      action,
      staff: warranty.staffName || 'Hệ thống',
      note: `Phiếu được tạo từ hóa đơn ${warranty.orderNumber}.`
    }
  ];
}

function buildHistoryItem(action, staff, note) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    time: new Date().toISOString(),
    action,
    staff,
    note
  };
}

function StatusBadge({ status }) {
  const meta = statusMeta[status] || statusMeta.active;

  return (
    <span className={`inline-flex items-center rounded px-2.5 py-1 text-[11px] font-bold uppercase ${meta.className}`}>
      {meta.label}
    </span>
  );
}

function CompactActionSelect({ warranty, onAction }) {
  return (
    <select
      value=""
      onChange={(event) => {
        if (event.target.value) {
          onAction(event.target.value, warranty);
          event.target.value = '';
        }
      }}
      className="h-8 w-[118px] rounded border border-gray-300 bg-white px-2 text-xs font-semibold text-gray-700 outline-none transition hover:bg-gray-50 focus:border-brand"
      aria-label="Chọn thao tác bảo hành"
    >
      <option value="">Thao tác</option>
      <option value="receive">Tiếp nhận</option>
      <option value="status">Cập nhật</option>
      <option value="exchange">Đổi sản phẩm</option>
      <option value="print">In phiếu</option>
    </select>
  );
}

function WarrantyRow({ warranty, onView, onAction }) {
  const daysLeft = getDaysLeft(warranty.expiresAt);
  const isExpiredWarranty = warranty.status !== 'no_warranty' && daysLeft <= 0;
  const expiryText =
    warranty.status === 'no_warranty'
      ? 'Không có hạn BH'
      : `Còn ${daysLeft.toLocaleString('vi-VN')} ngày`;

  return (
    <tr className="h-[82px] border-b border-gray-200 transition hover:bg-[#f8fdfe] last:border-b-0">
      <td className="px-4 py-4 align-top">
        <div className="font-bold text-brand-deep">{warranty.code}</div>
        <div className="mt-1 text-xs text-gray-600">
          {Number(warranty.warrantyPeriodDays || 0) > 0 ? `${warranty.warrantyPeriodDays} ngày` : 'Không tạo phiếu BH'}
        </div>
      </td>
      <td className="px-4 py-4 align-top">
        <div className="font-semibold text-gray-900">{warranty.orderNumber}</div>
        <div className="mt-1 text-xs text-gray-600">{formatDate(warranty.purchasedAt)}</div>
      </td>
      <td className="px-4 py-4 align-top">
        <div className="max-w-[180px] truncate font-semibold text-gray-900">{warranty.customerName}</div>
        <div className="mt-1 text-xs text-gray-600">{warranty.customerPhone || 'Chưa có SĐT'}</div>
      </td>
      <td className="px-4 py-4 align-top">
        <div className="max-w-[240px] truncate font-medium text-gray-900">{warranty.productName}</div>
        <div className="mt-1 text-xs text-gray-600">
          {getWarrantySku(warranty)} · SL {warranty.quantity}
        </div>
      </td>
      <td className="px-4 py-4 align-top text-sm text-gray-700">{formatDate(warranty.purchasedAt)}</td>
      <td className="px-4 py-4 align-top">
        <div className="text-sm font-semibold text-gray-900">
          {warranty.status === 'no_warranty' ? '-' : formatDate(warranty.expiresAt)}
        </div>
        {isExpiredWarranty ? (
          <span className="mt-1 inline-flex bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
            Hết hạn BH
          </span>
        ) : (
          <div className="mt-1 text-xs text-gray-600">{expiryText}</div>
        )}
      </td>
      <td className="px-4 py-4 align-top">
        <StatusBadge status={warranty.status} />
      </td>
      <td className="px-4 py-4 align-top text-sm text-gray-700">{warranty.staffName}</td>
      <td className="px-4 py-4 align-top">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onView(warranty)}
            className="h-8 rounded border border-gray-300 bg-white px-2.5 text-xs font-semibold text-brand-deep transition hover:bg-brand-surface"
          >
            Xem
          </button>
          <CompactActionSelect warranty={warranty} onAction={onAction} />
        </div>
      </td>
    </tr>
  );
}

function HistoryTable({ history }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full text-left text-xs">
        <thead className="bg-gray-50 text-gray-500">
          <tr>
            <th className="px-3 py-2 font-semibold">Thời gian</th>
            <th className="px-3 py-2 font-semibold">Hành động</th>
            <th className="px-3 py-2 font-semibold">Nhân viên</th>
            <th className="px-3 py-2 font-semibold">Ghi chú</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {history.map((item) => (
            <tr key={item.id}>
              <td className="whitespace-nowrap px-3 py-2 text-gray-700">
                {formatTime(item.time)} - {formatDate(item.time)}
              </td>
              <td className="px-3 py-2 font-semibold text-gray-900">{item.action}</td>
              <td className="px-3 py-2 text-gray-700">{item.staff}</td>
              <td className="px-3 py-2 text-gray-700">{item.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function adjustInventoryForExchange() {

  return { ok: true };
}

export default function Warranty() {
  const [searchParams, setSearchParams] = useSearchParams();
  const expiringOnly = searchParams.get('view') === 'expiring';
  const currentUser = getUser();
  const canEditWarrantySettings = isFullAccessRole(currentUser?.role);
  const [showWarrantySettings, setShowWarrantySettings] = useState(false);
  const currentStaffName = currentUser?.name || 'Nhân viên tiếp nhận';
  const [warranties, setWarranties] = useState([]);
  const [showWarrantyQr, setShowWarrantyQr] = useState(true);
  const [localStatusByCode, setLocalStatusByCode] = useState({});
  const [historyByCode, setHistoryByCode] = useState({});
  const [receiptByCode, setReceiptByCode] = useState({});
  const [exchangeByCode, setExchangeByCode] = useState({});
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [period, setPeriod] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeModal, setActiveModal] = useState({ type: '', warranty: null });
  const [receiveForm, setReceiveForm] = useState({
    issue: '',
    productState: '',
    receivedAt: getCurrentDateInput(),
    staffName: currentStaffName,
    note: ''
  });
  const [statusForm, setStatusForm] = useState({ status: 'processing', note: '' });
  const [exchangeForm, setExchangeForm] = useState({
    replacementProduct: '',
    replacementSku: '',
    quantity: 1,
    reason: '',
    deductStock: true
  });

  async function loadWarranties() {
    try {
      const params = new URLSearchParams();
      const dateFrom = getDateFromPeriod(period);

      if (dateFrom) {
        params.set('date_from', dateFrom);
      }

      const queryString = params.toString();
      const response = await api.get(queryString ? `/warranties?${queryString}` : '/warranties');
      setWarranties(response.data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể lấy danh sách bảo hành');
    }
  }

  useEffect(() => {
    loadWarranties();
    getWarrantySettings().then((settings) => setShowWarrantyQr(settings.receipt?.qr !== false));
  }, [period]);

  useEffect(() => {
    const warrantyCode = new URLSearchParams(window.location.search).get('code');
    if (warrantyCode) setSearch(warrantyCode);
  }, []);

  const enrichedWarranties = useMemo(() => {
    return warranties.map((warranty) => ({
      ...warranty,
      status: localStatusByCode[warranty.code] || warranty.status
    }));
  }, [warranties, localStatusByCode]);

  const getHistory = (warranty) => historyByCode[warranty.code] || createInitialHistory(warranty);

  function addHistory(warranty, action, staff, note) {
    setHistoryByCode((current) => ({
      ...current,
      [warranty.code]: [...(current[warranty.code] || createInitialHistory(warranty)), buildHistoryItem(action, staff, note)]
    }));
  }

  function openModal(type, warranty) {
    setActiveModal({ type, warranty });

    if (type === 'receive') {
      setReceiveForm({
        issue: '',
        productState: '',
        receivedAt: getCurrentDateInput(),
        staffName: currentStaffName,
        note: ''
      });
    }

    if (type === 'status') {
      setStatusForm({ status: warranty.status === 'active' ? 'processing' : warranty.status, note: '' });
    }

    if (type === 'exchange') {
      setExchangeForm({
        replacementProduct: '',
        replacementSku: '',
        quantity: 1,
        reason: '',
        deductStock: true
      });
    }
  }

  function closeModal() {
    setActiveModal({ type: '', warranty: null });
  }

  function handleAction(action, warranty) {
    if (action === 'print') {
      openModal('print', warranty);
      return;
    }

    openModal(action, warranty);
  }

  async function handleReceiveSubmit(event) {
    event.preventDefault();
    const warranty = activeModal.warranty;
    const productState = receiveForm.productState.trim();

    try {
      const response = await api.post(`/warranties/${warranty.id}/claims`, {
        issue_description: `${receiveForm.issue}. Tình trạng: ${productState}. ${receiveForm.note}`,
        status: 'received'
      });
      setLocalStatusByCode((current) => ({ ...current, [warranty.code]: 'processing' }));
      setReceiptByCode((current) => ({ ...current, [warranty.code]: { ...receiveForm, productState, claimId: response.data.id } }));
      addHistory(warranty, 'Tiếp nhận bảo hành', receiveForm.staffName, `${receiveForm.issue}. Tình trạng: ${productState}. ${receiveForm.note}`);
      toast.success('Đã tiếp nhận bảo hành');
      closeModal();
    } catch (error) { toast.error(error.response?.data?.message || 'Không thể tiếp nhận bảo hành'); }
  }

  async function handleStatusSubmit(event) {
    event.preventDefault();
    const warranty = activeModal.warranty;
    const nextStatusLabel = statusMeta[statusForm.status]?.label || statusForm.status;

    const claimId = receiptByCode[warranty.code]?.claimId;
    if (!claimId) return toast.error('Hãy tiếp nhận bảo hành trước khi cập nhật');
    const apiStatus = { processing: 'repairing', replaced: 'resolved', rejected: 'rejected', active: 'inspecting' }[statusForm.status] || statusForm.status;
    try { await api.put(`/warranties/claims/${claimId}`, { status: apiStatus, resolution: statusForm.note }); }
    catch (error) { return toast.error(error.response?.data?.message || 'Không thể cập nhật bảo hành'); }
    setLocalStatusByCode((current) => ({ ...current, [warranty.code]: statusForm.status }));
    addHistory(warranty, 'Cập nhật trạng thái', currentStaffName, `${nextStatusLabel}. ${statusForm.note || 'Không có ghi chú.'}`);
    toast.success('Đã cập nhật trạng thái');
    closeModal();
  }

  async function handleExchangeSubmit(event) {
    event.preventDefault();
    const warranty = activeModal.warranty;

    if (exchangeForm.deductStock) {
      await adjustInventoryForExchange(exchangeForm);
    }

    setLocalStatusByCode((current) => ({ ...current, [warranty.code]: 'replaced' }));
    setExchangeByCode((current) => ({ ...current, [warranty.code]: exchangeForm }));
    addHistory(
      warranty,
      'Đổi sản phẩm',
      currentStaffName,
      `${exchangeForm.replacementProduct} (${exchangeForm.replacementSku}), SL ${exchangeForm.quantity}. ${exchangeForm.reason}`
    );
    toast.success('Đã ghi nhận đổi sản phẩm');
    closeModal();
  }

  const filteredWarranties = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return enrichedWarranties.filter((warranty) => {
      const daysLeft = getDaysLeft(warranty.expiresAt);
      const matchesExpiringAlert = !expiringOnly || (
        warranty.warrantyEnabled
        && warranty.status === 'active'
        && daysLeft >= 0
        && daysLeft <= 7
      );
      const matchesStatus = status === 'all' || warranty.status === status;
      const matchesKeyword =
        !keyword ||
        [
          warranty.code,
          warranty.orderNumber,
          warranty.customerName,
          warranty.customerPhone,
          warranty.productName,
          warranty.staffName,
          getWarrantySku(warranty)
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(keyword));

      return matchesExpiringAlert && matchesStatus && matchesKeyword;
    });
  }, [enrichedWarranties, expiringOnly, search, status]);

  useEffect(() => {
    setCurrentPage(1);
  }, [expiringOnly, search, status, period]);

  const summary = useMemo(() => {
    return filteredWarranties.reduce(
      (totals, warranty) => {
        totals.total += 1;
        totals[warranty.status] = (totals[warranty.status] || 0) + 1;

        const daysLeft = getDaysLeft(warranty.expiresAt);
        if (warranty.warrantyEnabled && daysLeft >= 0 && daysLeft <= 30) {
          totals.expiringSoon += 1;
        }

        return totals;
      },
      {
        total: 0,
        active: 0,
        processing: 0,
        replaced: 0,
        returned: 0,
        expired: 0,
        rejected: 0,
        initial_exchange: 0,
        no_warranty: 0,
        expiringSoon: 0
      }
    );
  }, [filteredWarranties]);

  const totalPages = Math.max(Math.ceil(filteredWarranties.length / PAGE_SIZE), 1);
  const visibleWarranties = filteredWarranties.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const summaryCards = [
    {
      key: 'total',
      label: 'Tổng phiếu bảo hành',
      value: summary.total.toLocaleString('vi-VN'),
      detail: 'Theo bộ lọc đang áp dụng',
      icon: FileBadge,
      toneClassName: 'bg-brand-surface text-brand-deep'
    },
    {
      key: 'processing',
      label: 'Đang xử lý',
      value: summary.processing.toLocaleString('vi-VN'),
      detail: 'Phiếu đang tiếp nhận xử lý',
      icon: TimerReset,
      toneClassName: 'bg-yellow-100 text-yellow-800'
    },
    {
      key: 'expiring',
      label: 'Sắp hết hạn',
      value: summary.expiringSoon.toLocaleString('vi-VN'),
      detail: 'Hết hạn trong 7 ngày tới',
      icon: CalendarDays,
      toneClassName: 'bg-red-100 text-red-700'
    },
    {
      key: 'replaced',
      label: 'Đã đổi mới',
      value: summary.replaced.toLocaleString('vi-VN'),
      detail: 'Sản phẩm đã được đổi',
      icon: PackageCheck,
      toneClassName: 'bg-blue-100 text-blue-700'
    }
  ];

  const selectedWarranty = activeModal.warranty;
  const selectedReceipt = selectedWarranty ? receiptByCode[selectedWarranty.code] : null;
  const selectedExchange = selectedWarranty ? exchangeByCode[selectedWarranty.code] : null;

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-950">Bảo hành</h1>
          <p className="mt-1 text-sm font-medium text-gray-500">
            Tra cứu thời hạn, tiếp nhận yêu cầu và theo dõi quá trình xử lý bảo hành cho khách hàng.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowWarrantySettings(true)}
          className="ml-auto inline-flex h-9 items-center gap-2 rounded-md border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          <Settings size={15} />
          Thiết lập bảo hành
        </button>
        <button
          type="button"
          onClick={loadWarranties}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-brand-strong px-4 text-sm font-semibold text-white transition hover:bg-brand-deep"
        >
          <RefreshCw size={15} />
          Làm mới
        </button>
      </div>

      <WarrantySettingsModal
        isOpen={showWarrantySettings}
        onClose={() => setShowWarrantySettings(false)}
        canEdit={canEditWarrantySettings}
        userName={currentStaffName}
      />

      {expiringOnly && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
          <div>
            <p className="font-extrabold">Phiếu bảo hành sắp đến hạn: {filteredWarranties.length.toLocaleString('vi-VN')}</p>
            <p className="mt-0.5 text-xs font-medium">Các phiếu còn hiệu lực và sẽ hết hạn trong 7 ngày tới.</p>
          </div>
          <button type="button" onClick={() => setSearchParams({})} className="inline-flex h-9 items-center gap-2 rounded-md border border-amber-300 bg-white px-3 text-sm font-bold transition hover:bg-amber-100">
            <ChevronsLeft size={16} /> Tất cả phiếu
          </button>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <KpiCard key={card.key} {...card} />
        ))}
      </section>

      <section className="rounded-lg border border-gray-300 bg-white px-4 py-4 shadow-sm shadow-gray-100">
        <div className="space-y-4">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-10 w-full rounded-md border border-gray-300 bg-white pl-10 pr-3 text-sm outline-none transition placeholder:text-gray-500 focus:border-brand"
              placeholder="Tìm mã bảo hành, mã hóa đơn, SKU, số điện thoại, khách hàng hoặc sản phẩm..."
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-1 rounded-md bg-gray-100 p-1">
              {statusOptions.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => setStatus(option.value)}
                  className={`h-8 rounded px-3 text-xs font-bold transition ${
                    status === option.value
                      ? 'bg-white text-brand-deep shadow-sm'
                      : 'text-gray-700 hover:bg-white/70 hover:text-brand-deep'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600">Thời gian:</span>
              <div className="flex overflow-hidden rounded border border-gray-300">
                {periodOptions.map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    onClick={() => setPeriod(option.value)}
                    className={`h-8 border-r border-gray-300 px-3 text-xs font-bold last:border-r-0 ${
                      period === option.value ? 'bg-gray-200 text-brand-deep' : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm shadow-gray-100">
        <div className="border-b border-gray-300 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-950">Phiếu bảo hành từ hóa đơn</h2>
        </div>

        <div className="min-h-[620px] overflow-x-auto">
          <table className="w-full min-w-[1240px] table-fixed text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold uppercase text-gray-500">
                <th className="px-4 py-3">Mã BH</th>
                <th className="px-4 py-3">Mã hóa đơn</th>
                <th className="px-4 py-3">Khách hàng</th>
                <th className="px-4 py-3">Sản phẩm</th>
                <th className="px-4 py-3">Ngày mua</th>
                <th className="px-4 py-3">Hạn Bảo Hành</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Nhân viên</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {visibleWarranties.map((warranty) => (
                <WarrantyRow
                  key={warranty.id}
                  warranty={warranty}
                  onView={(item) => openModal('detail', item)}
                  onAction={handleAction}
                />
              ))}
            </tbody>
          </table>

          {visibleWarranties.length === 0 && (
            <div className="min-w-[1240px] px-5 py-12 text-center text-sm font-medium text-gray-500">
              Chưa có phiếu bảo hành phù hợp với bộ lọc hiện tại.
            </div>
          )}
        </div>

        <TablePagination currentPage={currentPage} totalItems={filteredWarranties.length} pageSize={PAGE_SIZE} onPageChange={setCurrentPage} itemLabel="phiếu bảo hành" ariaLabel="Phân trang bảo hành" />
      </section>

      <Modal
        isOpen={activeModal.type === 'detail'}
        onClose={closeModal}
        title="Chi tiết bảo hành"
        maxWidth="max-w-5xl"
        headerActions={(
          <button type="button" onClick={closeModal} className="h-10 rounded border border-gray-300 bg-white px-4 text-sm font-bold text-gray-700 transition hover:bg-gray-50">
            Đóng
          </button>
        )}
      >
        {selectedWarranty && (
          <div className="grid gap-5 text-sm xl:grid-cols-[1fr_280px]">
            <div className="space-y-4">
              <div className="grid gap-3 rounded-lg bg-gray-50 p-4 md:grid-cols-2">
                <Info label="Mã bảo hành" value={selectedWarranty.code} />
                <div>
                  <span className="text-gray-500">Trạng thái hiện tại</span>
                  <div className="mt-1">
                    <StatusBadge status={selectedWarranty.status} />
                  </div>
                </div>
                <Info label="Mã hóa đơn" value={selectedWarranty.orderNumber} />
                <Info label="Nhân viên bán" value={selectedWarranty.staffName} />
                <Info label="Khách hàng" value={selectedWarranty.customerName} />
                <Info label="Số điện thoại" value={selectedWarranty.customerPhone || 'Chưa có'} />
              </div>

              <div className="rounded-lg border border-gray-200 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <Info label="Tên sản phẩm" value={selectedWarranty.productName} />
                  <Info label="SKU" value={getWarrantySku(selectedWarranty)} />
                  <Info label="Giá bán" value={formatCurrency(selectedWarranty.unitPrice)} />
                  <Info label="Số lượng" value={selectedWarranty.quantity.toLocaleString('vi-VN')} />
                  <Info label="Ngày mua" value={formatDate(selectedWarranty.purchasedAt)} />
                  <Info
                    label="Thời hạn bảo hành"
                    value={selectedWarranty.status === 'no_warranty' ? 'Không áp dụng' : formatDate(selectedWarranty.expiresAt)}
                  />
                  <Info label="Loại chính sách" value={statusMeta[selectedWarranty.status]?.label || selectedWarranty.warrantyType} />
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-950">Điều kiện bảo hành</h3>
                <p className="mt-2 text-sm text-gray-700">{getWarrantyCondition(selectedWarranty)}</p>
                {selectedWarranty.warrantyExclusions && (
                  <p className="mt-2 text-sm text-gray-700">
                    <span className="font-semibold text-gray-900">Từ chối: </span>
                    {selectedWarranty.warrantyExclusions}
                  </p>
                )}
                {selectedWarranty.warrantyNote && <p className="mt-2 text-xs font-semibold text-gray-500">{selectedWarranty.warrantyNote}</p>}
              </div>

              <div className="rounded-lg bg-gray-50 p-4">
                <h3 className="text-sm font-semibold text-gray-950">Ghi chú</h3>
                <p className="mt-2 text-sm text-gray-700">
                  {selectedReceipt?.note || selectedWarranty.note || 'Chưa có ghi chú xử lý.'}
                </p>
              </div>

              {selectedExchange && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                  <h3 className="text-sm font-semibold text-blue-900">Thông tin đổi sản phẩm</h3>
                  <p className="mt-2 text-sm text-blue-900">
                    {selectedExchange.replacementProduct} - {selectedExchange.replacementSku}, SL {selectedExchange.quantity}
                  </p>
                </div>
              )}

              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-950">Lịch sử xử lý</h3>
                <HistoryTable history={getHistory(selectedWarranty)} />
              </div>
            </div>

            <aside className="space-y-4">
              {showWarrantyQr && <WarrantyQr warrantyCode={selectedWarranty.code} publicToken={selectedWarranty.publicToken} />}
              <div className="hidden h-40 place-items-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-center text-xs font-semibold text-gray-500">
                QR tra cứu bảo hành
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-950">Thao tác nhanh</h3>
                <div className="mt-3 grid gap-2">
                  <button className="h-9 rounded border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50" onClick={() => openModal('receive', selectedWarranty)}>
                    Tiếp nhận bảo hành
                  </button>
                  <button className="h-9 rounded border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50" onClick={() => openModal('status', selectedWarranty)}>
                    Cập nhật trạng thái
                  </button>
                  <button className="h-9 rounded border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50" onClick={() => openModal('exchange', selectedWarranty)}>
                    Đổi sản phẩm
                  </button>
                  <button className="h-9 rounded bg-brand-strong text-sm font-semibold text-white hover:bg-brand-deep" onClick={() => openModal('print', selectedWarranty)}>
                    In phiếu
                  </button>
                </div>
              </div>
            </aside>
          </div>
        )}
      </Modal>

      <Modal isOpen={activeModal.type === 'receive'} onClose={closeModal} title="Tiếp nhận bảo hành">
        {selectedWarranty && (
          <form onSubmit={handleReceiveSubmit} className="space-y-4 text-sm">
            <Info label="Mã bảo hành" value={selectedWarranty.code} />
            <label className="block">
              <span className="mb-1 block font-medium text-gray-700">Tình trạng lỗi khách báo</span>
              <textarea
                required
                value={receiveForm.issue}
                onChange={(event) => setReceiveForm({ ...receiveForm, issue: event.target.value })}
                className="min-h-24 w-full rounded border border-gray-300 px-3 py-2 outline-none focus:border-brand"
              />
            </label>
            <label className="block">
              <span className="mb-1 block font-medium text-gray-700">Tình trạng sản phẩm khi nhận</span>
              <textarea
                required
                value={receiveForm.productState}
                onChange={(event) => setReceiveForm({ ...receiveForm, productState: event.target.value })}
                className="min-h-24 w-full rounded border border-gray-300 px-3 py-2 outline-none focus:border-brand"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block font-medium text-gray-700">Ngày tiếp nhận</span>
                <input type="date" value={receiveForm.receivedAt} readOnly className="h-10 w-full rounded border border-gray-300 bg-gray-50 px-3" />
              </label>
              <label className="block">
                <span className="mb-1 block font-medium text-gray-700">Nhân viên tiếp nhận</span>
                <input value={receiveForm.staffName} readOnly className="h-10 w-full rounded border border-gray-300 bg-gray-50 px-3" />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block font-medium text-gray-700">Ghi chú</span>
              <textarea
                value={receiveForm.note}
                onChange={(event) => setReceiveForm({ ...receiveForm, note: event.target.value })}
                className="min-h-20 w-full rounded border border-gray-300 px-3 py-2 outline-none focus:border-brand"
              />
            </label>
            <FormActions onCancel={closeModal} submitLabel="Xác nhận tiếp nhận" />
          </form>
        )}
      </Modal>

      <Modal isOpen={activeModal.type === 'status'} onClose={closeModal} title="Cập nhật trạng thái">
        {selectedWarranty && (
          <form onSubmit={handleStatusSubmit} className="space-y-4 text-sm">
            <Info label="Mã bảo hành" value={selectedWarranty.code} />
            <label className="block">
              <span className="mb-1 block font-medium text-gray-700">Trạng thái mới</span>
              <select
                value={statusForm.status}
                onChange={(event) => setStatusForm({ ...statusForm, status: event.target.value })}
                className="h-10 w-full rounded border border-gray-300 bg-white px-3 outline-none focus:border-brand"
              >
                {updateStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block font-medium text-gray-700">Ghi chú lý do cập nhật</span>
              <textarea
                value={statusForm.note}
                onChange={(event) => setStatusForm({ ...statusForm, note: event.target.value })}
                className="min-h-24 w-full rounded border border-gray-300 px-3 py-2 outline-none focus:border-brand"
              />
            </label>
            <FormActions onCancel={closeModal} submitLabel="Lưu cập nhật" />
          </form>
        )}
      </Modal>

      <Modal isOpen={activeModal.type === 'exchange'} onClose={closeModal} title="Đổi sản phẩm">
        {selectedWarranty && (
          <form onSubmit={handleExchangeSubmit} className="space-y-4 text-sm">
            <div className="rounded-lg bg-gray-50 p-4">
              <Info label="Sản phẩm lỗi hiện tại" value={`${selectedWarranty.productName} (${getWarrantySku(selectedWarranty)})`} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput label="Sản phẩm đổi mới" value={exchangeForm.replacementProduct} required onChange={(value) => setExchangeForm({ ...exchangeForm, replacementProduct: value })} />
              <TextInput label="SKU sản phẩm đổi" value={exchangeForm.replacementSku} required onChange={(value) => setExchangeForm({ ...exchangeForm, replacementSku: value })} />
              <TextInput label="Số lượng đổi" type="number" min="1" value={exchangeForm.quantity} required onChange={(value) => setExchangeForm({ ...exchangeForm, quantity: Number(value) })} />
            </div>
            <label className="block">
              <span className="mb-1 block font-medium text-gray-700">Ghi chú lý do đổi</span>
              <textarea
                required
                value={exchangeForm.reason}
                onChange={(event) => setExchangeForm({ ...exchangeForm, reason: event.target.value })}
                className="min-h-24 w-full rounded border border-gray-300 px-3 py-2 outline-none focus:border-brand"
              />
            </label>
            <Checkbox
              label="Trừ tồn kho sản phẩm đổi mới"
              checked={exchangeForm.deductStock}
              onChange={(value) => setExchangeForm({ ...exchangeForm, deductStock: value })}
            />
            
            <FormActions onCancel={closeModal} submitLabel="Xác nhận đổi sản phẩm" />
          </form>
        )}
      </Modal>

      <Modal isOpen={activeModal.type === 'print'} onClose={closeModal} title="In phiếu tiếp nhận bảo hành" maxWidth="max-w-3xl">
        {selectedWarranty && (
          <div className="space-y-4 text-sm">
            <div className="rounded-lg border border-gray-300 bg-white p-5">
              <div className="mb-5 border-b border-gray-200 pb-3">
                <h3 className="text-lg font-bold text-gray-950">Z-TECH POS</h3>
                <p className="text-sm text-gray-600">Phiếu tiếp nhận bảo hành</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Info label="Mã bảo hành" value={selectedWarranty.code} />
                <Info label="Khách hàng" value={selectedWarranty.customerName} />
                <Info label="Số điện thoại" value={selectedWarranty.customerPhone || 'Chưa có'} />
                <Info label="Sản phẩm" value={selectedWarranty.productName} />
                <Info label="Tình trạng lỗi" value={selectedReceipt?.issue || 'Chưa tiếp nhận'} />
                <Info label="Ngày tiếp nhận" value={selectedReceipt?.receivedAt ? formatDate(selectedReceipt.receivedAt) : formatDate(new Date())} />
                <Info label="Nhân viên tiếp nhận" value={selectedReceipt?.staffName || currentStaffName} />
                <Info label="Ghi chú" value={selectedReceipt?.note || selectedWarranty.note || 'Không có'} />
              </div>
              <div className="mt-10 grid grid-cols-2 gap-8 text-center text-sm font-semibold text-gray-800">
                <div className="border-t border-gray-300 pt-2">Chữ ký khách hàng</div>
                <div className="border-t border-gray-300 pt-2">Chữ ký nhân viên</div>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={closeModal} className="h-9 rounded border border-gray-300 px-4 text-sm font-semibold text-gray-700">
                Đóng
              </button>
              <button type="button" onClick={() => window.print()} className="h-9 rounded bg-brand-strong px-4 text-sm font-semibold text-white hover:bg-brand-deep">
                In phiếu
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <span className="block text-gray-500">{label}</span>
      <div className="mt-1 font-semibold text-gray-950">{value}</div>
    </div>
  );
}

function TextInput({ label, value, onChange, type = 'text', ...props }) {
  return (
    <label className="block">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded border border-gray-300 px-3 outline-none focus:border-brand"
        {...props}
      />
    </label>
  );
}

function Checkbox({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm text-gray-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-brand-strong focus:ring-brand"
      />
      <span>{label}</span>
    </label>
  );
}

function FormActions({ onCancel, submitLabel }) {
  return (
    <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
      <button type="button" onClick={onCancel} className="h-9 rounded border border-gray-300 px-4 text-sm font-semibold text-gray-700">
        Hủy
      </button>
      <button type="submit" className="h-9 rounded bg-brand-strong px-4 text-sm font-semibold text-white hover:bg-brand-deep">
        {submitLabel}
      </button>
    </div>
  );
}
