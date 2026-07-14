import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { BrainCircuit, ChevronLeft, ChevronRight, Download, Info, RotateCcw, Search, Sparkles } from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { exportRevenueReport, loadRevenueDashboard, loadRevenueProducts, runAiRevenueAnalysis } from '../services/revenueReportService';
import { AiReportChart, HourlyChart, PaymentChart, TrendChart } from '../components/reports/RevenueCharts';

const paymentLabels = { cash: 'Tiền mặt', card: 'Thẻ', transfer: 'Chuyển khoản', e_wallet: 'Ví điện tử', other: 'Khác' };
const statusLabels = { all: 'Tất cả trạng thái', completed: 'Hoàn thành', cancelled: 'Đã hủy' };

function dateText(date) {
  const year = date.getFullYear();
  return `${year}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function rangeFor(period) {
  const today = new Date();
  const from = new Date(today);
  if (period === '7days') from.setDate(today.getDate() - 6);
  if (period === '30days') from.setDate(today.getDate() - 29);
  if (period === 'month') from.setDate(1);
  return { from: dateText(from), to: dateText(today) };
}

function initialFilters() {
  const defaults = { ...rangeFor('7days'), compare: true, categoryId: '', employeeId: '', paymentMethod: '', orderStatus: 'all' };
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
      {number > 0 ? '+' : ''}{number.toLocaleString('vi-VN')}%
    </span>
  );
}

function Panel({ title, subtitle, children, empty = false }) {
  return (
    <section className="border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-extrabold text-slate-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {empty ? <div className="grid h-56 place-items-center text-sm text-slate-500">Không có dữ liệu phù hợp với bộ lọc.</div> : children}
    </section>
  );
}

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-slate-200 ${className}`} />;
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

