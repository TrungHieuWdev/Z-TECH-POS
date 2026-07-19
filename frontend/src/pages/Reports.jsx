import { memo, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useLocation } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, BrainCircuit, Calculator, CalendarDays, CheckCircle2,
  CircleDollarSign, Download, Eye, FileSpreadsheet, History, Lightbulb,
  LoaderCircle, Minus, ReceiptText, RotateCcw, SlidersHorizontal, Target,
  Trash2, TrendingDown, TrendingUp, UserRound, X
} from 'lucide-react';
import { formatCurrency } from '../utils/format';
import {
  deleteAiRevenueAnalysisHistoryItem,
  exportRevenueExcelReport,
  exportRevenueReport,
  loadAiRevenueAnalysisHistory,
  loadAiRevenueAnalysisHistoryItem,
  loadRevenueDashboard,
  runAiRevenueAnalysis
} from '../services/revenueReportService';
import { AiReportChart, CategoryRevenueChart, DailyRevenueChart, GrossProfitChart, PaymentChart, TopProductsChart } from '../components/reports/RevenueCharts';
import Modal from '../components/Modal';
import TablePagination from '../components/TablePagination';
import PageLoading from '../components/PageLoading';

const StableAiReportChart = memo(AiReportChart);
const StableCategoryRevenueChart = memo(CategoryRevenueChart);
const StableDailyRevenueChart = memo(DailyRevenueChart);
const StableGrossProfitChart = memo(GrossProfitChart);
const StablePaymentChart = memo(PaymentChart);
const StableTopProductsChart = memo(TopProductsChart);

const paymentLabels = { cash: 'Tiền mặt', card: 'Thẻ', transfer: 'Chuyển khoản', e_wallet: 'Ví điện tử', other: 'Khác' };
const statusLabels = { all: 'Tất cả trạng thái', completed: 'Hoàn thành', cancelled: 'Đã hủy' };

function dateText(date) {
  const year = date.getFullYear();
  return `${year}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function displayDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN').format(new Date(`${value}T00:00:00`));
}

function displayDateTime(value) {
  if (!value) return '';
  const parsed = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(parsed);
}

function analysisFilterText(filters = {}, categories = []) {
  const parts = [];
  if (filters.categoryId) {
    const categoryName = categories.find((item) => Number(item.id) === Number(filters.categoryId))?.name;
    parts.push(categoryName || `Danh mục #${filters.categoryId}`);
  }
  if (filters.paymentMethod) parts.push(paymentLabels[filters.paymentMethod] || filters.paymentMethod);
  if (filters.orderStatus && filters.orderStatus !== 'all') parts.push(statusLabels[filters.orderStatus] || filters.orderStatus);
  if (filters.employeeId) parts.push(`Nhân viên #${filters.employeeId}`);
  if (filters.compare) parts.push('So sánh kỳ trước');
  return parts.length ? parts.join(' · ') : 'Tất cả dữ liệu';
}

function rangeFor(period) {
  const today = new Date();
  const from = new Date(today);
  if (period === '7days') from.setDate(today.getDate() - 6);
  if (period === '30days') from.setDate(today.getDate() - 29);
  if (period === '60days') from.setDate(today.getDate() - 59);
  if (period === '90days') from.setDate(today.getDate() - 89);
  return { from: dateText(from), to: dateText(today) };
}

function periodForRange(filters) {
  const match = ['today', '7days', '30days', '60days', '90days'].find((value) => {
    const range = rangeFor(value);
    return range.from === filters.from && range.to === filters.to;
  });
  return match || 'custom';
}

function initialFilters() {
  const defaults = { ...rangeFor('7days'), compare: true, categoryId: '', paymentMethod: '', orderStatus: 'all' };
  const query = new URLSearchParams(window.location.search);
  for (const key of Object.keys(defaults)) {
    if (query.has(key)) defaults[key] = key === 'compare' ? query.get(key) !== 'false' : query.get(key);
  }
  return defaults;
}

function changeTone(change, inverse = false) {
  const value = Number(change || 0) * (inverse ? -1 : 1);
  if (value > 0) return 'text-emerald-700 bg-emerald-50';
  if (value < 0) return 'text-rose-700 bg-rose-50';
  return 'text-slate-600 bg-slate-100';
}

function ChangeBadge({ value, inverse = false }) {
  const number = Number(value || 0);
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-bold ${changeTone(number, inverse)}`}>
      {number > 0 ? '+' : ''}{number.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%
    </span>
  );
}

function ScoreCircle({ value }) {
  const score = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  const [displayScore, setDisplayScore] = useState(0);
  const ringColor = score >= 75 ? '#059669' : score >= 50 ? '#0891b2' : '#e11d48';
  const radius = 43;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference * (1 - score / 100);

  useEffect(() => {
    let frameId;
    const startedAt = performance.now();
    const duration = 1400;
    const updateScore = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const easedProgress = 1 - ((1 - progress) ** 3);
      setDisplayScore(Math.round(score * easedProgress));
      if (progress < 1) frameId = requestAnimationFrame(updateScore);
    };
    frameId = requestAnimationFrame(updateScore);
    return () => cancelAnimationFrame(frameId);
  }, [score]);

  return (
    <div
      role="img"
      aria-label={`${score} trên 100 điểm đánh giá`}
      className="relative grid aspect-square h-36 w-36 shrink-0 place-items-center"
    >
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="8" />
        <circle
          className="ai-score-ring"
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={progressOffset}
          style={{ '--score-circumference': circumference, '--score-offset': progressOffset }}
        />
      </svg>
      <div className="relative z-10 grid place-content-center text-center">
        <p className="leading-none text-slate-950">
          <strong className="text-3xl font-black">{displayScore}</strong>
          <span className="text-sm font-extrabold text-slate-500">/100</span>
        </p>
        <p className="mt-2 text-[11px] font-bold text-slate-600">điểm đánh giá</p>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, children, empty = false, emptyMessage = 'Chưa đủ dữ liệu phù hợp với bộ lọc.' }) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white p-5 shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
      <div className="mb-5">
        <h2 className="text-sm font-black uppercase tracking-wide text-slate-800">{title}</h2>
        {subtitle && <p className="mt-1 text-xs font-medium text-slate-500">{subtitle}</p>}
      </div>
      {empty ? <div className="grid h-56 place-items-center text-sm font-semibold text-slate-500">{emptyMessage}</div> : children}
    </section>
  );
}

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-slate-200 ${className}`} />;
}

