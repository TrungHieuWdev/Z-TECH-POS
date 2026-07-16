import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  Boxes,
  ClipboardCheck,
  History,
  MoreHorizontal,
  PackageCheck,
  Search,
  WalletCards,
  XCircle
} from 'lucide-react';
import api from '../api/axios';
import KpiCard from '../components/KpiCard';
import Modal from '../components/Modal';
import TablePagination from '../components/TablePagination';
import { formatCurrency, formatDate } from '../utils/format';
import { getUser, isFullAccessRole } from '../utils/auth';
import InventoryTabs from '../components/inventory/InventoryTabs';
import PurchaseReceivingTab from '../components/inventory/PurchaseReceivingTab';

const initialForm = { product_id: '', quantity: '', reason: '', note: '' };
const initialCurrentFilters = { category: '', model: '', stock: '', barcode: '' };
const initialHistoryFilters = { transaction: '', employee: '', from: '', to: '' };
const PAGE_SIZE = 10;
const inventoryTabPaths = {
  current: '/inventory',
  receiving: '/inventory/purchase-orders',
  history: '/inventory/history'
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

export default function Inventory() {
  const location = useLocation();
  const navigate = useNavigate();
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
    return logs.map((log) => {
      const type = String(log.type || '').toUpperCase();
      const before = Number.isFinite(Number(log.before_quantity)) ? Number(log.before_quantity) : null;
      const after = Number.isFinite(Number(log.after_quantity)) ? Number(log.after_quantity) : null;
      const change = before === null || after === null ? null : after - before;
      const isCount = /kiểm kê/i.test(String(log.note || ''));
      const transaction = type === 'IMPORT'
        ? 'in'
        : isCount
          ? 'count'
          : change !== null && change > 0
            ? 'increase'
            : 'decrease';
      return { ...log, before, after, change, transaction };
    });
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
  const selectedProduct = useMemo(
    () => products.find((product) => String(product.id) === String(form.product_id)),
    [products, form.product_id]
  );
  const selectedStock = Number(selectedProduct?.stock_quantity || 0);
  const countedQuantity = form.quantity === '' ? null : Number(form.quantity);
  const countDifference = countedQuantity === null || Number.isNaN(countedQuantity)
    ? null
    : countedQuantity - selectedStock;

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
        : mode === 'adjust'
          ? `${form.reason.trim()}${form.note.trim() ? ` - ${form.note.trim()}` : ''}`
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

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-950">Kho hàng</h1>
          <p className="mt-1 text-sm font-medium text-gray-500">Theo dõi tồn kho, nhập thêm hàng và điều chỉnh số lượng sản phẩm khi cần.</p>
        </div>
        {activeTab === 'current' && hasFullAccess && (
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button type="button" onClick={() => openModal('count')} className="inline-flex h-10 items-center gap-2 border border-[#69afd6] bg-white px-4 text-sm font-bold text-[#398fbd] hover:bg-sky-50">
              <ClipboardCheck size={18} />
              Kiểm kê kho
            </button>
            <button type="button" onClick={() => openModal('adjust')} className="inline-flex h-10 items-center gap-2 bg-[#69afd6] px-4 text-sm font-bold text-white hover:bg-[#579fc8]">
              <PackageCheck size={18} />
              Điều chỉnh tồn kho
            </button>
          </div>
        )}
      </header>

      <InventoryTabs value={activeTab} onChange={(tab) => { navigate(inventoryTabPaths[tab]); setSearch(''); }}/>

      {activeTab === 'current' && (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard icon={Boxes} label="Tổng sản phẩm" value={stats.products.toLocaleString('vi-VN')} detail="Tất cả sản phẩm trong kho" toneClassName="bg-sky-50 text-sky-700" />
          <KpiCard icon={PackageCheck} label="Tổng số lượng tồn" value={stats.quantity.toLocaleString('vi-VN')} detail="Đơn vị sản phẩm" toneClassName="bg-cyan-50 text-cyan-700" />
          <KpiCard icon={AlertTriangle} label="Sắp hết hàng" value={stats.low.toLocaleString('vi-VN')} detail="Chạm mức tồn tối thiểu" toneClassName="bg-amber-50 text-amber-700" />
          <KpiCard icon={XCircle} label="Hết hàng" value={stats.out.toLocaleString('vi-VN')} detail="Cần bổ sung sớm" toneClassName="bg-red-50 text-red-700" />
          <KpiCard icon={WalletCards} label="Giá trị tồn kho" value={formatCurrency(stats.value)} detail="Theo tồn kho và giá nhập" toneClassName="bg-emerald-50 text-emerald-700" />
        </section>
      )}

      <section className="border border-gray-200 bg-white shadow-sm">
        {activeTab === 'current' && <div className="grid gap-2 border-b border-gray-200 bg-gray-50/60 p-4 md:grid-cols-2 xl:grid-cols-[minmax(300px,1.6fr)_repeat(4,minmax(150px,1fr))]">
          <div className="flex min-w-0 items-center gap-2 border border-gray-300 bg-white px-3 focus-within:border-[#69afd6]">
            <Search size={18} className="shrink-0 text-[#499bc6]" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full min-w-0 text-sm outline-none" placeholder={searchPlaceholder} />
          </div>
          <select value={currentFilters.category} onChange={(event) => setCurrentFilters({ ...currentFilters, category: event.target.value })} className="h-10 min-w-0 border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-[#69afd6]">
            <option value="">Tất cả danh mục</option>
            {filterOptions.categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <select value={currentFilters.model} onChange={(event) => setCurrentFilters({ ...currentFilters, model: event.target.value })} className="h-10 min-w-0 border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-[#69afd6]">
            <option value="">Tất cả dòng máy / Model</option>
            {filterOptions.models.map((model) => <option key={model} value={model}>{model}</option>)}
          </select>
          <select value={currentFilters.stock} onChange={(event) => setCurrentFilters({ ...currentFilters, stock: event.target.value })} className="h-10 min-w-0 border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-[#69afd6]">
            <option value="">Tất cả trạng thái tồn</option><option value="available">Còn hàng</option><option value="low">Sắp hết hàng</option><option value="out">Hết hàng</option><option value="inactive">Ngừng kinh doanh</option>
          </select>
          <select value={currentFilters.barcode} onChange={(event) => setCurrentFilters({ ...currentFilters, barcode: event.target.value })} className="h-10 min-w-0 border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-[#69afd6]">
            <option value="">Tất cả mã vạch</option><option value="yes">Có mã vạch</option><option value="no">Chưa có mã vạch</option>
          </select>
        </div>}
        {activeTab === 'history' && <div className="border-b border-gray-200 p-4"><div className="flex min-w-0 items-center gap-2 border border-gray-300 px-3 py-2.5 focus-within:border-[#69afd6]">
          <Search size={18} className="shrink-0 text-[#499bc6]" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full min-w-0 text-sm outline-none" placeholder={searchPlaceholder} />
        </div></div>}
        {activeTab === 'receiving' ? (
          <div className="bg-gray-50/40 p-4">
            <PurchaseReceivingTab preferredSupplierId={location.state?.source === 'supplier' ? location.state.supplierId : null} canManage={hasFullAccess} onCreated={loadData} />
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
        ) : <>{activeTab === 'history' && <div className="border-b border-gray-200 bg-gray-50/60 px-4 py-3">
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
        </div>}

        <div className="min-h-[690px] overflow-x-auto">
          {activeTab === 'current' ? (
            <table className="w-full min-w-[1180px] table-fixed text-left text-sm">
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
                    <tr key={product.id} className="h-[64px] hover:bg-gray-50/70">
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
            <table className="w-full min-w-[1120px] table-fixed text-left text-sm">
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
                    <tr key={log.id} className="h-[64px] hover:bg-gray-50/70">
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
        <TablePagination currentPage={page} totalItems={activeRows.length} pageSize={PAGE_SIZE} onPageChange={setPage} itemLabel="dòng" ariaLabel="Phân trang kho hàng" />
        </>}
      </section>

      <Modal isOpen={isOpen} onClose={closeModal} title={mode === 'in' ? 'Nhập kho' : mode === 'count' ? 'Kiểm kê kho' : 'Điều chỉnh tồn kho'} headerActions={<><button type="button" onClick={closeModal} className="h-11 border border-[#69afd6] bg-white px-5 text-base font-bold text-[#398fbd] hover:bg-sky-50">Hủy</button><button type="submit" form="inventory-form" className="h-11 bg-[#69afd6] px-5 text-base font-bold text-white hover:bg-[#579fc8]">{mode === 'count' ? 'Lưu kiểm kê' : 'Lưu'}</button></>}>
        <form id="inventory-form" onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Sản phẩm</span>
            <select value={form.product_id} onChange={(event) => setForm({ ...form, product_id: event.target.value })} className="w-full border border-gray-300 px-3 py-2 outline-none focus:border-sky-500" required>
              <option value="">{mode === 'count' ? 'Tìm hoặc chọn sản phẩm' : 'Chọn sản phẩm'}</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.name} - tồn {product.stock_quantity}</option>)}
            </select>
          </label>
          {(mode === 'count' || mode === 'adjust') && (
            <div>
              <span className="mb-1 block text-sm font-medium text-gray-700">Tồn hiện tại</span>
              <p className="text-lg font-bold text-gray-950">{selectedProduct ? selectedStock.toLocaleString('vi-VN') : '—'}</p>
            </div>
          )}
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">{mode === 'in' ? 'Số lượng nhập' : mode === 'count' ? 'Số lượng thực tế kiểm kê' : 'Tồn kho mới'}</span>
            <input type="number" min={mode === 'in' ? 1 : 0} value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} className="w-full border border-gray-300 px-3 py-2 outline-none focus:border-sky-500" required />
          </label>
          {(mode === 'count' || mode === 'adjust') && (
            <div>
              <span className="mb-1 block text-sm font-medium text-gray-700">Chênh lệch</span>
              <p className={`text-sm font-bold ${countDifference === null ? 'text-gray-500' : countDifference < 0 ? 'text-red-600' : countDifference > 0 ? 'text-emerald-700' : 'text-gray-700'}`}>
                {countDifference === null ? '—' : `${countDifference > 0 ? '+' : ''}${countDifference.toLocaleString('vi-VN')} sản phẩm`}
              </p>
            </div>
          )}
          {mode === 'adjust' && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Lý do điều chỉnh</span>
              <select value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} className="w-full border border-gray-300 px-3 py-2 outline-none focus:border-sky-500" required>
                <option value="">Chọn lý do điều chỉnh</option>
                <option value="Hàng hư / mất">Hàng hư / mất</option>
                <option value="Kiểm kê chênh lệch">Kiểm kê chênh lệch</option>
                <option value="Nhập sai số lượng">Nhập sai số lượng</option>
                <option value="Xuất / trả hàng">Xuất / trả hàng</option>
                <option value="Điều chỉnh khác">Điều chỉnh khác</option>
              </select>
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Ghi chú</span>
            <textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder={mode === 'count' ? 'Ví dụ: Kiểm kê cuối ngày, lệch do bán thiếu bill...' : ''} className="min-h-24 w-full border border-gray-300 px-3 py-2 outline-none focus:border-sky-500" />
          </label>
        </form>
      </Modal>
    </div>
  );
}
