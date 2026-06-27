import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarX,
  CheckCircle2,
  Clock3,
  Download,
  Edit,
  Eye,
  Plus,
  Search,
  TicketPercent,
  X
} from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { getPromotions, savePromotions } from '../services/promotionService';
import api from '../api/axios';
import { getUser, isFullAccessRole } from '../utils/auth';

export const initialPromotions = [
  {
    id: 1,
    code: 'SALE10',
    name: 'Giảm 10% phụ kiện iPhone',
    discountType: 'percent',
    discountValue: 10,
    condition: 'Đơn từ 300.000đ',
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    status: 'active',
    enabled: true,
    scope: 'Danh mục phụ kiện iPhone',
    minOrder: 300000,
    maxDiscount: 120000,
    description: 'Áp dụng cho đơn hàng phụ kiện iPhone trong tháng 6.'
  },
  {
    id: 2,
    code: 'OP50K',
    name: 'Giảm 50K ốp lưng',
    discountType: 'amount',
    discountValue: 50000,
    condition: 'Áp dụng cho ốp lưng',
    startDate: '2026-06-05',
    endDate: '2026-06-20',
    status: 'ending',
    enabled: true,
    scope: 'Theo danh mục sản phẩm',
    minOrder: 0,
    maxDiscount: 50000,
    description: 'Ưu đãi xả mẫu ốp lưng tồn kho.'
  },
  {
    id: 3,
    code: 'GLASS15',
    name: 'Giảm 15% cường lực',
    discountType: 'percent',
    discountValue: 15,
    condition: 'Danh mục kính cường lực',
    startDate: '2026-05-01',
    endDate: '2026-05-31',
    status: 'ended',
    enabled: false,
    scope: 'Theo danh mục sản phẩm',
    minOrder: 0,
    maxDiscount: 80000,
    description: 'Chương trình đã kết thúc cho nhóm kính cường lực.'
  },
  {
    id: 4,
    code: 'COMBO25',
    name: 'Combo sạc cáp giảm 25K',
    discountType: 'amount',
    discountValue: 25000,
    condition: 'Mua từ 2 sản phẩm',
    startDate: '2026-06-10',
    endDate: '2026-07-10',
    status: 'active',
    enabled: true,
    scope: 'Theo sản phẩm cụ thể',
    minOrder: 200000,
    maxDiscount: 25000,
    description: 'Khuyến khích bán combo sạc và cáp nhanh.'
  }
];

const emptyForm = {
  code: '',
  name: '',
  discountType: 'percent',
  discountValue: '',
  minOrder: '',
  maxDiscount: '',
  scope: 'Toàn đơn hàng',
  categoryId: '',
  productId: '',
  deviceFamily: '',
  startDate: '',
  endDate: '',
  enabled: true,
  description: ''
};

const statusOptions = [
  { value: 'all', label: 'Tất cả' },
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'ending', label: 'Sắp hết hạn' },
  { value: 'ended', label: 'Đã kết thúc' }
];

const discountTypeOptions = [
  { value: 'all', label: 'Tất cả' },
  { value: 'percent', label: 'Giảm %' },
  { value: 'amount', label: 'Giảm tiền' }
];

const statusStyles = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  ending: 'bg-amber-50 text-amber-700 ring-amber-100',
  ended: 'bg-gray-100 text-gray-600 ring-gray-200'
};

const statusLabels = {
  active: 'Đang hoạt động',
  ending: 'Sắp hết hạn',
  ended: 'Đã kết thúc'
};

const promotionCodeMessage =
  'Mã KM phải 3-20 ký tự, không dấu, không khoảng trắng, chỉ gồm chữ cái, số, gạch ngang hoặc gạch dưới';

function normalizePromotionCode(value) {
  return String(value || '').trim().toUpperCase();
}

function isValidPromotionCode(value) {
  return /^[A-Z0-9_-]{3,20}$/.test(normalizePromotionCode(value));
}

function formatDateText(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('vi-VN');
}

function formatDiscount(promotion) {
  return promotion.discountType === 'percent'
    ? `${promotion.discountValue}%`
    : formatCurrency(promotion.discountValue);
}

