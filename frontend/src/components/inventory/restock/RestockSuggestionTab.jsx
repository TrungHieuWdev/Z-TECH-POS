import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import ExcelJS from 'exceljs';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Boxes, ChevronDown, Download, Filter, Plus, RefreshCw, Search, ShoppingCart, WalletCards } from 'lucide-react';
import api from '../../../api/axios';
import { formatCurrency } from '../../../utils/format';

const priorityMeta = {
  high: { label: 'Cao', className: 'bg-red-50 text-red-700 ring-red-600/10' },
  medium: { label: 'Vừa', className: 'bg-amber-50 text-amber-700 ring-amber-600/10' },
  low: { label: 'Thấp', className: 'bg-sky-50 text-sky-700 ring-sky-600/10' },
  insufficient: { label: 'Chưa đủ dữ liệu', className: 'bg-gray-100 text-gray-600 ring-gray-500/10' }
};

function StatCard({ icon: Icon, label, value, note, tone = 'bg-sky-50 text-sky-700' }) {
  return <article className="border border-gray-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold uppercase text-gray-500">{label}</p><p className="mt-2 truncate text-2xl font-extrabold text-gray-950">{value}</p>{note && <p className="mt-1 text-xs font-medium text-gray-500">{note}</p>}</div><span className={`grid h-10 w-10 shrink-0 place-items-center ${tone}`}><Icon size={20} /></span></div></article>;
}

function demandSubline(rate) {
  if (!rate) return 'Chưa ghi nhận tốc độ bán';
  if (rate < 1) return `~ 1 sp / ${Math.max(1, Math.round(1 / rate))} ngày`;
  return `~ ${Math.round(rate)} sp/ngày`;
}

function integer(value) {
  const number = Number(value);
  return Number.isFinite(number) ? String(Math.round(number)) : '0';
}

function DetailItem({ label, value, highlight = false }) {
  return <div className="border-b border-gray-100 py-3"><dt className="text-xs font-semibold text-gray-500">{label}</dt><dd className={`mt-1 font-bold ${highlight ? 'text-sky-700' : 'text-gray-950'}`}>{value}</dd></div>;
}

function coverLabel(item) {
  if (item.daysCover === null || item.priority === 'insufficient') return 'Chưa đủ dữ liệu';
  const days = Math.max(0, Math.round(item.daysCover));
  return days <= 1 ? `${days} ngày` : `Khoảng ${days} ngày`;
}