function AiPanel({ data, isLoading, error, onAnalyze }) {
  const priority = { high: 'Cao', medium: 'Trung bình', low: 'Thấp' };
  const findingTone = { positive: 'border-emerald-300 bg-emerald-50', info: 'border-cyan-300 bg-cyan-50', warning: 'border-amber-300 bg-amber-50', critical: 'border-rose-300 bg-rose-50' };
  return (
    <section className="border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><BrainCircuit size={21} className="text-cyan-700" /> Gemini phân tích POS</h2><p className="mt-1 text-xs text-slate-500">Gemini 3.1 Flash-Lite phân tích dữ liệu của báo cáo MySQL đang hiển thị; không ảnh hưởng việc xem KPI và biểu đồ.</p></div>
        <button type="button" onClick={onAnalyze} disabled={isLoading} className="flex h-11 shrink-0 items-center justify-center gap-2 bg-cyan-700 px-4 text-sm font-extrabold text-white hover:bg-cyan-800 disabled:cursor-wait disabled:opacity-60"><Sparkles size={17} /> {isLoading ? 'AI đang phân tích...' : data ? 'Phân tích lại' : 'Tạo báo cáo AI'}</button>
      </div>
      {error && <div className="mt-4 border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</div>}
      {isLoading && <div className="mt-5 grid gap-3 sm:grid-cols-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>}
      {!data && !isLoading && <div className="mt-5 grid min-h-28 place-items-center border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm text-slate-600">Báo cáo MySQL đã sẵn sàng. Bấm “Tạo báo cáo AI” nếu cần thêm nhận xét và đề xuất.</div>}
      {data && !isLoading && <div className="mt-5 space-y-5">
        <div className="grid gap-3 lg:grid-cols-[140px_1fr]">
          <div className="border border-cyan-200 bg-cyan-50 p-4 text-center"><p className="text-xs font-bold uppercase text-cyan-800">Sức khỏe POS</p><p className="mt-2 text-4xl font-black text-cyan-900">{data.healthScore}</p><p className="text-xs text-cyan-800">/ 100</p></div>
          <div className="border border-slate-200 p-4"><p className="text-xs font-bold uppercase text-slate-500">Tóm tắt ngắn · {data.model}</p><p className="mt-2 text-sm leading-6 text-slate-800">{data.executiveSummary}</p></div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{(data.findings || []).map((item, index) => <article key={`${item.title}-${index}`} className={`border p-3 ${findingTone[item.severity] || findingTone.info}`}><h3 className="font-extrabold text-slate-900">{item.title}</h3><p className="mt-1 text-sm text-slate-700">{item.insight}</p><p className="mt-2 text-xs font-semibold text-slate-600">{item.evidence?.[0]}</p></article>)}</div>
        {(data.actions || []).length > 0 && <div><h3 className="mb-2 font-extrabold text-slate-900">Đề xuất ngắn</h3><div className="grid gap-3 md:grid-cols-2">{data.actions.map((action) => <article key={action.title} className="border border-slate-200 p-3"><div className="flex justify-between gap-2"><p className="font-bold text-slate-900">{action.title}</p><span className="h-fit bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold">{priority[action.priority]}</span></div><p className="mt-1 text-sm text-slate-600">{action.reason}</p></article>)}</div></div>}
        <p className="text-[11px] text-slate-500">Nguồn: {data.provider} · snapshot đã tổng hợp và ẩn danh · {data.cached ? 'kết quả từ cache' : 'phân tích mới'}.</p>
      </div>}
    </section>
  );
}

const productColumns = [
  ['sku', 'Mã SP'], ['name', 'Tên sản phẩm'], ['categoryName', 'Danh mục'], ['soldQuantity', 'SL bán'],
  ['grossRevenue', 'DT gộp'], ['discount', 'Giảm giá'], ['netRevenue', 'DT thuần'], ['cost', 'Giá vốn'],
  ['grossProfit', 'LN gộp'], ['margin', 'Biên LN'], ['returnedQuantity', 'SL hoàn']
];

export default function Reports() {
  const startingFilters = useMemo(initialFilters, []);
  const [filters, setFilters] = useState(startingFilters);
  const [draft, setDraft] = useState(startingFilters);
  const [period, setPeriod] = useState('7days');
  const [dashboard, setDashboard] = useState(null);
  const [products, setProducts] = useState({ items: [], pagination: { page: 1, total: 0, totalPages: 1 } });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sortBy, setSortBy] = useState('netRevenue');
  const [sortOrder, setSortOrder] = useState('desc');
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [error, setError] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value !== '') query.set(key, String(value)); });
    window.history.replaceState(null, '', `${window.location.pathname}?${query.toString()}`);
    let active = true;
    setLoading(true);
    setAiAnalysis(null);
    setAiError('');
    loadRevenueDashboard(filters)
      .then((data) => { if (active) { setDashboard(data); setError(''); } })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Không thể tải báo cáo doanh thu.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let active = true;
    setProductsLoading(true);
    loadRevenueProducts({ ...filters, page, limit: 10, search, sortBy, sortOrder })
      .then((data) => { if (active) setProducts(data); })
      .catch((requestError) => { if (active) toast.error(requestError.response?.data?.message || 'Không thể tải bảng sản phẩm'); })
      .finally(() => { if (active) setProductsLoading(false); });
    return () => { active = false; };
  }, [filters, page, search, sortBy, sortOrder]);

  const applyFilters = () => {
    if (!draft.from || !draft.to || draft.from > draft.to) return toast.error('Khoảng ngày không hợp lệ');
    setPage(1);
    setFilters(draft);
  };

  const choosePeriod = (value) => {
    setPeriod(value);
    const dates = rangeFor(value);
    const next = { ...draft, ...dates };
    setDraft(next);
    setPage(1);
    setFilters(next);
  };

  const resetFilters = () => {
    const next = { ...rangeFor('7days'), compare: true, categoryId: '', employeeId: '', paymentMethod: '', orderStatus: 'all' };
    setPeriod('7days'); setDraft(next); setFilters(next); setSearchInput(''); setPage(1);
  };

  const exportCsv = async () => {
    try {
      const response = await exportRevenueReport({ ...filters, search, sortBy, sortOrder });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url; link.download = `bao-cao-doanh-thu-${filters.from}-${filters.to}.csv`;
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      toast.success('Đã xuất báo cáo CSV');
    } catch (requestError) { toast.error(requestError.response?.data?.message || 'Không thể xuất báo cáo'); }
  };

  const analyzeWithAi = async () => {
    try {
      setAiLoading(true); setAiError('');
      setAiAnalysis(await runAiRevenueAnalysis(filters));
    } catch (requestError) {
      setAiAnalysis(null);
      const message = requestError.code === 'ECONNABORTED'
        ? 'Gemini phản hồi quá thời gian. Báo cáo MySQL vẫn sử dụng bình thường.'
        : !requestError.response
          ? 'Không kết nối được backend. Hãy kiểm tra máy chủ rồi thử lại.'
          : requestError.response.data?.message || 'Gemini chưa thể phân tích POS lúc này.';
      setAiError(message);
    } finally { setAiLoading(false); }
  };

  const metrics = dashboard?.summary?.metrics || {};
  const options = dashboard?.summary?.filterOptions || {};
  const categoryChartSpec = useMemo(() => {
    const items = dashboard?.categories?.items || [];
    const leading = items.slice(0, 4);
    const remainingRevenue = items.slice(4).reduce((sum, item) => sum + Number(item.netRevenue || 0), 0);
    const visible = remainingRevenue > 0
      ? [...leading, { name: 'Khác', netRevenue: remainingRevenue }]
      : leading;
    return {
      id: 'category_revenue', type: 'doughnut',
      labels: visible.map((item) => item.name),
      datasets: [{ label: 'Doanh thu thuần', data: visible.map((item) => item.netRevenue) }],
      valueFormat: 'currency'
    };
  }, [dashboard?.categories?.items]);
  const hasTrendData = (dashboard?.trend?.points || []).some((item) => item.netRevenue || item.grossProfit);
  const kpis = [
    ['Doanh thu thuần', metrics.netRevenue, metrics.changes?.netRevenue, 'Doanh thu gộp - giảm giá - hoàn trả; không gồm VAT.', false, true],
    ['Lợi nhuận gộp', metrics.grossProfit, metrics.changes?.grossProfit, 'Doanh thu thuần - giá vốn. Giá vốn dùng cost_price hiện tại.', false, true],
    ['Hóa đơn hoàn thành', metrics.completedOrders, metrics.changes?.completedOrders, 'Số hóa đơn có trạng thái completed.', false, false],
    ['Giá trị đơn TB', metrics.averageOrderValue, metrics.changes?.averageOrderValue, 'Doanh thu thuần / số hóa đơn hoàn thành.', false, true],
    ['Tổng giảm giá', metrics.discount, metrics.changes?.discount, 'Tổng discount được phân bổ theo giá trị dòng hàng.', true, true],
    ['Tổng hoàn trả', metrics.refunds, metrics.changes?.refunds, 'Chỉ giao dịch refund riêng; đơn cancelled đã bị loại và không trừ lần hai.', true, true]
  ];

  return (
    <div className="space-y-5 pb-8">
      <header>
        <h1 className="text-2xl font-black text-slate-950">Báo cáo</h1>
        <div role="tablist" className="mt-3 border-b border-slate-200">
          <button role="tab" aria-selected="true" className="border-b-2 border-cyan-700 px-3 py-2 text-sm font-extrabold text-cyan-800">Báo cáo doanh thu & AI</button>
        </div>
      </header>

      <section className="border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {[['today', 'Hôm nay'], ['7days', '7 ngày'], ['30days', '30 ngày'], ['month', 'Tháng này']].map(([value, label]) => (
            <button key={value} type="button" onClick={() => choosePeriod(value)} className={`h-9 border px-3 text-sm font-bold ${period === value ? 'border-cyan-700 bg-cyan-50 text-cyan-800' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>{label}</button>
          ))}
          <button type="button" onClick={() => setPeriod('custom')} className={`h-9 border px-3 text-sm font-bold ${period === 'custom' ? 'border-cyan-700 bg-cyan-50 text-cyan-800' : 'border-slate-300 text-slate-600'}`}>Tùy chọn</button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <label><span className="mb-1 block text-xs font-bold text-slate-600">Từ ngày</span><input type="date" value={draft.from} onChange={(e) => { setPeriod('custom'); setDraft({ ...draft, from: e.target.value }); }} className="h-10 w-full border border-slate-300 px-2 text-sm" /></label>
          <label><span className="mb-1 block text-xs font-bold text-slate-600">Đến ngày</span><input type="date" value={draft.to} onChange={(e) => { setPeriod('custom'); setDraft({ ...draft, to: e.target.value }); }} className="h-10 w-full border border-slate-300 px-2 text-sm" /></label>
          <FilterSelect label="Danh mục" value={draft.categoryId} onChange={(value) => setDraft({ ...draft, categoryId: value })}><option value="">Tất cả danh mục</option>{(options.categories || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</FilterSelect>
          <FilterSelect label="Nhân viên" value={draft.employeeId} onChange={(value) => setDraft({ ...draft, employeeId: value })}><option value="">Tất cả nhân viên</option>{(options.employees || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</FilterSelect>
          <FilterSelect label="Thanh toán" value={draft.paymentMethod} onChange={(value) => setDraft({ ...draft, paymentMethod: value })}><option value="">Tất cả phương thức</option>{(options.paymentMethods || []).map((item) => <option key={item} value={item}>{paymentLabels[item] || item}</option>)}</FilterSelect>
          <FilterSelect label="Trạng thái" value={draft.orderStatus} onChange={(value) => setDraft({ ...draft, orderStatus: value })}>{['all', ...(options.orderStatuses || [])].map((item) => <option key={item} value={item}>{statusLabels[item] || item}</option>)}</FilterSelect>
          <label className="flex items-end"><span className="flex h-10 w-full items-center gap-2 border border-slate-300 px-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={draft.compare} onChange={(e) => setDraft({ ...draft, compare: e.target.checked })} /> So sánh kỳ trước</span></label>
          <button type="button" onClick={applyFilters} className="h-10 self-end bg-cyan-700 px-3 text-sm font-extrabold text-white hover:bg-cyan-800">Áp dụng</button>
        </div>
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={resetFilters} className="flex h-9 items-center gap-2 border border-slate-300 px-3 text-sm font-bold text-slate-700"><RotateCcw size={15} /> Đặt lại</button>
          <button type="button" onClick={exportCsv} className="flex h-9 items-center gap-2 border border-cyan-700 px-3 text-sm font-bold text-cyan-800"><Download size={15} /> Xuất CSV</button>
        </div>
      </section>

      {error && <div className="border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {loading ? Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-28" />) : kpis.map(([label, value, change, tooltip, inverse, currency]) => (
          <article key={label} className="border border-slate-200 bg-white p-3 shadow-sm" title={tooltip}>
            <div className="flex items-start justify-between gap-2"><p className="text-xs font-bold text-slate-600">{label}</p><Info size={14} className="text-slate-400" /></div>
            <p className="mt-3 truncate text-xl font-black text-slate-950">{currency ? formatCurrency(value) : Number(value || 0).toLocaleString('vi-VN')}</p>
            <div className="mt-2 flex items-center gap-2"><ChangeBadge value={change} inverse={inverse} /><span className="text-[11px] text-slate-500">kỳ trước</span></div>
          </article>
        ))}
      </section>

      {loading ? <Skeleton className="h-80" /> : (
        <Panel title="XU HƯỚNG DOANH THU" subtitle="Doanh thu thuần và lợi nhuận gộp lấy trực tiếp từ MySQL." empty={!hasTrendData}>
          <div className="h-72"><TrendChart trend={dashboard?.trend} /></div>
        </Panel>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        {loading ? <Skeleton className="h-96" /> : (
          <Panel title="CƠ CẤU DOANH THU THEO DANH MỤC" subtitle="Tỷ trọng doanh thu thuần lấy trực tiếp từ hóa đơn POS." empty={!categoryChartSpec.labels.length}>
            <div className="h-80"><AiReportChart spec={categoryChartSpec} /></div>
          </Panel>
        )}
        {loading ? <Skeleton className="h-96" /> : (
          <Panel title="CƠ CẤU THANH TOÁN" subtitle="Số tiền và tỷ trọng theo phương thức thanh toán." empty={!dashboard?.payments?.items?.length}>
            <div className="h-80"><PaymentChart items={dashboard?.payments?.items} labels={paymentLabels} /></div>
          </Panel>
        )}
      </div>

      {loading ? <Skeleton className="h-80" /> : (
        <Panel title="DOANH THU THEO KHUNG GIỜ" subtitle={dashboard?.hourly?.peakHour == null ? 'Theo thời gian thanh toán hoặc hoàn tất hóa đơn.' : `Khung giờ cao nhất: ${String(dashboard.hourly.peakHour).padStart(2, '0')}:00.`} empty={!dashboard?.hourly?.items?.length}>
          <div className="h-72"><HourlyChart items={dashboard?.hourly?.items} peakHour={dashboard?.hourly?.peakHour} /></div>
        </Panel>
      )}

      <AiPanel data={aiAnalysis} isLoading={aiLoading} error={aiError} onAnalyze={analyzeWithAi} />

      <Panel title="Chi tiết sản phẩm" subtitle={`${products.pagination?.total || 0} sản phẩm theo bộ lọc hiện tại`}>
        <div className="mb-3 flex max-w-md items-center border border-slate-300 bg-white px-3">
          <Search size={16} className="text-slate-400" /><input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Tìm mã hoặc tên sản phẩm" className="h-10 w-full px-2 text-sm outline-none" />
        </div>
        <div className="overflow-x-auto border border-slate-200">
          <table className="min-w-[1320px] w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700"><tr>{productColumns.map(([key, label]) => (
              <th key={key} className="whitespace-nowrap px-3 py-2.5 font-extrabold"><button type="button" onClick={() => { if (sortBy === key) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); else { setSortBy(key); setSortOrder('desc'); } }} className="hover:text-cyan-800">{label}{sortBy === key ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ''}</button></th>
            ))}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {productsLoading ? <tr><td colSpan={11} className="p-6 text-center text-slate-500">Đang tải dữ liệu sản phẩm...</td></tr> : products.items.length === 0 ? <tr><td colSpan={11} className="p-8 text-center text-slate-500">Không có sản phẩm phù hợp.</td></tr> : products.items.map((item) => (
                <tr key={item.productId} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-semibold">{item.sku || '—'}</td><td className="max-w-[240px] px-3 py-2.5 font-bold text-slate-900">{item.name}</td><td className="px-3 py-2.5">{item.categoryName}</td><td className="px-3 py-2.5 text-right">{item.soldQuantity}</td>
                  {[item.grossRevenue, item.discount, item.netRevenue, item.cost, item.grossProfit].map((value, index) => <td key={index} className="whitespace-nowrap px-3 py-2.5 text-right">{formatCurrency(value)}</td>)}
                  <td className={`px-3 py-2.5 text-right font-bold ${item.margin < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{item.margin}%</td><td className="px-3 py-2.5 text-right">{item.returnedQuantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm text-slate-600"><span>Trang {products.pagination?.page || 1}/{products.pagination?.totalPages || 1}</span><div className="flex gap-1"><button type="button" aria-label="Trang trước" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="grid h-8 w-8 place-items-center border border-slate-300 disabled:opacity-40"><ChevronLeft size={16} /></button><button type="button" aria-label="Trang sau" disabled={page >= (products.pagination?.totalPages || 1)} onClick={() => setPage((value) => value + 1)} className="grid h-8 w-8 place-items-center border border-slate-300 disabled:opacity-40"><ChevronRight size={16} /></button></div></div>
      </Panel>
    </div>
  );
}