function getPromotionStatus(promotion) {
  if (!promotion.enabled) return 'ended';
  return promotion.status;
}

export default function Promotions() {
  const hasFullAccess = isFullAccessRole(getUser()?.role);
  const [promotions, setPromotions] = useState(() => getPromotions(initialPromotions));
  useEffect(() => { savePromotions(promotions); }, [promotions]);
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    discountType: 'all',
    startDate: '',
    endDate: ''
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [codeError, setCodeError] = useState('');
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [productSearchError, setProductSearchError] = useState('');
  useEffect(() => { Promise.all([api.get('/categories'), api.get('/products')]).then(([categoryResponse, productResponse]) => { setCategories(categoryResponse.data || []); setProducts(productResponse.data || []); }).catch(() => {}); }, []);

  const stats = useMemo(() => {
    const total = promotions.length;
    const active = promotions.filter((promotion) => getPromotionStatus(promotion) === 'active').length;
    const ending = promotions.filter((promotion) => getPromotionStatus(promotion) === 'ending').length;
    const ended = promotions.filter((promotion) => getPromotionStatus(promotion) === 'ended').length;

    return [
      { label: 'Tổng khuyến mãi', value: total, icon: BarChart3, tone: 'bg-brand-surface text-brand-deep' },
      { label: 'Đang hoạt động', value: active, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700' },
      { label: 'Sắp hết hạn', value: ending, icon: Clock3, tone: 'bg-amber-50 text-amber-700' },
      { label: 'Đã kết thúc', value: ended, icon: CalendarX, tone: 'bg-gray-100 text-gray-600' }
    ];
  }, [promotions]);

  const filteredPromotions = useMemo(() => {
    const keyword = filters.search.trim().toLowerCase();

    return promotions.filter((promotion) => {
      const currentStatus = getPromotionStatus(promotion);
      const matchesKeyword = [promotion.code, promotion.name, promotion.condition]
        .join(' ')
        .toLowerCase()
        .includes(keyword);
      const matchesStatus = filters.status === 'all' || currentStatus === filters.status;
      const matchesType = filters.discountType === 'all' || promotion.discountType === filters.discountType;
      const matchesStart = !filters.startDate || promotion.endDate >= filters.startDate;
      const matchesEnd = !filters.endDate || promotion.startDate <= filters.endDate;

      const staffCanView = hasFullAccess || (promotion.enabled && ['active', 'ending'].includes(currentStatus));
      return staffCanView && matchesKeyword && matchesStatus && matchesType && matchesStart && matchesEnd;
    });
  }, [filters, promotions, hasFullAccess]);

  const openCreateDrawer = () => {
    setEditingPromotion(null);
    setForm(emptyForm);
    setCodeError('');
    setProductSearch('');
    setIsDrawerOpen(true);
  };

  const openEditDrawer = (promotion) => {
    setEditingPromotion(promotion);
    setForm({
      code: promotion.code,
      name: promotion.name,
      discountType: promotion.discountType,
      discountValue: promotion.discountValue,
      minOrder: promotion.minOrder,
      maxDiscount: promotion.maxDiscount,
      scope: promotion.scope,
      categoryId: promotion.categoryId || '',
      productId: promotion.productId || '',
      deviceFamily: promotion.deviceFamily || '',
      startDate: promotion.startDate,
      endDate: promotion.endDate,
      enabled: promotion.enabled,
      description: promotion.description
    });
    setCodeError('');
    setProductSearch(promotion.targetName || '');
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setEditingPromotion(null);
    setForm(emptyForm);
    setCodeError('');
    setProductSearch('');
  };

  const resetFilters = () => {
    setFilters({ search: '', status: 'all', discountType: 'all', startDate: '', endDate: '' });
  };

  const matchingProducts = useMemo(() => {
    const keyword = productSearch.trim().toLowerCase();
    if (!keyword) return products.slice(0, 30);
    return products.filter((product) => {
      const code = product.sku || `SKU-${String(product.id).padStart(5, '0')}`;
      return `${code} ${product.name}`.toLowerCase().includes(keyword);
    }).slice(0, 30);
  }, [products, productSearch]);

  const togglePromotion = (promotionId) => {
    setPromotions((current) =>
      current.map((promotion) =>
        promotion.id === promotionId ? { ...promotion, enabled: !promotion.enabled } : promotion
      )
    );
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (form.scope === 'Theo sản phẩm cụ thể' && !form.productId) {
      setProductSearchError('Vui lòng chọn một sản phẩm trong danh sách gợi ý');
      return;
    }

    const normalizedCode = normalizePromotionCode(form.code);
    const isDuplicateCode = promotions.some(
      (promotion) =>
        normalizePromotionCode(promotion.code) === normalizedCode && promotion.id !== editingPromotion?.id
    );

    if (!isValidPromotionCode(normalizedCode)) {
      setCodeError(promotionCodeMessage);
      return;
    }

    if (isDuplicateCode) {
      setCodeError('Mã khuyến mãi đã tồn tại, vui lòng nhập mã khác');
      return;
    }

    const payload = {
      ...form,
      code: normalizedCode,
      name: form.name.trim(),
      discountValue: Number(form.discountValue || 0),
      minOrder: Number(form.minOrder || 0),
      maxDiscount: Number(form.maxDiscount || 0),
      categoryId: form.scope === 'Theo danh mục sản phẩm' ? Number(form.categoryId || 0) || '' : '',
      productId: form.scope === 'Theo sản phẩm cụ thể' ? Number(form.productId || 0) || '' : '',
      deviceFamily: form.scope === 'Theo dòng thiết bị' ? form.deviceFamily : '',
      targetName: form.scope === 'Theo danh mục sản phẩm' ? categories.find((item) => Number(item.id) === Number(form.categoryId))?.name : form.scope === 'Theo sản phẩm cụ thể' ? products.find((item) => Number(item.id) === Number(form.productId))?.name : form.scope === 'Theo dòng thiết bị' ? form.deviceFamily : '',
      condition:
        form.scope === 'Toàn đơn hàng'
          ? `Đơn từ ${formatCurrency(Number(form.minOrder || 0))}`
          : form.scope,
      status: form.enabled ? 'active' : 'ended'
    };

    if (editingPromotion) {
      setPromotions((current) =>
        current.map((promotion) => (promotion.id === editingPromotion.id ? { ...promotion, ...payload } : promotion))
      );
    } else {
      setPromotions((current) => [{ id: Date.now(), ...payload }, ...current]);
    }

    closeDrawer();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold leading-8 text-brand-deep">Trang khuyến mãi</h1>
        </div>
        <div className="flex flex-wrap gap-3" style={{ display: hasFullAccess ? undefined : 'none' }}>
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d5dbe3] bg-white px-4 text-sm font-semibold text-[#26313d] transition hover:bg-[#f5f9fc]"
          >
            <Download size={17} />
            Xuất báo cáo
          </button>
          <button
            type="button"
            onClick={openCreateDrawer}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-deep px-4 text-sm font-semibold text-white transition hover:bg-brand-strong"
          >
            <Plus size={18} />
            Thêm khuyến mãi
          </button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => {
          const Icon = item.icon;

          return (
            <article key={item.label} className="rounded-lg border border-[#e1e5ea] bg-white p-5">
              <div className="flex items-center gap-4">
                <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${item.tone}`}>
                  <Icon size={20} />
                </div>
                <div className="flex flex-1 items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#68707a]">{item.label}</p>
                  <p className="text-2xl font-bold text-brand-deep">{item.value}</p>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="rounded-lg border border-[#e1e5ea] bg-white p-5">
        <div className="grid gap-4 lg:grid-cols-5">
          <label className="lg:col-span-2">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#68707a]">Tìm kiếm</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a828c]" />
              <input
                value={filters.search}
                onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                className="h-10 w-full rounded-lg border border-[#d5dbe3] bg-white pl-10 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
                placeholder="Tìm theo mã hoặc tên khuyến mãi"
              />
            </span>
          </label>
          <label>
            <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#68707a]">Trạng thái</span>
            <select
              value={filters.status}
              onChange={(event) => setFilters({ ...filters, status: event.target.value })}
              className="h-10 w-full rounded-lg border border-[#d5dbe3] bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#68707a]">Loại giảm</span>
            <select
              value={filters.discountType}
              onChange={(event) => setFilters({ ...filters, discountType: event.target.value })}
              className="h-10 w-full rounded-lg border border-[#d5dbe3] bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
            >
              {discountTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button
              type="button"
              className="h-10 flex-1 rounded-lg bg-brand px-3 text-sm font-semibold text-white transition hover:bg-brand-strong"
            >
              Lọc
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="h-10 flex-1 rounded-lg border border-[#d5dbe3] bg-white px-3 text-sm font-semibold text-[#26313d] transition hover:bg-[#f5f9fc]"
            >
              Đặt lại
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <label>
            <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#68707a]">Khoảng thời gian</span>
            <span className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
              <input
                type="date"
                value={filters.startDate}
                onChange={(event) => setFilters({ ...filters, startDate: event.target.value })}
                className="h-10 rounded-lg border border-[#d5dbe3] px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
              />
              <span className="text-sm font-medium text-[#68707a]">đến</span>
              <input
                type="date"
                value={filters.endDate}
                onChange={(event) => setFilters({ ...filters, endDate: event.target.value })}
                className="h-10 rounded-lg border border-[#d5dbe3] px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
              />
            </span>
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-[#e1e5ea] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="border-b border-[#e1e5ea] bg-[#f3f6f8] text-xs uppercase tracking-wide text-[#68707a]">
              <tr>
                <th className="px-5 py-3 font-bold">Mã KM</th>
                <th className="px-5 py-3 font-bold">Tên khuyến mãi</th>
                <th className="px-5 py-3 font-bold">Loại giảm</th>
                <th className="px-5 py-3 font-bold">Giá trị</th>
                <th className="px-5 py-3 font-bold">Điều kiện áp dụng</th>
                <th className="px-5 py-3 font-bold">Thời gian</th>
                <th className="px-5 py-3 font-bold">Trạng thái</th>
                <th className="px-5 py-3 text-right font-bold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf0f2]">
              {filteredPromotions.map((promotion) => {
                const status = getPromotionStatus(promotion);

                return (
                  <tr key={promotion.id} className="transition hover:bg-[#f8fafc]">
                    <td className="px-5 py-4 font-bold text-brand-strong">{promotion.code}</td>
                    <td className="px-5 py-4 font-semibold text-[#1f2933]">{promotion.name}</td>
                    <td className="px-5 py-4 text-[#4f5965]">
                      {promotion.discountType === 'percent' ? 'Giảm %' : 'Giảm tiền'}
                    </td>
                    <td className="px-5 py-4 font-bold text-[#1f2933]">{formatDiscount(promotion)}</td>
                    <td className="px-5 py-4 text-[#4f5965]">{promotion.condition}</td>
                    <td className="px-5 py-4 text-[#68707a]">
                      {formatDateText(promotion.startDate)} - {formatDateText(promotion.endDate)}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${statusStyles[status]}`}>
                        {statusLabels[status]}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-3">
                        <button type="button" className="text-[#68707a] transition hover:text-brand-deep" title="Xem">
                          <Eye size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditDrawer(promotion)}
                          style={{ display: hasFullAccess ? undefined : 'none' }}
                          className="text-[#68707a] transition hover:text-brand-deep"
                          title="Sửa"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => togglePromotion(promotion.id)}
                          style={{ display: hasFullAccess ? undefined : 'none' }}
                          className={`relative h-5 w-9 rounded-full transition ${
                            promotion.enabled ? 'bg-brand' : 'bg-gray-300'
                          }`}
                          aria-label="Bật tắt khuyến mãi"
                        >
                          <span
                            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${
                              promotion.enabled ? 'left-[18px]' : 'left-0.5'
                            }`}
                          />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {isDrawerOpen && (
        <div className="fixed inset-0 z-[70]">
          <button
            type="button"
            className="absolute inset-0 bg-black/35"
            aria-label="Đóng form khuyến mãi"
            onClick={closeDrawer}
          />
          <aside className="absolute left-1/2 top-1/2 flex h-[min(90vh,820px)] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col bg-white shadow-[0_12px_40px_rgba(15,23,42,0.18)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#e1e5ea] bg-[#f8fbfd] p-6">
              <div>
                <h2 className="text-xl font-bold text-brand-deep">
                  {editingPromotion ? 'Sửa khuyến mãi' : 'Thêm khuyến mãi mới'}
                </h2>
                <p className="mt-1 text-xs font-medium text-[#68707a]">
                  Điền thông tin để cấu hình chương trình ưu đãi
                </p>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="grid h-9 w-9 place-items-center rounded-lg border border-[#d5dbe3] text-[#4f5965] transition hover:bg-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-5 overflow-y-auto p-6">
                <div className="grid grid-cols-2 gap-4">
                  <label>
                    <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#68707a]">Mã KM *</span>
                    <input
                      value={form.code}
                      onChange={(event) => {
                        const nextCode = normalizePromotionCode(event.target.value);
                        setForm({ ...form, code: nextCode });
                        setCodeError('');
                      }}
                      className="h-10 w-full rounded-lg border border-[#d5dbe3] px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
                      placeholder="SALE20"
                      maxLength={20}
                      pattern="[A-Z0-9_-]{3,20}"
                      title={promotionCodeMessage}
                      required
                    />
                    {codeError && <p className="mt-1 text-xs font-semibold text-red-600">{codeError}</p>}
                  </label>
                  <label>
                    <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#68707a]">Trạng thái</span>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, enabled: !form.enabled })}
                      className="flex h-10 items-center gap-3"
                    >
                      <span className={`relative h-6 w-11 rounded-full transition ${form.enabled ? 'bg-brand' : 'bg-gray-300'}`}>
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                            form.enabled ? 'left-5' : 'left-0.5'
                          }`}
                        />
                      </span>
                      <span className="text-sm font-semibold text-[#26313d]">Kích hoạt</span>
                    </button>
                  </label>
                </div>

                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#68707a]">Tên chương trình *</span>
                  <input
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    className="h-10 w-full rounded-lg border border-[#d5dbe3] px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
                    placeholder="Nhập tên chương trình khuyến mãi"
                    required
                  />
                </label>

                <div className="grid grid-cols-2 gap-4">
                  <label>
                    <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#68707a]">Loại giảm</span>
                    <select
                      value={form.discountType}
                      onChange={(event) => setForm({ ...form, discountType: event.target.value })}
                      className="h-10 w-full rounded-lg border border-[#d5dbe3] px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
                    >
                      <option value="percent">Giảm theo %</option>
                      <option value="amount">Giảm tiền trực tiếp</option>
                    </select>
                  </label>
                  <label>
                    <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#68707a]">Giá trị giảm</span>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        value={form.discountValue}
                        onChange={(event) => setForm({ ...form, discountValue: event.target.value })}
                        className="h-10 w-full rounded-lg border border-[#d5dbe3] px-3 pr-10 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
                        placeholder="0"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#68707a]">
                        {form.discountType === 'percent' ? '%' : 'đ'}
                      </span>
                    </div>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <label>
                    <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#68707a]">Đơn tối thiểu</span>
                    <input
                      type="number"
                      min="0"
                      value={form.minOrder}
                      onChange={(event) => setForm({ ...form, minOrder: event.target.value })}
                      className="h-10 w-full rounded-lg border border-[#d5dbe3] px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
                      placeholder="0"
                    />
                  </label>
                  <label>
                    <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#68707a]">Giảm tối đa</span>
                    <input
                      type="number"
                      min="0"
                      value={form.maxDiscount}
                      onChange={(event) => setForm({ ...form, maxDiscount: event.target.value })}
                      className="h-10 w-full rounded-lg border border-[#d5dbe3] px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
                      placeholder="Không giới hạn"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#68707a]">Phạm vi áp dụng</span>
                  <select
                    value={form.scope}
                    onChange={(event) => setForm({ ...form, scope: event.target.value, categoryId: '', productId: '', deviceFamily: '' })}
                    className="h-10 w-full rounded-lg border border-[#d5dbe3] px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
                  >
                    <option>Toàn đơn hàng</option>
                    <option>Theo danh mục sản phẩm</option>
                    <option>Theo dòng thiết bị</option>
                    <option>Theo sản phẩm cụ thể</option>
                  </select>
                </label>

                {form.scope === 'Theo danh mục sản phẩm' && <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#68707a]">Danh mục được áp dụng *</span>
                  <select required value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} className="h-10 w-full border border-[#d5dbe3] px-3 text-sm outline-none focus:border-brand">
                    <option value="">Chọn danh mục sản phẩm</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </label>}

                {form.scope === 'Theo dòng thiết bị' && <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#68707a]">Dòng thiết bị được áp dụng *</span>
                  <select required value={form.deviceFamily} onChange={(event) => setForm({ ...form, deviceFamily: event.target.value })} className="h-10 w-full border border-[#d5dbe3] px-3 text-sm outline-none focus:border-brand">
                    <option value="">Chọn dòng thiết bị</option><option value="apple">Apple / iPhone</option><option value="samsung">Samsung</option><option value="oppo">Oppo</option><option value="vivo">Vivo</option><option value="xiaomi">Xiaomi / Redmi / Poco</option>
                  </select>
                </label>}

                {form.scope === 'Theo sản phẩm cụ thể' && <div className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#68707a]">Sản phẩm được áp dụng *</span>
                  <div className="relative">
                    <input required value={productSearch} onChange={(event) => { setProductSearch(event.target.value); setProductSearchError(''); setForm({ ...form, productId: '' }); }} placeholder="Nhập mã SKU hoặc tên sản phẩm..." className="h-10 w-full border border-[#d5dbe3] px-3 text-sm outline-none focus:border-brand" />
                    {!form.productId && <div className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto border border-[#d5dbe3] bg-white shadow-lg">
                      {matchingProducts.length === 0 ? <p className="p-3 text-sm text-[#68707a]">Không tìm thấy sản phẩm phù hợp.</p> : matchingProducts.map((product) => {
                        const code = product.sku || `SKU-${String(product.id).padStart(5, '0')}`;
                        return <button key={product.id} type="button" onClick={() => { setForm({ ...form, productId: product.id }); setProductSearchError(''); setProductSearch(`${code} - ${product.name}`); }} className="block w-full border-b px-3 py-2 text-left hover:bg-brand-surface"><span className="block text-xs font-bold text-brand-strong">{code}</span><span className="block truncate text-sm text-[#26313d]">{product.name}</span></button>;
                      })}
                    </div>}
                  </div>
                  {productSearchError && <p className="mt-1 text-xs font-semibold text-red-600">{productSearchError}</p>}
                  {form.productId && <button type="button" onClick={() => { setForm({ ...form, productId: '' }); setProductSearch(''); }} className="mt-1 text-xs font-bold text-red-600">Chọn lại sản phẩm</button>}
                </div>}

                <div className="grid grid-cols-2 gap-4">
                  <label>
                    <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#68707a]">Ngày bắt đầu</span>
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(event) => setForm({ ...form, startDate: event.target.value })}
                      className="h-10 w-full rounded-lg border border-[#d5dbe3] px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
                    />
                  </label>
                  <label>
                    <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#68707a]">Ngày kết thúc</span>
                    <input
                      type="date"
                      value={form.endDate}
                      onChange={(event) => setForm({ ...form, endDate: event.target.value })}
                      className="h-10 w-full rounded-lg border border-[#d5dbe3] px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#68707a]">Mô tả chi tiết</span>
                  <textarea
                    value={form.description}
                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                    rows={3}
                    className="w-full rounded-lg border border-[#d5dbe3] px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
                    placeholder="Nhập ghi chú hoặc điều kiện chi tiết..."
                  />
                </label>
              </div>

              <div className="flex gap-3 border-t border-[#e1e5ea] bg-[#f8fbfd] p-6">
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="h-10 flex-1 rounded-lg border border-[#d5dbe3] bg-white text-sm font-semibold text-[#4f5965] transition hover:bg-[#f5f9fc]"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="h-10 flex-1 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong"
                >
                  Lưu khuyến mãi
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}
    </div>
  );
}