export default function RestockSuggestionTab({ analysis }) {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [reasonItem, setReasonItem] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => { api.get('/categories').then((response) => setCategories(Array.isArray(response.data) ? response.data : [])).catch(() => setCategories([])); }, []);

  useEffect(() => {
    if (!reasonItem) return undefined;
    const closeOnEscape = (event) => { if (event.key === 'Escape') setReasonItem(null); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [reasonItem]);

  useEffect(() => { setSelected((previous) => new Set([...previous].filter((id) => analysis.suggestions.some((item) => item.productId === id)))); }, [analysis.suggestions]);

  const stats = useMemo(() => {
    const rows = analysis.allSuggestions;
    return {
      total: rows.length,
      high: rows.filter((item) => item.priority === 'high').length,
      quantity: rows.reduce((sum, item) => sum + Number(item.suggestedQuantity || 0), 0),
      cost: rows.reduce((sum, item) => sum + (item.hasValidCostPrice ? Number(item.estimatedCost || 0) : 0), 0),
      missingCost: rows.some((item) => item.suggestedQuantity > 0 && !item.hasValidCostPrice)
    };
  }, [analysis.allSuggestions]);

  const selectedRows = analysis.suggestions.filter((item) => selected.has(item.productId));
  const updateFilter = (patch) => analysis.setFilters({ ...analysis.filters, ...patch });
  const advancedFilterCount = [analysis.filters.deviceFamily, analysis.filters.stockStatus, analysis.filters.costStatus, analysis.filters.quantityRange].filter(Boolean).length;
  const toggle = (id) => setSelected((previous) => { const next = new Set(previous); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const toggleAll = () => setSelected(selectedRows.length === analysis.suggestions.length ? new Set() : new Set(analysis.suggestions.map((item) => item.productId)));
  const openPurchaseOrder = (rows, { useManualQuantity = false } = {}) => {
    const selectedRows = useManualQuantity ? rows : rows.filter((item) => item.suggestedQuantity > 0);
    if (!selectedRows.length) {
      return toast.error(useManualQuantity ? 'Hãy chọn ít nhất một sản phẩm.' : 'Chưa có sản phẩm nào có số lượng đề xuất nhập.');
    }
    navigate('/inventory/purchase-orders', { state: { suggestedItems: selectedRows.map((item) => ({ product_id: item.productId, quantity: useManualQuantity ? Math.max(1, Number(item.suggestedQuantity || 0)) : item.suggestedQuantity, import_price: item.hasValidCostPrice ? item.costPrice : 0 })), source: 'restock-suggestions' } });
  };
  const exportExcel = async () => {
    const rows = selectedRows.length ? selectedRows : analysis.suggestions;
    if (!rows.length) return toast.error('Không có dữ liệu để xuất.');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Gợi ý nhập hàng');
    sheet.columns = [
      { header: 'Sản phẩm', key: 'name', width: 35 }, { header: 'SKU', key: 'sku', width: 18 },
      { header: 'Tồn kho', key: 'stock', width: 12 }, { header: 'Đã bán 7/30/90 ngày', key: 'sold', width: 22 },
      { header: `Nhu cầu / ${analysis.filters.targetDays} ngày`, key: 'demand', width: 20 }, { header: 'Điểm đặt lại', key: 'reorder', width: 16 },
      { header: 'Đề xuất nhập', key: 'suggested', width: 16 }, { header: 'Giá nhập', key: 'cost', width: 18 },
      { header: 'Ưu tiên', key: 'priority', width: 18 }, { header: 'Lý do', key: 'reason', width: 70 }
    ];
    rows.forEach((item) => sheet.addRow({ name: item.productName, sku: item.sku || item.barcode || '', stock: item.currentStock, sold: `${item.sold7Days}/${item.sold30Days}/${item.sold90Days}`, demand: item.forecastQtyTarget, reorder: item.reorderPoint, suggested: item.suggestedQuantity, cost: item.hasValidCostPrice ? item.costPrice : 'Chưa có giá nhập', priority: priorityMeta[item.priority]?.label, reason: item.reason }));
    sheet.getRow(1).font = { bold: true };
    const blob = new Blob([await workbook.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `goi-y-nhap-hang-${new Date().toISOString().slice(0, 10)}.xlsx`; link.click(); URL.revokeObjectURL(url);
  };

  return <section className="space-y-4 bg-[#f8fafc] p-4">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-extrabold text-gray-950">AI gợi ý nhập hàng</h2><p className="mt-1 text-sm text-gray-500">Dự báo nhu cầu từ tốc độ bán thực tế, điểm đặt lại và tồn kho an toàn.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={exportExcel} className="flex h-10 items-center gap-2 border border-gray-300 bg-white px-3 text-sm font-bold text-gray-700 hover:bg-gray-50"><Download size={16} />Xuất Excel</button><button type="button" onClick={() => openPurchaseOrder(selectedRows, { useManualQuantity: true })} className="flex h-10 items-center gap-2 border border-[#69afd6] bg-white px-3 text-sm font-bold text-sky-700 hover:bg-sky-50"><Plus size={16} />Thêm vào phiếu nhập</button><button type="button" onClick={() => openPurchaseOrder(analysis.suggestions)} className="flex h-10 items-center gap-2 bg-[#69afd6] px-3 text-sm font-bold text-white hover:bg-[#579fc8]"><ShoppingCart size={16} />Tạo phiếu nhập từ đề xuất</button><button type="button" title="Làm mới" aria-label="Làm mới" onClick={() => analysis.reload().then(() => toast.success('Đã làm mới gợi ý nhập hàng'))} disabled={analysis.loading} className="grid h-10 w-10 place-items-center border border-gray-300 bg-white text-gray-600 disabled:opacity-60"><RefreshCw size={17} className={analysis.loading ? 'animate-spin' : ''} /></button></div></header>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard icon={Boxes} label="Sản phẩm cần xem xét" value={stats.total.toLocaleString('vi-VN')} note="Có đề xuất nhập theo nhu cầu" /><StatCard icon={AlertTriangle} label="Ưu tiên cao" value={stats.high.toLocaleString('vi-VN')} note="Có nguy cơ hết hàng sớm" tone="bg-red-50 text-red-700" /><StatCard icon={ShoppingCart} label="Tổng số lượng đề xuất" value={stats.quantity.toLocaleString('vi-VN')} note="Cộng tất cả sản phẩm" tone="bg-cyan-50 text-cyan-700" /><StatCard icon={WalletCards} label="Vốn nhập ước tính" value={formatCurrency(stats.cost)} note={stats.missingCost ? 'Chưa gồm sản phẩm thiếu giá nhập' : 'Theo giá nhập hiện tại'} tone="bg-emerald-50 text-emerald-700" /></div>


    <div className="border border-gray-200 bg-white p-3 shadow-sm"><div className="grid gap-2 md:grid-cols-[minmax(260px,1fr)_220px_180px_auto]"><label className="relative block"><span className="sr-only">Tìm sản phẩm</span><Search size={17} className="pointer-events-none absolute left-3 top-3 text-gray-400" /><input type="search" value={analysis.filters.search} onChange={(event) => updateFilter({ search: event.target.value })} placeholder="Tìm theo tên, SKU hoặc mã vạch" className="h-10 w-full border border-gray-300 bg-white pl-10 pr-3 text-sm outline-none focus:border-[#69afd6]" /></label><select aria-label="Danh mục" value={analysis.filters.categoryId} onChange={(event) => updateFilter({ categoryId: event.target.value })} className="h-10 border border-gray-300 bg-white px-3 text-sm"><option value="">Tất cả danh mục</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><select aria-label="Ưu tiên" value={analysis.filters.priority} onChange={(event) => updateFilter({ priority: event.target.value })} className="h-10 border border-gray-300 bg-white px-3 text-sm"><option value="">Tất cả ưu tiên</option><option value="high">Cao</option><option value="medium">Vừa</option><option value="low">Thấp</option><option value="insufficient">Chưa đủ dữ liệu</option></select><button type="button" onClick={() => setShowAdvanced((value) => !value)} className={`inline-flex h-10 items-center justify-center gap-2 border px-3 text-sm font-bold ${showAdvanced || advancedFilterCount ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}><Filter size={16} />Bộ lọc nâng cao{advancedFilterCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-sky-700 px-1 text-xs text-white">{advancedFilterCount}</span>}<ChevronDown size={15} className={showAdvanced ? 'rotate-180' : ''} /></button></div>{showAdvanced && <div className="mt-3 grid gap-2 border-t border-gray-100 pt-3 md:grid-cols-2 xl:grid-cols-4"><select aria-label="Dòng máy" value={analysis.filters.deviceFamily} onChange={(event) => updateFilter({ deviceFamily: event.target.value })} className="h-10 border border-gray-300 bg-white px-3 text-sm"><option value="">Tất cả dòng máy</option><option value="apple">Apple</option><option value="samsung">Samsung</option><option value="oppo">OPPO</option><option value="vivo">Vivo</option><option value="xiaomi">Xiaomi</option><option value="generic">Phụ kiện chung</option></select><select aria-label="Tình trạng tồn kho" value={analysis.filters.stockStatus} onChange={(event) => updateFilter({ stockStatus: event.target.value })} className="h-10 border border-gray-300 bg-white px-3 text-sm"><option value="">Tất cả tình trạng tồn</option><option value="out">Hết hàng</option><option value="low">Sắp hết</option><option value="available">Còn hàng</option></select><select aria-label="Giá nhập" value={analysis.filters.costStatus} onChange={(event) => updateFilter({ costStatus: event.target.value })} className="h-10 border border-gray-300 bg-white px-3 text-sm"><option value="">Tất cả giá nhập</option><option value="has">Đã có giá nhập</option><option value="missing">Chưa có giá nhập</option></select><div className="flex gap-2"><select aria-label="Số lượng đề xuất" value={analysis.filters.quantityRange} onChange={(event) => updateFilter({ quantityRange: event.target.value })} className="h-10 min-w-0 flex-1 border border-gray-300 bg-white px-3 text-sm"><option value="">Tất cả số lượng</option><option value="under10">Dưới 10</option><option value="10to30">Từ 10 đến 30</option><option value="over30">Trên 30</option></select>{advancedFilterCount > 0 && <button type="button" onClick={() => updateFilter({ deviceFamily: '', stockStatus: '', costStatus: '', quantityRange: '' })} className="h-10 whitespace-nowrap px-2 text-xs font-bold text-gray-500 hover:text-gray-900">Xóa lọc</button>}</div></div>}</div>

    {analysis.error && <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{analysis.error}</div>}

    <div className="overflow-x-auto border border-gray-200 bg-white"><table className="w-full min-w-[1040px] table-fixed text-left text-sm"><colgroup><col className="w-[4%]" /><col className="w-[29%]" /><col className="w-[9%]" /><col className="w-[15%]" /><col className="w-[12%]" /><col className="w-[13%]" /><col className="w-[8%]" /><col className="w-[10%]" /></colgroup><thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-3 py-3"><input type="checkbox" aria-label="Chọn tất cả" checked={analysis.suggestions.length > 0 && selectedRows.length === analysis.suggestions.length} onChange={toggleAll} /></th><th className="px-3 py-3">Sản phẩm</th><th className="px-3 py-3 text-right">Tồn kho</th><th className="px-3 py-3 text-right">Nhu cầu dự báo</th><th className="px-3 py-3 text-right">Còn đủ bán</th><th className="px-3 py-3 text-right">Đề xuất nhập</th><th className="px-3 py-3 text-center">Ưu tiên</th><th className="px-3 py-3 text-center">Lý do</th></tr></thead><tbody className="divide-y divide-gray-100">
      {analysis.loading ? <tr><td colSpan={8} className="px-4 py-12 text-center font-semibold text-gray-500">Đang tính toán gợi ý nhập hàng...</td></tr> : analysis.suggestions.length === 0 ? <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500">Chưa có sản phẩm cần đề xuất nhập theo bộ lọc hiện tại.</td></tr> : analysis.suggestions.map((item) => { const priority = priorityMeta[item.priority] || priorityMeta.low; return <tr key={item.productId} className="hover:bg-gray-50/70"><td className="px-3 py-4"><input type="checkbox" aria-label={`Chọn ${item.productName}`} checked={selected.has(item.productId)} onChange={() => toggle(item.productId)} /></td><td className="px-3 py-4"><p className="truncate font-semibold text-gray-950" title={item.productName}>{item.productName}</p><p className="mt-0.5 truncate text-xs text-gray-500">{item.sku || item.barcode || item.categoryName || 'Chưa có mã'}</p></td><td className="px-3 py-4 text-right font-bold">{integer(item.currentStock)}</td><td className="px-3 py-4 text-right"><p className="font-bold text-gray-950">{integer(item.forecastQtyTarget)} sp / {integer(item.targetDays)} ngày</p><p className="mt-0.5 text-xs text-gray-500">{demandSubline(item.forecastDailySales)}</p></td><td className="px-3 py-4 text-right text-gray-700">{coverLabel(item)}</td><td className="px-3 py-4 text-right text-base font-extrabold text-sky-700">{integer(item.suggestedQuantity)} sp</td><td className="px-3 py-4 text-center"><span className={`inline-flex px-2 py-1 text-xs font-bold ring-1 ring-inset ${priority.className}`}>{priority.label}</span></td><td className="px-3 py-4 text-center"><button type="button" onClick={() => setReasonItem(item)} className="whitespace-nowrap rounded border border-sky-200 bg-white px-3 py-1.5 text-xs font-bold text-sky-700 hover:bg-sky-50">Xem lý do</button></td></tr>; })}
    </tbody></table></div>

    {reasonItem && createPortal(<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setReasonItem(null); }}><section role="dialog" aria-modal="true" aria-labelledby="restock-reason-title" className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-2xl"><header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-200 bg-white px-5 py-4"><div><p className="text-xs font-bold uppercase tracking-wide text-sky-700">Chi tiết đề xuất nhập hàng</p><h3 id="restock-reason-title" className="mt-1 text-lg font-extrabold text-gray-950">{reasonItem.productName}</h3><p className="mt-1 text-xs text-gray-500">{reasonItem.sku || reasonItem.barcode || reasonItem.categoryName || 'Chưa có mã sản phẩm'}</p></div></header><div className="p-5"><div className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3"><DetailItem label="Tồn kho hiện tại" value={`${integer(reasonItem.currentStock)} sp`} /><DetailItem label="Đã bán trong 7 ngày" value={`${integer(reasonItem.sold7Days)} sp`} /><DetailItem label="Đã bán trong 30 ngày" value={`${integer(reasonItem.sold30Days)} sp`} /><DetailItem label="Đã bán trong 90 ngày" value={`${integer(reasonItem.sold90Days)} sp`} /><DetailItem label="Tốc độ bán trung bình 7 ngày" value={`${integer(reasonItem.daily7)} sp/ngày`} /><DetailItem label="Tốc độ bán trung bình 30 ngày" value={`${integer(reasonItem.daily30)} sp/ngày`} /><DetailItem label="Tốc độ bán trung bình 90 ngày" value={`${integer(reasonItem.daily90)} sp/ngày`} /><DetailItem label="Nhu cầu dự báo" value={`${integer(reasonItem.forecastQtyTarget)} sp`} /><DetailItem label="Ngày chờ nhập" value={`${integer(reasonItem.leadTimeDays ?? analysis.filters.leadTimeDays)} ngày`} /><DetailItem label="Ngày tồn an toàn" value={`${integer(reasonItem.safetyDays ?? analysis.filters.safetyDays)} ngày`} /><DetailItem label="Mục tiêu đủ bán" value={`${integer(reasonItem.targetDays ?? analysis.filters.targetDays)} ngày`} /><DetailItem label="Điểm đặt lại" value={`${integer(reasonItem.reorderPoint)} sp`} /><DetailItem label="Còn đủ bán" value={coverLabel(reasonItem)} /><DetailItem label="Đề xuất nhập" value={`${integer(reasonItem.suggestedQuantity)} sp`} highlight /><DetailItem label="Vốn ước tính" value={reasonItem.suggestedQuantity > 0 && !reasonItem.hasValidCostPrice ? 'Chưa có giá nhập' : formatCurrency(reasonItem.estimatedCost || 0)} /></div><div className="mt-5 rounded-md bg-gray-50 p-4"><p className="text-xs font-bold uppercase text-gray-500">Lý do đề xuất</p><p className="mt-2 text-sm leading-6 text-gray-700">{reasonItem.reason}</p></div></div><footer className="sticky bottom-0 flex justify-end border-t border-gray-200 bg-white px-5 py-3"><button type="button" onClick={() => setReasonItem(null)} className="rounded bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-gray-800">Đóng</button></footer></section></div>, document.body)}
  </section>;
}



