import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  Boxes,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  History,
  MoreHorizontal,
  PackageCheck,
  RotateCcw,
  Search,
  WalletCards,
  XCircle
} from 'lucide-react';
import api from '../api/axios';
import Modal from '../components/Modal';
import { formatCurrency, formatDate } from '../utils/format';
import { getUser, isFullAccessRole } from '../utils/auth';
import InventoryTabs from '../components/inventory/InventoryTabs';
import PurchaseReceivingTab from '../components/inventory/PurchaseReceivingTab';
import useRestockSuggestions from '../hooks/useRestockSuggestions';

const initialForm = { product_id: '', quantity: '', note: '' };
const initialCurrentFilters = { category: '', model: '', stock: '', barcode: '' };
const initialHistoryFilters = { transaction: '', employee: '', from: '', to: '' };
const PAGE_SIZE = 10;
const inventoryTabPaths = {
  current: '/inventory',
  receiving: '/inventory/purchase-orders',
  history: '/inventory/history',
  adjustment: '/inventory/adjustment'
};

function getInventoryTab(pathname) {
  return Object.entries(inventoryTabPaths).find(([, path]) => path !== '/inventory' && pathname === path)?.[0] || 'current';
}

const stockState = (product) => {
  if (Number(product.is_active) === 0) return 'inactive';
  const stock = Number(product.stock_quantity || 0);
  if (stock <= 0) return 'out';
  if (stock <= Number(product.min_stock || 0)) return 'low';
  return 'available';
};

