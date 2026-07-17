import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Award, Edit, Eye, History, Phone, Plus, RefreshCcw, Search,
  ShoppingBag, UserCheck, Users, WalletCards
} from 'lucide-react';
import api from '../api/axios';
import KpiCard from '../components/KpiCard';
import Modal from '../components/Modal';
import TablePagination from '../components/TablePagination';
import { formatCurrency, formatDate } from '../utils/format';
import { isVietnamPhone, normalizePhone, vietnamPhoneMessage } from '../utils/phone';
import { customerNameMessage, isValidCustomerName, normalizeCustomerName } from '../utils/customerName';

const initialForm = { name: '', phone: '', email: '', address: '' };
const initialFilters = { spending: '', recent: '', status: 'active' };
const PAGE_SIZE = 5;
const STORE_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const vietnamDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: STORE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const toVietnamDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '').slice(0, 10);

  const parts = Object.fromEntries(
    vietnamDateFormatter.formatToParts(date).map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const isThisMonth = (value) => {
  if (!value) return false;
  return toVietnamDateKey(value).slice(0, 7) === toVietnamDateKey(new Date()).slice(0, 7);
};

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [details, setDetails] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailTab, setDetailTab] = useState('orders');

  async function loadCustomers() {
    const response = await api.get('/customers');
    setCustomers(response.data);
  }

  useEffect(() => { loadCustomers(); }, []);

  const stats = useMemo(() => ({
    total: customers.length,
    newThisMonth: customers.filter((item) => isThisMonth(item.created_at)).length,
    totalSpent: customers.reduce((sum, item) => sum + Number(item.total_spent || 0), 0),
    returning: customers.filter((item) => Number(item.order_count || 0) >= 2).length
  }), [customers]);

  const filteredCustomers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const now = new Date();
    const todayKey = toVietnamDateKey(now);
    const filtered = customers.filter((customer) => {
      const matchesSearch = [customer.name, customer.phone].some((value) => String(value || '').toLowerCase().includes(keyword));
      const lastPurchase = customer.last_purchase_at ? new Date(customer.last_purchase_at) : null;
      const days = lastPurchase ? (now - lastPurchase) / 86400000 : Infinity;
      const matchesRecent = !filters.recent
        || (filters.recent === 'today' && toVietnamDateKey(customer.last_purchase_at) === todayKey)
        || (filters.recent === 'week' && days <= 7)
        || (filters.recent === 'month' && isThisMonth(customer.last_purchase_at))
        || (filters.recent === 'inactive' && days > 90);
      const active = Number(customer.order_count || 0) > 0 || days <= 180;
      const matchesStatus = !filters.status || (filters.status === 'active' ? active : !active);
      return matchesSearch && matchesRecent && matchesStatus;
    });

    if (!filters.spending) return filtered;

    return [...filtered].sort((a, b) => {
      const first = Number(a.total_spent || 0);
      const second = Number(b.total_spent || 0);
      return filters.spending === 'high' ? second - first : first - second;
    });
  }, [customers, search, filters]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / PAGE_SIZE));
  const paginatedCustomers = filteredCustomers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, filters]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const openCreate = () => { setEditingCustomer(null); setForm(initialForm); setIsOpen(true); };
  const openEdit = (customer) => {
    setEditingCustomer(customer);
    setForm({ name: customer.name || '', phone: customer.phone || '', email: customer.email || '', address: customer.address || '' });
    setIsOpen(true);
  };
  const closeModal = () => { setIsOpen(false); setEditingCustomer(null); setForm(initialForm); };

  const openDetails = async (customer) => {
    try {
      const response = await api.get(`/customers/${customer.id}/details`);
      setDetails(response.data);
      setDetailTab('orders');
      setDetailsOpen(true);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể tải chi tiết khách hàng');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = { ...form, name: normalizeCustomerName(form.name), phone: normalizePhone(form.phone) };
    if (!isValidCustomerName(payload.name)) return toast.error(customerNameMessage);
    if (!isVietnamPhone(payload.phone)) return toast.error(vietnamPhoneMessage);
    try {
      if (editingCustomer) {
        await api.put(`/customers/${editingCustomer.id}`, payload);
        toast.success('Đã cập nhật khách hàng');
      } else {
        await api.post('/customers', payload);
        toast.success('Đã thêm khách hàng');
      }
      closeModal();
      await loadCustomers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể lưu khách hàng');
    }
  };

  const resetFilters = () => { setSearch(''); setFilters(initialFilters); };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-2xl font-extrabold text-gray-950">Khách hàng</h1><p className="mt-1 text-sm font-medium text-gray-500">Lưu thông tin khách hàng, theo dõi điểm tích lũy và xem lại lịch sử mua hàng.</p></div>
        <button type="button" onClick={openCreate} className="flex items-center gap-2 bg-[#69afd6] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#579fc8]"><Plus size={18} /> Thêm khách hàng</button>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={Users} label="Tổng khách hàng" value={stats.total.toLocaleString('vi-VN')} detail="Khách hàng đã lưu" toneClassName="bg-sky-50 text-sky-700" />
        <KpiCard icon={UserCheck} label="Khách mới tháng này" value={stats.newThisMonth.toLocaleString('vi-VN')} detail="Đăng ký trong tháng" toneClassName="bg-cyan-50 text-cyan-700" />
        <KpiCard icon={WalletCards} label="Tổng tiền đã mua" value={formatCurrency(stats.totalSpent)} detail="Tổng chi tiêu của thành viên" toneClassName="bg-amber-50 text-amber-700" />
        <KpiCard icon={History} label="Khách quay lại" value={stats.returning.toLocaleString('vi-VN')} detail="Có từ 2 đơn hàng" toneClassName="bg-emerald-50 text-emerald-700" />
      </section>

      <section className="border border-gray-200 bg-white shadow-sm">
        <div
          className="gap-2 overflow-x-auto border-b border-gray-200 p-4"
          style={{ display: 'grid', gridTemplateColumns: 'minmax(300px,1.7fr) repeat(3,minmax(145px,0.8fr)) 110px' }}
        >
          <div className="flex items-center gap-2 border border-gray-300 px-3 focus-within:border-[#69afd6]"><Search size={18} className="text-[#499bc6]" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 w-full min-w-0 text-sm outline-none" placeholder="Tìm tên hoặc số điện thoại" /></div>
          <select value={filters.spending} onChange={(event) => setFilters({ ...filters, spending: event.target.value })} className="h-10 border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#69afd6]"><option value="">Tổng chi tiêu</option><option value="high">Khách mua nhiều</option><option value="low">Khách mua ít</option></select>
          <select value={filters.recent} onChange={(event) => setFilters({ ...filters, recent: event.target.value })} className="h-10 border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#69afd6]"><option value="">Lần mua gần nhất</option><option value="today">Hôm nay</option><option value="week">7 ngày qua</option><option value="month">Tháng này</option><option value="inactive">Lâu chưa mua</option></select>
          <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} className="h-10 border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#69afd6]"><option value="">Tất cả trạng thái</option><option value="active">Đang hoạt động</option><option value="inactive">Ngừng theo dõi</option></select>
          <button type="button" onClick={resetFilters} className="flex h-10 items-center justify-center gap-2 border border-sky-200 px-3 text-sm font-semibold text-[#398fbd] hover:bg-sky-50"><RefreshCcw size={16} /> Làm mới</button>
        </div>

        <div className="min-h-[375px] overflow-x-auto">
          <table className="w-full min-w-[1100px] table-fixed text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-3">Khách hàng</th><th className="px-4 py-3">Số điện thoại</th><th className="px-4 py-3 text-right">Điểm hiện có</th><th className="px-4 py-3 text-right">Tổng chi tiêu</th><th className="px-4 py-3 text-right">Số đơn hàng</th><th className="px-4 py-3">Lần mua gần nhất</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3 text-center">Thao tác</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedCustomers.map((customer) => {
                const active = Number(customer.order_count || 0) > 0 || (customer.last_purchase_at && (new Date() - new Date(customer.last_purchase_at)) / 86400000 <= 180);
                return <tr key={customer.id} className="h-[64px] hover:bg-gray-50/70">
                  <td className="px-4 py-3"><p className="font-semibold text-gray-950">{customer.name}</p><p className="mt-0.5 text-xs text-gray-400">KH-{String(customer.id).padStart(4, '0')}</p></td>
                  <td className="px-4 py-3"><a href={`tel:${customer.phone}`} className="inline-flex items-center gap-1.5 font-medium text-gray-700 hover:text-sky-700"><Phone size={14} className="text-sky-500" />{customer.phone}</a></td>
                  <td className="px-4 py-3 text-right font-bold text-[#398fbd]">{Number(customer.points || 0).toLocaleString('vi-VN')}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-950">{formatCurrency(customer.total_spent || 0)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{Number(customer.order_count || 0).toLocaleString('vi-VN')}</td>
                  <td className="px-4 py-3 text-gray-600">{customer.last_purchase_at ? formatDate(customer.last_purchase_at) : 'Chưa mua hàng'}</td>
                  <td className="px-4 py-3"><span className={`inline-flex px-2 py-1 text-xs font-semibold ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{active ? 'Đang hoạt động' : 'Ngừng theo dõi'}</span></td>
                  <td className="px-4 py-3"><div className="flex justify-center gap-1"><button type="button" onClick={() => openDetails(customer)} className="p-2 text-sky-600 hover:bg-sky-50" title="Xem chi tiết"><Eye size={17} /></button><button type="button" onClick={() => openEdit(customer)} className="p-2 text-gray-500 hover:bg-sky-50 hover:text-sky-700" title="Chỉnh sửa"><Edit size={17} /></button></div></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        {filteredCustomers.length === 0 && <div className="py-12 text-center text-sm text-gray-500">Không tìm thấy khách hàng phù hợp.</div>}
        <TablePagination currentPage={page} totalItems={filteredCustomers.length} pageSize={PAGE_SIZE} onPageChange={setPage} itemLabel="khách hàng" ariaLabel="Phân trang khách hàng" />
      </section>

      <Modal isOpen={isOpen} onClose={closeModal} title={editingCustomer ? 'Chỉnh sửa khách hàng' : 'Thêm khách hàng'} headerActions={<><button type="button" onClick={closeModal} className="h-11 border border-[#69afd6] bg-white px-5 text-base font-bold text-[#398fbd] hover:bg-sky-50">Hủy</button><button type="submit" form="customer-form" className="h-11 bg-[#69afd6] px-5 text-base font-bold text-white hover:bg-[#579fc8]">Lưu</button></>}>
        <form id="customer-form" onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <label className="md:col-span-2"><span className="mb-1 block text-sm font-medium text-gray-700">Tên khách hàng</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="w-full border border-gray-300 px-3 py-2 outline-none focus:border-[#69afd6]" maxLength={100} required /></label>
          <label><span className="mb-1 block text-sm font-medium text-gray-700">Số điện thoại</span><input value={form.phone} onChange={(event) => setForm({ ...form, phone: normalizePhone(event.target.value) })} className="w-full border border-gray-300 px-3 py-2 outline-none focus:border-[#69afd6]" inputMode="numeric" maxLength={10} required /></label>
          <label><span className="mb-1 block text-sm font-medium text-gray-700">Email</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="w-full border border-gray-300 px-3 py-2 outline-none focus:border-[#69afd6]" /></label>
          <label className="md:col-span-2"><span className="mb-1 block text-sm font-medium text-gray-700">Địa chỉ</span><textarea value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} className="min-h-24 w-full border border-gray-300 px-3 py-2 outline-none focus:border-[#69afd6]" /></label>
        </form>
      </Modal>

      <Modal isOpen={detailsOpen} onClose={() => setDetailsOpen(false)} title="Chi tiết khách hàng" maxWidth="max-w-5xl">
        {details && <div className="space-y-5">
          <div className="grid gap-4 border border-gray-200 bg-gray-50 p-4 md:grid-cols-[1.4fr_repeat(4,1fr)]">
            <div><p className="text-lg font-bold text-gray-950">{details.customer.name}</p><p className="mt-1 text-sm text-gray-600">{details.customer.phone}</p><p className="mt-1 text-xs text-gray-500">{details.customer.email || 'Chưa có email'} · {details.customer.address || 'Chưa có địa chỉ'}</p></div>
            <div><p className="text-xs text-gray-500">Điểm hiện có</p><p className="mt-1 text-xl font-bold text-sky-700">{Number(details.customer.points || 0).toLocaleString('vi-VN')}</p></div>
            <div><p className="text-xs text-gray-500">Tổng chi tiêu</p><p className="mt-1 text-lg font-bold">{formatCurrency(details.customer.total_spent || 0)}</p></div>
            <div><p className="text-xs text-gray-500">Tổng đơn hàng</p><p className="mt-1 text-xl font-bold">{details.customer.order_count}</p></div>
            <div><p className="text-xs text-gray-500">Lần mua gần nhất</p><p className="mt-1 font-semibold">{details.customer.last_purchase_at ? formatDate(details.customer.last_purchase_at) : 'Chưa mua'}</p></div>
          </div>
          <div className="flex border-b border-gray-200">
            {[['orders', ShoppingBag, 'Lịch sử mua hàng'], ['points', WalletCards, 'Lịch sử điểm'], ['warranty', Award, 'Bảo hành liên quan']].map(([key, Icon, label]) => <button key={key} type="button" onClick={() => setDetailTab(key)} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${detailTab === key ? 'border-sky-600 text-sky-700' : 'border-transparent text-gray-500'}`}><Icon size={16} />{label}</button>)}
          </div>
          {detailTab === 'orders' && <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50 text-left text-xs uppercase text-gray-500"><tr><th className="p-3">Mã đơn</th><th className="p-3">Ngày mua</th><th className="p-3">Thanh toán</th><th className="p-3 text-right">Tổng tiền</th><th className="p-3">Trạng thái</th></tr></thead><tbody className="divide-y">{details.orders.map((order) => <tr key={order.id}><td className="p-3 font-semibold">{order.order_number}</td><td className="p-3">{formatDate(order.created_at)}</td><td className="p-3">{order.payment_method}</td><td className="p-3 text-right font-semibold">{formatCurrency(order.total)}</td><td className="p-3">{order.status === 'completed' ? 'Hoàn thành' : order.status}</td></tr>)}</tbody></table></div>}
          {detailTab === 'points' && <div className="space-y-2">{details.orders.filter((order) => Number(order.points_used) || Number(order.points_earned)).map((order) => <div key={order.id} className="flex items-center justify-between border border-gray-200 p-3 text-sm"><div><p className="font-semibold">{order.order_number}</p><p className="text-xs text-gray-500">{formatDate(order.created_at)}</p></div><div className="text-right"><p className="font-bold text-emerald-700">+{Number(order.points_earned || 0)} điểm</p>{Number(order.points_used) > 0 && <p className="text-xs font-semibold text-red-600">-{order.points_used} điểm đã dùng</p>}</div></div>)}{!details.orders.some((order) => Number(order.points_used) || Number(order.points_earned)) && <p className="py-8 text-center text-sm text-gray-500">Chưa có lịch sử điểm.</p>}</div>}
          {detailTab === 'warranty' && <div className="space-y-2">{details.warranties.map((item) => <div key={item.id} className="flex items-center justify-between border border-gray-200 p-3 text-sm"><div><p className="font-semibold">{item.product_name}</p><p className="text-xs text-gray-500">{item.order_number} · mua {formatDate(item.purchased_at)}</p></div><span className="bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700">{item.warranty_period_days} ngày</span></div>)}{details.warranties.length === 0 && <p className="py-8 text-center text-sm text-gray-500">Không có sản phẩm bảo hành liên quan.</p>}</div>}
        </div>}
      </Modal>
    </div>
  );
}