function StockAlertsTable({ data }) {
  const items = data?.suggestions || [];
  if (data?.unavailable) return <div className="grid min-h-32 place-items-center text-sm text-slate-500">Chưa thể tải cảnh báo nhập hàng.</div>;
  if (!items.length) return <div className="grid min-h-32 place-items-center text-sm text-slate-500">Kho đang ổn định, chưa có sản phẩm cần nhập thêm.</div>;

  const statusFor = (item) => {
    const current = Number(item.currentStock || 0);
    const minimum = Number(item.minStock || 0);
    if (current <= 0) return ['Hết hàng', 'bg-rose-50 text-rose-700'];
    if (current <= minimum) return ['Tồn thấp', 'bg-amber-50 text-amber-700'];
    return ['Theo dõi', 'bg-sky-50 text-sky-700'];
  };
  const salesRate = (value) => {
    const rate = Number(value || 0);
    if (rate <= 0) return 'Chưa phát sinh';
    if (rate < 1) return `~ 1 sp/${Math.max(1, Math.round(1 / rate))} ngày`;
    return `~ ${rate.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} sp/ngày`;
  };
  const trendFor = (item) => {
    const recentRate = Number(item.daily7 || 0);
    const baselineRate = Number(item.daily30 || 0);
    if (Number(item.sold30Days || 0) <= 0 || baselineRate <= 0) return ['Chưa rõ', Minus, 'border-slate-200 bg-slate-50 text-slate-600'];
    const change = (recentRate - baselineRate) / baselineRate;
    if (change >= 0.15) return ['Tăng', TrendingUp, 'border-emerald-200 bg-emerald-50 text-emerald-700'];
    if (change <= -0.15) return ['Giảm', TrendingDown, 'border-rose-200 bg-rose-50 text-rose-700'];
    return ['Ổn định', Minus, 'border-slate-200 bg-slate-50 text-slate-600'];
  };

  return (
    <div className="overflow-x-auto border border-slate-200">
      <table className="w-full min-w-[1040px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-extrabold">Sản phẩm</th><th className="px-4 py-3 text-center font-extrabold">Tình trạng</th><th className="px-4 py-3 text-center font-extrabold">Xu hướng</th><th className="px-4 py-3 font-extrabold">Tồn hiện tại / tối thiểu</th><th className="px-4 py-3 text-right font-extrabold">Tốc độ bán</th><th className="px-4 py-3 text-right font-extrabold">Còn đủ bán</th><th className="px-4 py-3 text-right font-extrabold">Đề xuất nhập</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => {
            const [status, tone] = statusFor(item);
            const [trend, TrendIcon, trendTone] = trendFor(item);
            const minimum = Math.max(0, Number(item.minStock || 0));
            const current = Math.max(0, Number(item.currentStock || 0));
            const stockPercent = minimum > 0 ? Math.min(100, current / minimum * 100) : current > 0 ? 100 : 0;
            return (
              <tr key={item.productId} className="hover:bg-slate-50/70">
                <td className="px-4 py-3.5"><p className="max-w-sm truncate font-bold text-slate-900" title={item.productName}>{item.productName}</p><p className="mt-0.5 text-xs text-slate-500">{item.sku || item.barcode || item.categoryName || 'Chưa có mã sản phẩm'}</p></td>
                <td className="px-4 py-3.5 text-center"><span className={`inline-flex whitespace-nowrap px-2 py-1 text-xs font-bold ${tone}`}>{status}</span></td>
                <td className="px-4 py-3.5 text-center"><span className={`inline-flex items-center gap-1 whitespace-nowrap border px-2 py-1 text-xs font-bold ${trendTone}`}><TrendIcon size={14} /> {trend}</span></td>
                <td className="px-4 py-3.5"><div className="flex items-center gap-3"><span className="w-16 shrink-0 font-extrabold text-slate-800">{current}/{minimum}</span><span className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100"><span className={`block h-full rounded-full ${current <= 0 ? 'bg-rose-500' : 'bg-amber-500'}`} style={{ width: `${stockPercent}%` }} /></span></div></td>
                <td className="px-4 py-3.5 text-right font-semibold text-slate-700">{salesRate(item.forecastDailySales)}</td>
                <td className="px-4 py-3.5 text-right font-semibold text-slate-700">{item.daysCover == null || item.priority === 'insufficient' ? 'Chưa đủ dữ liệu' : `${Math.max(0, Math.round(Number(item.daysCover)))} ngày`}</td>
                <td className="px-4 py-3.5 text-right text-base font-black text-cyan-700">{Math.max(0, Math.round(Number(item.suggestedQuantity || 0))).toLocaleString('vi-VN')} sp</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FilterSelect({ label, value, onChange, children }) {
  return (
    <label className="min-w-0">
      <span className="mb-1 block text-xs font-bold text-slate-600">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full border border-slate-300 bg-white px-2 text-sm outline-none focus:border-cyan-600">
        {children}
      </select>
    </label>
  );
}

function ReportFilterMenu({ period, draft, options, onChoosePeriod, onChange, onApply, onReset }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const closeMenu = (event) => {
      if (event.key === 'Escape' || !containerRef.current?.contains(event.target)) setIsOpen(false);
    };

    document.addEventListener('mousedown', closeMenu);
    document.addEventListener('keydown', closeMenu);
    return () => {
      document.removeEventListener('mousedown', closeMenu);
      document.removeEventListener('keydown', closeMenu);
    };
  }, [isOpen]);

  const periods = [['today', 'Hôm nay'], ['7days', '7 ngày'], ['30days', '30 ngày'], ['60days', '60 ngày'], ['90days', '90 ngày']];
  return (
    <div ref={containerRef} className="relative w-fit">
      <button type="button" aria-label="Mở bộ lọc báo cáo" title="Bộ lọc" aria-haspopup="dialog" aria-expanded={isOpen} onClick={() => setIsOpen((value) => !value)} className={`grid h-10 w-10 shrink-0 place-items-center border transition-colors ${isOpen ? 'border-cyan-700 bg-cyan-50 text-cyan-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
        <SlidersHorizontal size={18} />
      </button>

      {isOpen && (
        <div role="dialog" aria-label="Bộ lọc báo cáo" className="absolute left-0 top-full z-30 mt-2 max-h-[calc(100vh-10rem)] w-[min(44rem,calc(100vw-3rem))] overflow-y-auto border border-slate-200 bg-white p-4 shadow-xl">
          <div className="mb-4">
            <p className="text-sm font-extrabold text-slate-900">Bộ lọc báo cáo</p>
            <p className="mt-0.5 text-xs text-slate-500">Dữ liệu chỉ cập nhật sau khi bấm Áp dụng.</p>
          </div>

          <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">Khoảng thời gian</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {periods.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onChoosePeriod(value)}
                className={`h-9 border px-3 text-sm font-bold ${period === value ? 'border-cyan-700 bg-cyan-50 text-cyan-800' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label><span className="mb-1 block text-xs font-bold text-slate-600">Từ ngày</span><input type="date" value={draft.from} onChange={(event) => onChange({ period: 'custom', from: event.target.value })} className="h-10 w-full border border-slate-300 px-2 text-sm outline-none focus:border-cyan-600" /></label>
            <label><span className="mb-1 block text-xs font-bold text-slate-600">Đến ngày</span><input type="date" value={draft.to} onChange={(event) => onChange({ period: 'custom', to: event.target.value })} className="h-10 w-full border border-slate-300 px-2 text-sm outline-none focus:border-cyan-600" /></label>
          </div>

          <div className="my-4 border-t border-slate-200" />
          <div className="grid gap-3 sm:grid-cols-3">
            <FilterSelect label="Danh mục" value={draft.categoryId} onChange={(value) => onChange({ categoryId: value })}><option value="">Tất cả danh mục</option>{(options.categories || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</FilterSelect>
            <FilterSelect label="Thanh toán" value={draft.paymentMethod} onChange={(value) => onChange({ paymentMethod: value })}><option value="">Tất cả phương thức</option>{(options.paymentMethods || []).map((item) => <option key={item} value={item}>{paymentLabels[item] || item}</option>)}</FilterSelect>
            <FilterSelect label="Trạng thái" value={draft.orderStatus} onChange={(value) => onChange({ orderStatus: value })}>{['all', ...(options.orderStatuses || [])].map((item) => <option key={item} value={item}>{statusLabels[item] || item}</option>)}</FilterSelect>
          </div>
          <label className="mt-3 flex h-10 items-center gap-2 border border-slate-300 px-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={draft.compare} onChange={(event) => onChange({ compare: event.target.checked })} /> So sánh kỳ trước</label>

          <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
            <button type="button" onClick={onReset} className="inline-flex h-10 items-center gap-2 border border-slate-300 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"><RotateCcw size={16} /> Đặt lại</button>
            <button type="button" onClick={() => { if (onApply() !== false) setIsOpen(false); }} className="h-10 bg-cyan-700 px-5 text-sm font-extrabold text-white hover:bg-cyan-800">Áp dụng</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AiHistoryModal({
  isOpen,
  onClose,
  data,
  isLoading,
  error,
  categories,
  onPageChange,
  onView,
  onDelete,
  viewingId
}) {
  const items = data?.items || [];
  const pagination = data?.pagination || { page: 1, limit: 5, total: 0 };
  const outlook = {
    positive: { label: 'Tích cực', tone: 'bg-emerald-50 text-emerald-700' },
    neutral: { label: 'Ổn định', tone: 'bg-cyan-50 text-cyan-700' },
    negative: { label: 'Cần chú ý', tone: 'bg-rose-50 text-rose-700' }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Lịch sử phân tích AI"
      maxWidth="max-w-6xl"
      headerActions={(
        <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Đóng lịch sử">
          <X size={19} />
        </button>
      )}
    >
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-500">Mỗi lần phân tích thành công được lưu trực tiếp vào cơ sở dữ liệu để xem lại khi cần.</p>
          <span className="bg-cyan-50 px-3 py-1.5 text-xs font-extrabold text-cyan-800">
            {Number(pagination.total || 0).toLocaleString('vi-VN')} kết quả đã lưu
          </span>
        </div>

        <div className="overflow-hidden border border-slate-200 bg-white">
          <div className="min-h-[430px] overflow-x-auto">
            <table className="w-full min-w-[980px] table-fixed text-left">
              <thead className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-[150px] px-4 py-3">Thời gian</th>
                  <th className="w-[150px] px-4 py-3">Kỳ dữ liệu</th>
                  <th className="w-[150px] px-4 py-3">Người thực hiện</th>
                  <th className="w-[190px] px-4 py-3">Bộ lọc</th>
                  <th className="w-[110px] px-4 py-3 text-center">Đánh giá</th>
                  <th className="px-4 py-3">Nhận định</th>
                  <th className="w-[108px] px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading && Array.from({ length: 5 }, (_, index) => (
                  <tr key={index} className="h-[76px]">
                    {Array.from({ length: 7 }, (__, cellIndex) => (
                      <td key={cellIndex} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))}
                {!isLoading && !error && items.map((item) => {
                  const outlookMeta = outlook[item.outlook] || outlook.neutral;
                  return (
                    <tr key={item.id} className="h-[76px] align-middle hover:bg-slate-50/70">
                      <td className="px-4 py-3 text-xs font-bold text-slate-700">
                        <div className="flex items-center gap-2"><CalendarDays className="shrink-0 text-slate-400" size={15} />{displayDateTime(item.analyzedAt)}</div>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-600">
                        {displayDate(item.periodFrom)}<span className="mx-1 text-slate-400">–</span>{displayDate(item.periodTo)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500"><UserRound size={15} /></span>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-extrabold text-slate-800">{item.requestedBy?.name || 'Tài khoản đã xóa'}</p>
                            <p className="mt-0.5 text-[11px] text-slate-500">{item.requestedBy?.employeeCode || 'Không còn mã NV'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold leading-5 text-slate-600">
                        <p className="line-clamp-2" title={analysisFilterText(item.filters, categories)}>{analysisFilterText(item.filters, categories)}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <p className="text-lg font-black text-slate-900">{item.healthScore}<span className="text-xs text-slate-400">/100</span></p>
                        <span className={`mt-1 inline-flex px-2 py-0.5 text-[10px] font-extrabold ${outlookMeta.tone}`}>{outlookMeta.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="line-clamp-2 text-xs font-medium leading-5 text-slate-600" title={item.executiveSummary}>{item.executiveSummary}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button type="button" onClick={() => onView(item)} disabled={viewingId === item.id} className="grid h-9 w-9 place-items-center border border-cyan-200 text-cyan-700 hover:bg-cyan-50 disabled:cursor-wait disabled:opacity-60" title="Xem lại kết quả">
                            {viewingId === item.id ? <LoaderCircle className="animate-spin" size={16} /> : <Eye size={16} />}
                          </button>
                          <button type="button" onClick={() => onDelete(item)} className="grid h-9 w-9 place-items-center border border-rose-200 text-rose-600 hover:bg-rose-50" title="Xóa lịch sử">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {!isLoading && error && (
              <div className="grid min-h-[360px] place-items-center px-5 text-center text-sm font-semibold text-rose-700">{error}</div>
            )}
            {!isLoading && !error && !items.length && (
              <div className="grid min-h-[360px] place-items-center px-5 text-center">
                <div>
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-500"><History size={22} /></span>
                  <p className="mt-3 text-sm font-extrabold text-slate-800">Chưa có lịch sử phân tích</p>
                  <p className="mt-1 text-xs text-slate-500">Kết quả sẽ xuất hiện tại đây sau khi AI phân tích thành công.</p>
                </div>
              </div>
            )}
          </div>

          <TablePagination
            currentPage={pagination.page || 1}
            totalItems={pagination.total || 0}
            pageSize={pagination.limit || 5}
            onPageChange={onPageChange}
            itemLabel="kết quả"
            ariaLabel="Phân trang lịch sử phân tích AI"
          />
        </div>
      </div>
    </Modal>
  );
}

const findingStyles = {
  positive: {
    label: 'Tích cực',
    border: 'border-emerald-400',
    accent: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-800',
    surface: 'bg-emerald-50/70'
  },
  info: {
    label: 'Thông tin',
    border: 'border-cyan-400',
    accent: 'bg-cyan-500',
    badge: 'bg-cyan-100 text-cyan-800',
    surface: 'bg-cyan-50/70'
  },
  warning: {
    label: 'Cần chú ý',
    border: 'border-amber-400',
    accent: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-900',
    surface: 'bg-amber-50/70'
  },
  critical: {
    label: 'Quan trọng',
    border: 'border-rose-400',
    accent: 'bg-rose-500',
    badge: 'bg-rose-100 text-rose-800',
    surface: 'bg-rose-50/70'
  }
};

const actionStyles = {
  high: {
    label: 'Ưu tiên cao',
    border: 'border-rose-300',
    accent: 'bg-rose-500',
    badge: 'bg-rose-100 text-rose-800'
  },
  medium: {
    label: 'Ưu tiên trung bình',
    border: 'border-amber-300',
    accent: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-900'
  },
  low: {
    label: 'Ưu tiên thấp',
    border: 'border-emerald-300',
    accent: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-800'
  }
};

function FindingCard({ item, index }) {
  const style = findingStyles[item.severity] || findingStyles.info;

  return (
    <article className={`relative overflow-hidden border bg-white ${style.border}`}>
      <div className={`absolute inset-y-0 left-0 w-1.5 ${style.accent}`} />

      <div className="p-5 pl-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center bg-slate-900 text-xs font-black text-white">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
                Vấn đề phân tích
              </p>
              <h4 className="mt-1 text-base font-extrabold text-slate-950">
                {item.title}
              </h4>
            </div>
          </div>

          <span className={`px-2.5 py-1 text-[11px] font-extrabold ${style.badge}`}>
            {style.label}
          </span>
        </div>

        <div className={`mt-4 p-3 ${style.surface}`}>
          <p className="text-sm font-medium leading-6 text-slate-800">
            {item.insight}
          </p>
        </div>

        {item.impact && (
          <div className="mt-4 grid grid-cols-[24px_1fr] gap-3 border-t border-slate-200 pt-4">
            <AlertTriangle size={20} className="mt-0.5 text-rose-600" />
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-rose-700">
                Tác động đến cửa hàng
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-700">
                {item.impact}
              </p>
            </div>
          </div>
        )}

        {item.evidence?.length > 0 && (
          <div className="mt-4 border-t border-slate-200 pt-4">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
              Số liệu cần ghi nhớ
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {item.evidence.map((entry, evidenceIndex) => (
                <div
                  key={evidenceIndex}
                  className="flex items-start gap-2 border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold leading-5 text-slate-700"
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 ${style.accent}`} />
                  <span>{entry}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

function ActionCard({ action, index }) {
  const style = actionStyles[action.priority] || actionStyles.medium;

  return (
    <article className={`overflow-hidden border bg-white ${style.border}`}>
      <div className={`h-1.5 w-full ${style.accent}`} />

      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center border-2 border-slate-900 text-sm font-black text-slate-900">
              {index + 1}
            </span>
            <h4 className="text-base font-extrabold text-slate-950">
              {action.title}
            </h4>
          </div>

          <span className={`px-2.5 py-1 text-[11px] font-extrabold ${style.badge}`}>
            {style.label}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-[24px_1fr] gap-3 bg-slate-50 p-3">
          <Lightbulb size={20} className="mt-0.5 text-amber-600" />
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
              Vì sao cần thực hiện
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-700">
              {action.reason}
            </p>
          </div>
        </div>

        {action.steps?.length > 0 && (
          <div className="mt-4">
            <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-600">
              <Target size={16} className="text-cyan-700" />
              Việc cần làm
            </p>
            <ol className="mt-3 space-y-2">
              {action.steps.map((step, stepIndex) => (
                <li
                  key={stepIndex}
                  className="grid grid-cols-[28px_1fr] items-start gap-3 border border-cyan-100 bg-cyan-50/60 p-3"
                >
                  <span className="grid h-7 w-7 place-items-center bg-cyan-700 text-xs font-black text-white">
                    {stepIndex + 1}
                  </span>
                  <span className="pt-0.5 text-sm font-semibold leading-6 text-slate-800">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {action.expectedImpact && (
          <div className="mt-4 grid grid-cols-[24px_1fr] gap-3 border border-emerald-200 bg-emerald-50 p-3">
            <CheckCircle2 size={20} className="mt-0.5 text-emerald-700" />
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-emerald-800">
                Kết quả mong đợi
              </p>
              <p className="mt-1 text-sm font-semibold leading-6 text-emerald-950">
                {action.expectedImpact}
              </p>
            </div>
          </div>
        )}

        {action.evidence && (
          <div className="mt-3 flex items-start gap-2 border-t border-slate-200 pt-3 text-xs leading-5 text-slate-500">
            <ArrowRight size={15} className="mt-0.5 shrink-0" />
            <span>
              <strong className="text-slate-700">Căn cứ dữ liệu:</strong> {action.evidence}
            </span>
          </div>
        )}
      </div>
    </article>
  );
}

function AiPanel({ data, isLoading, error, historyEntry }) {
  if (!data && !isLoading && !error) return null;
  return (
    <section id="ai-analysis-panel" className="border border-slate-200 bg-white p-4 shadow-sm">
      {error && <div className="border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</div>}
      {isLoading && (
        <div className="grid min-h-72 place-items-center">
          <div className="flex flex-col items-center text-center">
            <LoaderCircle className="animate-spin text-cyan-700" size={44} strokeWidth={2.2} />
            <p className="mt-4 text-sm font-extrabold text-slate-700">Đang phân tích dữ liệu kho</p>
          </div>
        </div>
      )}
      {data && !isLoading && <div className="space-y-5">
        {historyEntry && (
          <div className="flex flex-wrap items-center justify-between gap-2 border border-cyan-200 bg-cyan-50 px-4 py-3 text-xs font-semibold text-cyan-900">
            <span>Đang xem kết quả đã lưu lúc {displayDateTime(historyEntry.analyzedAt)}</span>
            <span>Kỳ dữ liệu: {displayDate(historyEntry.periodFrom)} – {displayDate(historyEntry.periodTo)}</span>
          </div>
        )}
        <div className="grid items-center gap-5 lg:grid-cols-[170px_1fr]">
          <div className="grid place-items-center"><ScoreCircle value={data.healthScore} /></div>
          <div className="border border-slate-200 p-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Nhận định theo bộ lọc</p><p className="mt-3 text-sm leading-7 text-slate-800">{data.executiveSummary}</p></div>
        </div>
        {(data.charts || []).length > 0 && <div><h3 className="mb-3 text-base font-extrabold text-slate-900">Biểu đồ phân tích</h3><div className="grid gap-4 lg:grid-cols-2">{data.charts.map((chart, index) => <article key={chart.id || index} className={`ai-chart-reveal border border-slate-200 p-4 ${index === 0 ? 'lg:col-span-2' : ''}`} style={{ '--ai-chart-delay': `${index * 160}ms` }}><h4 className="text-sm font-extrabold uppercase tracking-wide text-slate-800">{chart.title}</h4><div className="mt-3 h-64"><StableAiReportChart spec={chart} revealIndex={index} /></div></article>)}</div></div>}
        {(data.findings || []).length > 0 && (
          <div>
            <div className="mb-3 flex items-center gap-3">
              <span className="h-6 w-1.5 bg-cyan-600" />
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Phân tích chi tiết
                </h3>
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  Vấn đề, tác động và số liệu quan trọng cần nắm bắt
                </p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {data.findings.map((item, index) => (
                <FindingCard
                  key={`${item.title}-${index}`}
                  item={item}
                  index={index}
                />
              ))}
            </div>
          </div>
        )}

        {(data.actions || []).length > 0 && (
          <div>
            <div className="mb-3 flex items-center gap-3">
              <span className="h-6 w-1.5 bg-emerald-600" />
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Hành động đề xuất
                </h3>
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  Danh sách công việc theo thứ tự ưu tiên và kết quả mong đợi
                </p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {data.actions.map((action, actionIndex) => (
                <ActionCard
                  key={`${action.title}-${actionIndex}`}
                  action={action}
                  index={actionIndex}
                />
              ))}
            </div>
          </div>
        )}
      </div>}
    </section>
  );
}

export default function Reports() {
  const location = useLocation();
  const chartVisitKey = location.key || 'reports';
  const startingFilters = useMemo(initialFilters, []);
  const [filters, setFilters] = useState(startingFilters);
  const [draft, setDraft] = useState(startingFilters);
  const [period, setPeriod] = useState(() => periodForRange(startingFilters));
  const [aiVisible, setAiVisible] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiHistoryOpen, setAiHistoryOpen] = useState(false);
  const [aiHistory, setAiHistory] = useState({ items: [], pagination: { page: 1, limit: 5, total: 0, totalPages: 1 } });
  const [aiHistoryPage, setAiHistoryPage] = useState(1);
  const [aiHistoryLoading, setAiHistoryLoading] = useState(false);
  const [aiHistoryError, setAiHistoryError] = useState('');
  const [aiHistoryRefreshKey, setAiHistoryRefreshKey] = useState(0);
  const [aiHistoryViewingId, setAiHistoryViewingId] = useState(null);
  const [aiHistoryEntry, setAiHistoryEntry] = useState(null);
  const [aiHistoryDeleteTarget, setAiHistoryDeleteTarget] = useState(null);
  const [aiHistoryDeletingId, setAiHistoryDeletingId] = useState(null);
  const [excelExporting, setExcelExporting] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value !== '') query.set(key, String(value)); });
    window.history.replaceState(null, '', `${window.location.pathname}?${query.toString()}`);
    let active = true;
    setLoading(true);
    setAiAnalysis(null);
    setAiError('');
    setAiHistoryEntry(null);
    loadRevenueDashboard(filters)
      .then((data) => { if (active) { setDashboard(data); setError(''); } })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Không thể tải báo cáo doanh thu.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters]);

  useEffect(() => {
    if (!aiHistoryOpen) return undefined;
    let active = true;
    setAiHistoryLoading(true);
    setAiHistoryError('');
    loadAiRevenueAnalysisHistory({ page: aiHistoryPage, limit: 5 })
      .then((data) => { if (active) setAiHistory(data); })
      .catch((requestError) => {
        if (active) setAiHistoryError(requestError.response?.data?.message || 'Không thể tải lịch sử phân tích AI.');
      })
      .finally(() => { if (active) setAiHistoryLoading(false); });
    return () => { active = false; };
  }, [aiHistoryOpen, aiHistoryPage, aiHistoryRefreshKey]);

  const applyFilters = () => {
    if (!draft.from || !draft.to || draft.from > draft.to) {
      toast.error('Khoảng ngày không hợp lệ');
      return false;
    }
    setFilters({ ...draft });
    return true;
  };

  const choosePeriod = (value) => {
    setPeriod(value);
    setDraft((current) => ({ ...current, ...rangeFor(value) }));
  };

  const resetFilters = () => {
    const next = { ...rangeFor('7days'), compare: true, categoryId: '', paymentMethod: '', orderStatus: 'all' };
    setPeriod('7days');
    setDraft(next);
  };

  const exportCsv = async () => {
    try {
      const response = await exportRevenueReport(filters);
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url; link.download = `bao-cao-doanh-thu-${filters.from}-${filters.to}.csv`;
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      toast.success('Đã xuất báo cáo CSV');
    } catch (requestError) { toast.error(requestError.response?.data?.message || 'Không thể xuất báo cáo'); }
  };

  const exportExcel = async () => {
    try {
      setExcelExporting(true);
      const response = await exportRevenueExcelReport(filters);
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bao-cao-tong-quan-${filters.from}-${filters.to}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Đã xuất báo cáo Excel');
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Không thể xuất báo cáo Excel');
    } finally {
      setExcelExporting(false);
    }
  };

  const analyzeWithAi = async () => {
    const startedAt = Date.now();
    const waitForMinimumLoadingTime = async () => {
      const remaining = 5000 - (Date.now() - startedAt);
      if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
    };
    try {
      setAiLoading(true); setAiError('');
      const analysis = await runAiRevenueAnalysis({ ...filters });
      await waitForMinimumLoadingTime();
      setAiAnalysis(analysis);
      setAiHistoryEntry(null);
      setAiHistoryRefreshKey((value) => value + 1);
    } catch (requestError) {
      await waitForMinimumLoadingTime();
      setAiAnalysis(null);
      const message = requestError.code === 'ECONNABORTED'
        ? 'Gemini phản hồi quá thời gian. Báo cáo MySQL vẫn sử dụng bình thường.'
        : !requestError.response
          ? 'Không kết nối được backend. Hãy kiểm tra máy chủ rồi thử lại.'
          : requestError.response.data?.message || 'Gemini chưa thể phân tích POS lúc này.';
      setAiError(message);
    } finally { setAiLoading(false); }
  };

  const showAiAnalysis = () => {
    setAiVisible(true);
    analyzeWithAi();
  };

  const showAiHistory = () => {
    setAiHistoryOpen(true);
    if (aiHistoryPage !== 1) setAiHistoryPage(1);
    else setAiHistoryRefreshKey((value) => value + 1);
  };

  const viewAiHistoryItem = async (item) => {
    try {
      setAiHistoryViewingId(item.id);
      const detail = await loadAiRevenueAnalysisHistoryItem(item.id);
      if (!detail.result) throw new Error('Kết quả phân tích đã lưu không hợp lệ');
      setAiAnalysis(detail.result);
      setAiHistoryEntry(detail);
      setAiError('');
      setAiVisible(true);
      setAiHistoryOpen(false);
      window.setTimeout(() => document.getElementById('ai-analysis-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || requestError.message || 'Không thể mở kết quả phân tích AI');
    } finally {
      setAiHistoryViewingId(null);
    }
  };

  const deleteAiHistoryItem = async () => {
    if (!aiHistoryDeleteTarget) return;
    try {
      setAiHistoryDeletingId(aiHistoryDeleteTarget.id);
      const response = await deleteAiRevenueAnalysisHistoryItem(aiHistoryDeleteTarget.id);
      const shouldGoBack = aiHistory.items.length === 1 && aiHistoryPage > 1;
      setAiHistoryDeleteTarget(null);
      if (aiHistoryEntry?.id === aiHistoryDeleteTarget.id) {
        setAiHistoryEntry(null);
        setAiAnalysis(null);
        setAiVisible(false);
      }
      if (shouldGoBack) setAiHistoryPage((page) => page - 1);
      else setAiHistoryRefreshKey((value) => value + 1);
      toast.success(response.message || 'Đã xóa lịch sử phân tích AI');
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Không thể xóa lịch sử phân tích AI');
    } finally {
      setAiHistoryDeletingId(null);
    }
  };

  const metrics = dashboard?.summary?.metrics || {};
  const options = dashboard?.summary?.filterOptions || {};
  const categoryItems = useMemo(() => {
    const items = dashboard?.categories?.items || [];
    const leading = items.slice(0, 4);
    const remaining = items.slice(4);
    const visible = remaining.length > 0
      ? [...leading, {
        name: 'Khác',
        netRevenue: remaining.reduce((sum, item) => sum + Number(item.netRevenue || 0), 0),
        soldQuantity: remaining.reduce((sum, item) => sum + Number(item.soldQuantity || 0), 0)
      }]
      : leading;
    const total = visible.reduce((sum, item) => sum + Number(item.netRevenue || 0), 0);
    return visible.map((item) => ({ ...item, percentage: total > 0 ? Number((Number(item.netRevenue || 0) / total * 100).toFixed(1)) : 0 }));
  }, [dashboard?.categories?.items]);
  const hasTrendData = (dashboard?.trend?.points || []).some((item) => item.netRevenue || item.grossProfit);
  const dataAvailability = dashboard?.summary?.dataAvailability || {};
  const selectedDays = Math.round((new Date(`${filters.to}T00:00:00`) - new Date(`${filters.from}T00:00:00`)) / 86400000) + 1;
  const hasReportData = Number(metrics.completedOrders || 0) > 0 || hasTrendData;
  const hasIncompleteHistory = Boolean(dataAvailability.availableFrom && dataAvailability.availableFrom > filters.from);
  const insufficientDataMessage = !hasReportData
    ? 'Chưa đủ dữ liệu cho bộ lọc đã chọn.'
    : hasIncompleteHistory
      ? `Chưa đủ dữ liệu cho toàn bộ ${selectedDays.toLocaleString('vi-VN')} ngày đã chọn. Hệ thống hiện có dữ liệu từ ${displayDate(dataAvailability.availableFrom)}; phần dữ liệu hiện có vẫn được hiển thị bên dưới.`
      : '';
  const trendUnit = { hour: 'GIỜ', day: 'NGÀY', week: 'TUẦN', month: 'THÁNG' }[dashboard?.trend?.grouping] || 'NGÀY';
  const missingCostDetail = `Còn ${Number(metrics.missingCostProductCount || 0).toLocaleString('vi-VN')} sản phẩm đã bán trong kỳ thiếu giá vốn`;
  const kpis = [
    { label: 'Doanh thu thuần', value: metrics.netRevenue, change: metrics.changes?.netRevenue, tooltip: 'Doanh thu gộp - giảm giá - hoàn trả; không gồm VAT.', currency: true, icon: CircleDollarSign, iconTone: 'bg-blue-50 text-blue-700' },
    { label: 'Giá vốn hàng bán', value: metrics.cost, change: metrics.changes?.cost, tooltip: 'Tổng số lượng thực bán nhân giá vốn snapshot của từng dòng hóa đơn hoàn thành.', currency: true, unavailable: !metrics.costDataComplete, icon: Calculator, iconTone: 'bg-rose-50 text-rose-700', detail: metrics.costDataComplete ? `Tỷ lệ giá vốn: ${Number(metrics.costRatio || 0).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%` : missingCostDetail },
    { label: 'Lợi nhuận gộp', value: metrics.grossProfit, change: metrics.changes?.grossProfit, tooltip: 'Doanh thu thuần - giá vốn hàng bán.', currency: true, unavailable: !metrics.costDataComplete, icon: TrendingUp, iconTone: 'bg-emerald-50 text-emerald-700', detail: metrics.costDataComplete ? `Biên lợi nhuận: ${Number(metrics.grossMargin || 0).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%` : missingCostDetail },
    { label: 'Đơn hoàn thành', value: metrics.completedOrders, change: metrics.changes?.completedOrders, tooltip: 'Số hóa đơn hoàn thành trong khoảng thời gian đã chọn.', suffix: ' đơn', icon: ReceiptText, iconTone: 'bg-amber-50 text-amber-700', detail: `Giá trị TB/đơn: ${formatCurrency(metrics.averageOrderValue)}` }
  ];

  return (
    <div className="space-y-5 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-950">Tổng quan kinh doanh</h1>
          <p className="mt-1 text-sm text-slate-500">Theo dõi doanh thu, lợi nhuận, xu hướng bán hàng và tình trạng tồn kho trong cùng một màn hình.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={exportExcel} disabled={excelExporting} className="inline-flex h-10 items-center gap-2 border border-emerald-600 bg-white px-4 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-60" title="Xuất báo cáo Excel nhiều sheet theo bộ lọc đang áp dụng">
            {excelExporting ? <LoaderCircle className="animate-spin" size={17} /> : <FileSpreadsheet size={17} />}
            {excelExporting ? 'Đang xuất...' : 'Xuất Excel'}
          </button>
          <button type="button" onClick={exportCsv} className="inline-flex h-10 items-center gap-2 border border-cyan-700 bg-white px-4 text-sm font-bold text-cyan-800 hover:bg-cyan-50" title="Xuất dữ liệu theo bộ lọc đang áp dụng"><Download size={17} /> Xuất CSV</button>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ReportFilterMenu period={period} draft={draft} options={options} onChoosePeriod={choosePeriod} onChange={({ period: nextPeriod, ...changes }) => { if (nextPeriod) setPeriod(nextPeriod); setDraft((current) => ({ ...current, ...changes })); }} onApply={applyFilters} onReset={resetFilters} />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={showAiHistory} className="inline-flex h-11 items-center justify-center gap-2 border border-slate-300 bg-white px-4 text-sm font-extrabold text-slate-700 hover:border-cyan-600 hover:bg-cyan-50 hover:text-cyan-800">
            <History size={18} /> Lịch sử phân tích
          </button>
          <button type="button" onClick={showAiAnalysis} disabled={aiLoading} className="inline-flex h-11 items-center justify-center gap-2 bg-[#74B8E0] px-5 text-sm font-extrabold text-white hover:bg-[#5FA9D4] disabled:cursor-wait disabled:opacity-60">
            {aiLoading ? <LoaderCircle className="animate-spin" size={18} /> : <BrainCircuit size={18} />}
            {aiLoading ? 'Đang phân tích dữ liệu...' : aiAnalysis ? 'Phân tích lại' : 'Phân tích AI'}
          </button>
        </div>
      </div>

      {error && <div className="border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
      {!loading && !error && insufficientDataMessage && (
        <div className="border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
          {insufficientDataMessage}
        </div>
      )}

      {aiVisible && <AiPanel data={aiAnalysis} isLoading={aiLoading} error={aiError} historyEntry={aiHistoryEntry} />}

      <AiHistoryModal
        isOpen={aiHistoryOpen}
        onClose={() => setAiHistoryOpen(false)}
        data={aiHistory}
        isLoading={aiHistoryLoading}
        error={aiHistoryError}
        categories={options.categories || []}
        onPageChange={setAiHistoryPage}
        onView={viewAiHistoryItem}
        onDelete={setAiHistoryDeleteTarget}
        viewingId={aiHistoryViewingId}
      />

      <Modal
        isOpen={Boolean(aiHistoryDeleteTarget)}
        onClose={() => { if (!aiHistoryDeletingId) setAiHistoryDeleteTarget(null); }}
        title="Xóa lịch sử phân tích?"
        maxWidth="max-w-md"
      >
        <p className="text-sm leading-6 text-slate-600">Kết quả phân tích này sẽ bị xóa khỏi cơ sở dữ liệu và không thể khôi phục.</p>
        {aiHistoryDeleteTarget && (
          <div className="mt-4 border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-extrabold text-slate-800">{displayDate(aiHistoryDeleteTarget.periodFrom)} – {displayDate(aiHistoryDeleteTarget.periodTo)}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{aiHistoryDeleteTarget.executiveSummary}</p>
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setAiHistoryDeleteTarget(null)} disabled={Boolean(aiHistoryDeletingId)} className="h-10 border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Giữ lại</button>
          <button type="button" onClick={deleteAiHistoryItem} disabled={Boolean(aiHistoryDeletingId)} className="inline-flex h-10 items-center gap-2 bg-rose-600 px-4 text-sm font-extrabold text-white hover:bg-rose-700 disabled:cursor-wait disabled:opacity-60">
            {aiHistoryDeletingId ? <LoaderCircle className="animate-spin" size={16} /> : <Trash2 size={16} />}
            {aiHistoryDeletingId ? 'Đang xóa...' : 'Xóa lịch sử'}
          </button>
        </div>
      </Modal>

      {loading ? (
        <PageLoading message="Đang tải dữ liệu trang" />
      ) : (
      <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-32" />) : kpis.map(({ label, value, change, tooltip, currency, suffix = '', unavailable = false, icon: Icon, iconTone, detail }) => (
          <article key={label} className="border border-slate-200 bg-white p-4 shadow-sm" title={tooltip}>
            <div className="flex items-start justify-between gap-2"><p className="pt-1 text-xs font-extrabold uppercase tracking-wide text-slate-500">{label}</p><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${iconTone}`}><Icon size={18} strokeWidth={1.8} /></span></div>
            <p className="mt-3 truncate text-2xl font-black text-slate-950">{unavailable ? 'Chưa đủ giá vốn' : currency ? formatCurrency(value) : `${Number(value || 0).toLocaleString('vi-VN')}${suffix}`}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              {filters.compare && !unavailable && <><ChangeBadge value={change} /><span className="text-[11px] text-slate-500">kỳ trước</span></>}
              {detail && <span className="text-[11px] font-semibold text-slate-600">{filters.compare ? '· ' : ''}{detail}</span>}
            </div>
          </article>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        {loading ? <Skeleton className="h-80" /> : (
          <Panel title="CƠ CẤU DOANH THU THEO DANH MỤC" empty={!categoryItems.length}>
            <div className="h-64"><StableCategoryRevenueChart key={`category-${chartVisitKey}`} items={categoryItems} /></div>
          </Panel>
        )}
        {loading ? <Skeleton className="h-80" /> : (
          <Panel title={`BIẾN ĐỘNG DOANH THU THEO ${trendUnit}`} empty={!hasTrendData}>
            <div className="h-64"><StableDailyRevenueChart key={`revenue-${chartVisitKey}`} trend={dashboard?.trend} /></div>
          </Panel>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {loading ? <Skeleton className="h-80" /> : (
          <Panel title={`LỢI NHUẬN GỘP THEO ${trendUnit}`} empty={!hasTrendData}>
            <div className="h-64"><StableGrossProfitChart key={`profit-${chartVisitKey}`} trend={dashboard?.trend} /></div>
          </Panel>
        )}
        {loading ? <Skeleton className="h-80" /> : (
          <Panel title="TOP 5 SẢN PHẨM THEO DOANH THU" empty={!dashboard?.topProducts?.items?.length}>
            <div className="h-64"><StableTopProductsChart key={`products-${chartVisitKey}`} items={dashboard?.topProducts?.items} /></div>
          </Panel>
        )}
        {loading ? <Skeleton className="h-80" /> : (
          <Panel title="CƠ CẤU PHƯƠNG THỨC THANH TOÁN" empty={!dashboard?.payments?.items?.length}>
            <div className="h-64"><StablePaymentChart key={`payments-${chartVisitKey}`} items={dashboard?.payments?.items} labels={paymentLabels} /></div>
          </Panel>
        )}
      </div>

      {loading ? <Skeleton className="h-72" /> : (
        <Panel title="CẢNH BÁO NHẬP HÀNG">
          <StockAlertsTable data={dashboard?.stockAlerts} />
        </Panel>
      )}

      </div>
      )}
    </div>
  );
}