const stateMeta = {
  available: { label: 'Còn hàng', className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10' },
  low: { label: 'Sắp hết hàng', className: 'bg-amber-50 text-amber-700 ring-amber-600/10' },
  out: { label: 'Hết hàng', className: 'bg-red-50 text-red-700 ring-red-600/10' },
  inactive: { label: 'Ngừng kinh doanh', className: 'bg-gray-100 text-gray-600 ring-gray-500/10' }
};

function SummaryCard({ icon: Icon, label, value, note, iconColor = '#398fbd', iconBackground = '#eef8fd' }) {
  return (
    <article className="border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-2 truncate text-2xl font-bold tracking-tight text-gray-950">{value}</p>
          <p className="mt-1 text-xs text-gray-500">{note}</p>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center" style={{ color: iconColor, backgroundColor: iconBackground }}>
          <Icon size={20} strokeWidth={2.2} />
        </span>
      </div>
    </article>
  );
}

function Pagination({ page, totalItems, onChange }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);
  const visiblePages = pages.filter(
    (item) => item === 1 || item === totalPages || Math.abs(item - page) <= 1
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-4 py-3">
      <p className="text-xs text-gray-500">
        Hiển thị {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalItems)} trong {totalItems}
      </p>
      <div className="flex items-center gap-1">
        <button type="button" disabled={page === 1} onClick={() => onChange(page - 1)} className="grid h-8 w-8 place-items-center border border-gray-200 text-sky-700 hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:text-gray-300">
          <ChevronLeft size={16} />
        </button>
        {visiblePages.map((item, index) => (
          <div key={item} className="flex items-center gap-1">
            {index > 0 && item - visiblePages[index - 1] > 1 && <span className="px-1 text-gray-400">…</span>}
            <button
              type="button"
              onClick={() => onChange(item)}
              className="h-8 min-w-8 border px-2 text-sm font-semibold"
              style={page === item
                ? { borderColor: '#69afd6', backgroundColor: '#69afd6', color: '#fff' }
                : { borderColor: '#e5e7eb', backgroundColor: '#fff', color: '#4b5563' }}
            >
              {item}
            </button>
          </div>
        ))}
        <button type="button" disabled={page === totalPages} onClick={() => onChange(page + 1)} className="grid h-8 w-8 place-items-center border border-gray-200 text-sky-700 hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:text-gray-300">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export default function Inventory() {
  const location = useLocation();
  const navigate = useNavigate();
  const restockSuggestions = useRestockSuggestions();
  const hasFullAccess = isFullAccessRole(getUser()?.role);
  const [logs, setLogs] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [currentFilters, setCurrentFilters] = useState(initialCurrentFilters);
  const [historyFilters, setHistoryFilters] = useState(initialHistoryFilters);
  const activeTab = getInventoryTab(location.pathname);
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState('in');
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [suggestedItems, setSuggestedItems] = useState(() => (
    location.state?.source === 'restock-suggestions' ? location.state.suggestedItems : null
  ));

  async function loadData() {
    const [logsRes, productsRes] = await Promise.all([
      api.get('/inventory/logs'),
      api.get('/products')
    ]);
    setLogs(logsRes.data);
    setProducts(productsRes.data);
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (location.state?.source === 'restock-suggestions') {
      setSuggestedItems(location.state.suggestedItems || null);
      navigate('/inventory/purchase-orders', { replace: true });
    }
  }, [location.state, navigate]);

  const stats = useMemo(() => {
    const activeProducts = products.filter((product) => Number(product.is_active) !== 0);
    return {
      products: products.length,
      quantity: activeProducts.reduce((sum, product) => sum + Number(product.stock_quantity || 0), 0),
      low: activeProducts.filter((product) => stockState(product) === 'low').length,
      out: activeProducts.filter((product) => stockState(product) === 'out').length,
      value: activeProducts.reduce(
        (sum, product) => sum + Number(product.stock_quantity || 0) * Number(product.cost_price || 0),
        0
      )
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch = [product.name, product.sku, product.barcode, product.category_name, product.device_model]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
      const matchesCategory = !currentFilters.category || String(product.category_name || '') === currentFilters.category;
      const matchesModel = !currentFilters.model || String(product.device_model || '') === currentFilters.model;
      const matchesStock = !currentFilters.stock || stockState(product) === currentFilters.stock;
      const hasBarcode = Boolean(String(product.barcode || '').trim());
      const matchesBarcode = !currentFilters.barcode
        || (currentFilters.barcode === 'yes' ? hasBarcode : !hasBarcode);
      return matchesSearch && matchesCategory && matchesModel && matchesStock && matchesBarcode;
    });
  }, [products, search, currentFilters]);

  const filterOptions = useMemo(() => ({
    categories: [...new Set(products.map((product) => product.category_name).filter(Boolean))].sort(),
    models: [...new Set(products.map((product) => product.device_model).filter(Boolean))].sort(),
    employees: [...new Set(logs.map((log) => log.user_name).filter(Boolean))].sort()
  }), [products, logs]);

  const historyRows = useMemo(() => {
    const previousByProduct = new Map();
    return [...logs].reverse().map((log) => {
      const previous = previousByProduct.get(log.product_id);
      const after = Number(log.quantity || 0);
      const before = previous ?? (log.type === 'in' ? Math.max(0, after - Number(log.quantity || 0)) : null);
      const change = log.type === 'in' ? Number(log.quantity || 0) : before === null ? null : after - before;
      previousByProduct.set(log.product_id, after);
      const isCount = /kiểm kê/i.test(String(log.note || ''));
      const transaction = log.type === 'in'
        ? 'in'
        : isCount
          ? 'count'
          : change !== null && change > 0
            ? 'increase'
            : 'decrease';
      return { ...log, before, after, change, transaction };
    }).reverse();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return historyRows.filter((log) => {
      const matchesSearch = [log.product_name, log.user_name, log.note, log.type]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
      const matchesTransaction = !historyFilters.transaction || log.transaction === historyFilters.transaction;
      const matchesEmployee = !historyFilters.employee || log.user_name === historyFilters.employee;
      const createdDate = String(log.created_at || '').slice(0, 10);
      const matchesFrom = !historyFilters.from || createdDate >= historyFilters.from;
      const matchesTo = !historyFilters.to || createdDate <= historyFilters.to;
      return matchesSearch && matchesTransaction && matchesEmployee && matchesFrom && matchesTo;
    });
  }, [historyRows, search, historyFilters]);

  const activeRows = activeTab === 'current' ? filteredProducts : activeTab === 'history' ? filteredLogs : [];
  const totalPages = Math.max(1, Math.ceil(activeRows.length / PAGE_SIZE));
  const paginatedRows = activeRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [activeTab, search, currentFilters, historyFilters]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const openModal = (nextMode, productId = '') => {
    setMode(nextMode);
    setForm({ ...initialForm, product_id: productId ? String(productId) : '' });
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setForm(initialForm);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      ...form,
      quantity: Number(form.quantity),
      note: mode === 'count'
        ? `Kiểm kê${form.note.trim() ? ` - ${form.note.trim()}` : ''}`
        : form.note
    };
    try {
      if (mode === 'in') {
        await api.post('/inventory/add', payload);
        toast.success('Đã nhập kho');
      } else {
        await api.put('/inventory/adjust', payload);
        toast.success(mode === 'count' ? 'Đã cập nhật kết quả kiểm kê' : 'Đã điều chỉnh kho');
      }
      closeModal();
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể lưu kho');
    }
  };

  const searchPlaceholder = activeTab === 'current'
    ? 'Tìm theo tên sản phẩm, SKU, barcode hoặc danh mục'
    : 'Tìm theo sản phẩm, nhân viên hoặc ghi chú';
  const isTableTab = activeTab === 'current' || activeTab === 'history';

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-950">Kho hàng</h1>
          <p className="mt-1 text-sm font-medium text-gray-500">Theo dõi tồn kho, nhập thêm hàng và điều chỉnh số lượng sản phẩm khi cần.</p>
        </div>
      </header>

      {activeTab === 'current' && (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard icon={Boxes} label="Tổng sản phẩm" value={stats.products.toLocaleString('vi-VN')} note="Tất cả sản phẩm trong kho" />
          <SummaryCard icon={PackageCheck} label="Tổng số lượng tồn" value={stats.quantity.toLocaleString('vi-VN')} note="Đơn vị sản phẩm" iconColor="#1687a7" iconBackground="#e9f8fb" />
          <SummaryCard icon={AlertTriangle} label="Sắp hết hàng" value={stats.low.toLocaleString('vi-VN')} note="Chạm mức tồn tối thiểu" iconColor="#d97706" iconBackground="#fff7e6" />
          <SummaryCard icon={XCircle} label="Hết hàng" value={stats.out.toLocaleString('vi-VN')} note="Cần bổ sung sớm" iconColor="#dc2626" iconBackground="#fff0f0" />
          <SummaryCard icon={WalletCards} label="Giá trị tồn kho" value={formatCurrency(stats.value)} note="Theo số lượng tồn và giá nhập" iconColor="#059669" iconBackground="#ecfdf5" />
        </section>
      )}

      <section className="border border-gray-200 bg-white shadow-sm">
        <div
          className={`items-center gap-5 border-b border-gray-200 px-4 ${isTableTab ? 'grid py-4' : 'flex min-h-12 justify-end py-0'}`}
          style={isTableTab ? { gridTemplateColumns: 'minmax(420px, 1fr) auto' } : undefined}
        >
          {isTableTab && <div className="flex min-w-0 items-center gap-2 border border-gray-300 px-3 py-2.5 focus-within:border-[#69afd6]">
            <Search size={18} className="shrink-0 text-[#499bc6]" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full min-w-0 text-sm outline-none" placeholder={searchPlaceholder} />
          </div>}
          <InventoryTabs value={activeTab} onChange={(tab) => { navigate(inventoryTabPaths[tab]); setSearch(''); }}/>
        </div>
        {activeTab === 'receiving' ? (
          <div className="bg-gray-50/40 p-4">
            <PurchaseReceivingTab restockSuggestions={restockSuggestions} suggestedItems={suggestedItems} canManage={hasFullAccess} onCreated={loadData} onSuggestedItemsConsumed={() => setSuggestedItems(null)} />
          </div>
        ) : activeTab === 'adjustment' ? (
          hasFullAccess ? (
            <div className="grid gap-4 bg-gray-50/40 p-4 lg:grid-cols-3">
              <button type="button" onClick={() => openModal('count')} className="border border-gray-200 bg-white p-5 text-left shadow-sm hover:border-sky-300 hover:bg-sky-50">
                <ClipboardCheck className="text-sky-700" size={24} />
                <h2 className="mt-4 text-lg font-extrabold text-gray-950">Kiểm kê kho</h2>
                <p className="mt-1 text-sm text-gray-500">Ghi nhận số lượng thực tế sau khi kiểm đếm sản phẩm.</p>
              </button>
              <button type="button" onClick={() => openModal('adjust')} className="border border-gray-200 bg-white p-5 text-left shadow-sm hover:border-sky-300 hover:bg-sky-50">
                <RotateCcw className="text-sky-700" size={24} />
                <h2 className="mt-4 text-lg font-extrabold text-gray-950">Điều chỉnh thủ công</h2>
                <p className="mt-1 text-sm text-gray-500">Cập nhật tồn mới khi có chênh lệch, hư hỏng hoặc cần hiệu chỉnh số liệu.</p>
              </button>
              <button type="button" onClick={() => openModal('adjust')} className="border border-gray-200 bg-white p-5 text-left shadow-sm hover:border-sky-300 hover:bg-sky-50">
                <PackageCheck className="text-sky-700" size={24} />
                <h2 className="mt-4 text-lg font-extrabold text-gray-950">Xuất hàng / Trả hàng</h2>
                <p className="mt-1 text-sm text-gray-500">Ghi giảm tồn bằng phiếu điều chỉnh kèm ghi chú rõ lý do xuất hoặc trả.</p>
              </button>
            </div>
          ) : (
            <div className="bg-gray-50/40 p-4 text-sm text-gray-500">Tài khoản hiện tại chỉ có quyền xem kho.</div>
          )
        ) : <><div className="border-b border-gray-200 bg-gray-50/60 px-4 py-3">
          {activeTab === 'current' ? (
            <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
              <select value={currentFilters.category} onChange={(event) => setCurrentFilters({ ...currentFilters, category: event.target.value })} className="h-10 border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-[#69afd6]">
                <option value="">Tất cả danh mục</option>
                {filterOptions.categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
              <select value={currentFilters.model} onChange={(event) => setCurrentFilters({ ...currentFilters, model: event.target.value })} className="h-10 border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-[#69afd6]">
                <option value="">Tất cả dòng máy / Model</option>
                {filterOptions.models.map((model) => <option key={model} value={model}>{model}</option>)}
              </select>
              <select value={currentFilters.stock} onChange={(event) => setCurrentFilters({ ...currentFilters, stock: event.target.value })} className="h-10 border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-[#69afd6]">
                <option value="">Tất cả trạng thái tồn</option>
                <option value="available">Còn hàng</option>
                <option value="low">Sắp hết hàng</option>
                <option value="out">Hết hàng</option>
                <option value="inactive">Ngừng kinh doanh</option>
              </select>
              <select value={currentFilters.barcode} onChange={(event) => setCurrentFilters({ ...currentFilters, barcode: event.target.value })} className="h-10 border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-[#69afd6]">
                <option value="">Tất cả mã vạch</option>
                <option value="yes">Có mã vạch</option>
                <option value="no">Chưa có mã vạch</option>
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
              <select value={historyFilters.transaction} onChange={(event) => setHistoryFilters({ ...historyFilters, transaction: event.target.value })} className="h-10 border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-[#69afd6]">
                <option value="">Tất cả hoạt động</option>
                <option value="increase">Điều chỉnh tăng</option>
                <option value="decrease">Điều chỉnh giảm</option>
                <option value="in">Nhập kho</option>
                <option value="count">Kiểm kê</option>
              </select>
              <select value={historyFilters.employee} onChange={(event) => setHistoryFilters({ ...historyFilters, employee: event.target.value })} className="h-10 border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-[#69afd6]">
                <option value="">Tất cả nhân viên</option>
                {filterOptions.employees.map((employee) => <option key={employee} value={employee}>{employee}</option>)}
              </select>
              <label className="flex h-10 items-center gap-2 border border-gray-300 bg-white px-3 text-xs text-gray-500 focus-within:border-[#69afd6]">
                Từ ngày
                <input type="date" value={historyFilters.from} onChange={(event) => setHistoryFilters({ ...historyFilters, from: event.target.value })} className="min-w-0 flex-1 bg-transparent text-sm text-gray-700 outline-none" />
              </label>
              <label className="flex h-10 items-center gap-2 border border-gray-300 bg-white px-3 text-xs text-gray-500 focus-within:border-[#69afd6]">
                Đến ngày
                <input type="date" value={historyFilters.to} min={historyFilters.from || undefined} onChange={(event) => setHistoryFilters({ ...historyFilters, to: event.target.value })} className="min-w-0 flex-1 bg-transparent text-sm text-gray-700 outline-none" />
              </label>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          {activeTab === 'current' ? (
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Sản phẩm</th>
                  <th className="px-4 py-3 font-semibold">SKU/Barcode</th>
                  <th className="px-4 py-3 font-semibold">Danh mục</th>
                  <th className="px-4 py-3 text-right font-semibold">Tồn hiện tại</th>
                  <th className="px-4 py-3 text-right font-semibold">Tồn tối thiểu</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="px-4 py-3 text-right font-semibold">Giá nhập</th>
                  <th className="px-4 py-3 text-right font-semibold">Giá trị tồn</th>
                  <th className="px-4 py-3 text-center font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedRows.map((product) => {
                  const meta = stateMeta[stockState(product)];
                  const stock = Number(product.stock_quantity || 0);
                  const cost = Number(product.cost_price || 0);
                  return (
                    <tr key={product.id} className="hover:bg-gray-50/70">
                      <td className="max-w-[280px] px-4 py-3"><p className="truncate font-semibold text-gray-950">{product.name}</p></td>
                      <td className="px-4 py-3 text-gray-600"><p>{product.sku || '—'}</p><p className="mt-0.5 text-xs text-gray-400">{product.barcode || 'Chưa có barcode'}</p></td>
                      <td className="px-4 py-3 text-gray-600">{product.category_name || 'Chưa phân loại'}</td>
                      <td className="px-4 py-3 text-right text-base font-bold text-gray-950">{stock.toLocaleString('vi-VN')}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{Number(product.min_stock || 0).toLocaleString('vi-VN')}</td>
                      <td className="px-4 py-3"><span className={`inline-flex px-2 py-1 text-xs font-semibold ring-1 ring-inset ${meta.className}`}>{meta.label}</span></td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-gray-700">{formatCurrency(cost)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-gray-950">{formatCurrency(stock * cost)}</td>
                      <td className="px-4 py-3 text-center">
                        {hasFullAccess ? <button type="button" title="Điều chỉnh sản phẩm" onClick={() => openModal('adjust', product.id)} className="p-2 text-gray-500 hover:bg-sky-50 hover:text-sky-700"><MoreHorizontal size={18} /></button> : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Sản phẩm</th>
                  <th className="px-4 py-3 font-semibold">Nhân viên</th>
                  <th className="px-4 py-3 font-semibold">Hoạt động</th>
                  <th className="px-4 py-3 text-right font-semibold">Tồn trước</th>
                  <th className="px-4 py-3 text-right font-semibold">Thay đổi</th>
                  <th className="px-4 py-3 text-right font-semibold">Tồn sau</th>
                  <th className="px-4 py-3 font-semibold">Ghi chú</th>
                  <th className="px-4 py-3 font-semibold">Ngày tạo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedRows.map((log) => {
                  const change = log.change;
                  const transactionMeta = {
                    in: ['Nhập kho', 'bg-emerald-50 text-emerald-700'],
                    count: ['Kiểm kê', 'bg-sky-50 text-sky-700'],
                    increase: ['Điều chỉnh tăng', 'bg-cyan-50 text-cyan-700'],
                    decrease: ['Điều chỉnh giảm', 'bg-amber-50 text-amber-700']
                  }[log.transaction];
                  return (
                    <tr key={log.id} className="hover:bg-gray-50/70">
                      <td className="max-w-[260px] px-4 py-3"><p className="truncate font-semibold text-gray-950">{log.product_name}</p></td>
                      <td className="px-4 py-3 text-gray-600">{log.user_name || '—'}</td>
                      <td className="px-4 py-3"><span className={`inline-flex px-2 py-1 text-xs font-semibold ${transactionMeta[1]}`}>{transactionMeta[0]}</span></td>
                      <td className="px-4 py-3 text-right text-gray-600">{log.before ?? '—'}</td>
                      <td className={`px-4 py-3 text-right font-bold ${change === null ? 'text-gray-400' : change >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{change === null ? '—' : `${change >= 0 ? '+' : ''}${change}`}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-950">{log.after}</td>
                      <td className="max-w-[300px] px-4 py-3 text-gray-600"><p className="truncate" title={log.note}>{log.note || '—'}</p></td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">{formatDate(log.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {(activeTab === 'current' ? filteredProducts : filteredLogs).length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-gray-500">Không tìm thấy dữ liệu phù hợp.</div>
        )}
        <Pagination page={page} totalItems={activeRows.length} onChange={setPage} />
        </>}
      </section>

      <Modal isOpen={isOpen} onClose={closeModal} title={mode === 'in' ? 'Nhập kho' : mode === 'count' ? 'Kiểm kê kho' : 'Điều chỉnh tồn kho'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Sản phẩm</span>
            <select value={form.product_id} onChange={(event) => setForm({ ...form, product_id: event.target.value })} className="w-full border border-gray-300 px-3 py-2 outline-none focus:border-sky-500" required>
              <option value="">Chọn sản phẩm</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.name} - tồn {product.stock_quantity}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">{mode === 'in' ? 'Số lượng nhập' : mode === 'count' ? 'Số lượng thực tế kiểm kê' : 'Tồn kho mới'}</span>
            <input type="number" min={mode === 'in' ? 1 : 0} value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} className="w-full border border-gray-300 px-3 py-2 outline-none focus:border-sky-500" required />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Ghi chú</span>
            <textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder={mode === 'count' ? 'Ví dụ: Kiểm kê cuối ngày' : ''} className="min-h-24 w-full border border-gray-300 px-3 py-2 outline-none focus:border-sky-500" />
          </label>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={closeModal} className="border border-gray-300 px-4 py-2 font-medium">Hủy</button>
            <button type="submit" className="bg-[#69afd6] px-4 py-2 font-semibold text-white hover:bg-[#579fc8]">Lưu</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
