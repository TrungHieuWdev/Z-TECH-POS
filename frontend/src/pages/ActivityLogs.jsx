import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Boxes,
  CalendarDays,
  Clock3,
  Filter,
  RefreshCw,
  Search,
  ShoppingCart,
  UserRound
} from 'lucide-react';
import api from '../api/axios';
import KpiCard from '../components/KpiCard';
import TablePagination from '../components/TablePagination';
import { formatCurrency, formatDate, formatTime } from '../utils/format';

const PAGE_SIZE = 5;

const typeOptions = [
  { value: '', label: 'Tất cả hoạt động' },
  { value: 'order', label: 'Bán hàng' },
  { value: 'inventory', label: 'Kho hàng' }
];

const paymentLabels = {
  cash: 'Tiền mặt',
  transfer: 'Chuyển khoản',
  card: 'Thẻ'
};

const inventoryLabels = {
  in: 'Nhập kho',
  out: 'Xuất kho',
  adjust: 'Điều chỉnh'
};

function toInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getLogTone(log) {
  if (log.type === 'order') {
    return {
      icon: ShoppingCart,
      iconClass: 'bg-[#c0edf7] text-[#0f3b46]',
      badgeClass: 'bg-[#e8f9fc] text-[#0f3b46]',
      badge: paymentLabels[log.meta] || log.meta || 'Bán hàng'
    };
  }

  return {
    icon: Boxes,
    iconClass: log.meta === 'adjust' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700',
    badgeClass: log.meta === 'adjust' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700',
    badge: inventoryLabels[log.meta] || 'Kho hàng'
  };
}

export default function ActivityLogs() {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  async function loadLogs(forceRefresh = false) {
    setIsLoading(true);

    try {
      const params = { limit: 180 };
      if (search.trim()) params.search = search.trim();
      if (type) params.type = type;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const response = await api.get('/activity-logs', { params, cache: !forceRefresh });
      setLogs(response.data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể tải nhật ký hoạt động');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, [search, type, dateFrom, dateTo]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, type, dateFrom, dateTo]);

  const summary = useMemo(() => {
    const today = toInputDate(new Date());

    return {
      total: logs.length,
      orders: logs.filter((log) => log.type === 'order').length,
      inventory: logs.filter((log) => log.type === 'inventory').length,
      today: logs.filter((log) => log.created_at && toInputDate(new Date(log.created_at)) === today).length
    };
  }, [logs]);

  const clearFilters = () => {
    setSearch('');
    setType('');
    setDateFrom('');
    setDateTo('');
  };

  const totalPages = Math.max(1, Math.ceil(logs.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedLogs = useMemo(() => {
    const startIndex = (safePage - 1) * PAGE_SIZE;
    return logs.slice(startIndex, startIndex + PAGE_SIZE);
  }, [logs, safePage]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-950">Nhật ký hoạt động</h1>
          <p className="mt-1 text-sm font-medium text-gray-500">
            Xem lại các thao tác bán hàng, cập nhật kho và những thay đổi đã diễn ra trong hệ thống.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadLogs(true)}
          disabled={isLoading}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#74B8E0] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#5eaed9] disabled:opacity-60"
        >
          <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          <span>Làm mới</span>
        </button>
      </div>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={Clock3} label="Tổng hoạt động" value={summary.total.toLocaleString('vi-VN')} detail="Tất cả hoạt động đã ghi nhận" toneClassName="bg-sky-50 text-sky-700" />
        <KpiCard icon={ShoppingCart} label="Bán hàng" value={summary.orders.toLocaleString('vi-VN')} detail="Thao tác liên quan hóa đơn" toneClassName="bg-emerald-50 text-emerald-700" />
        <KpiCard icon={Boxes} label="Kho hàng" value={summary.inventory.toLocaleString('vi-VN')} detail="Nhập, xuất và điều chỉnh kho" toneClassName="bg-amber-50 text-amber-700" />
        <KpiCard icon={CalendarDays} label="Hôm nay" value={summary.today.toLocaleString('vi-VN')} detail="Hoạt động phát sinh hôm nay" toneClassName="bg-violet-50 text-violet-700" />
      </section>

      <section className="rounded-lg border border-[#d8eef4] bg-white p-4 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_190px_160px_160px_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#98a2b3]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 w-full rounded-lg border border-[#d8eef4] bg-[#f8fdfe] pl-10 pr-3 text-sm font-semibold text-[#111827] outline-none transition focus:border-[#74B8E0] focus:ring-2 focus:ring-[#c0edf7]"
              placeholder="Tìm hành động, nhân viên, mã đơn..."
            />
          </label>
          <label className="relative block">
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#98a2b3]" />
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="h-11 w-full rounded-lg border border-[#d8eef4] bg-white pl-10 pr-3 text-sm font-bold text-[#111827] outline-none transition focus:border-[#74B8E0] focus:ring-2 focus:ring-[#c0edf7]"
            >
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="h-11 rounded-lg border border-[#d8eef4] bg-white px-3 text-sm font-semibold text-[#111827] outline-none transition focus:border-[#74B8E0] focus:ring-2 focus:ring-[#c0edf7]"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="h-11 rounded-lg border border-[#d8eef4] bg-white px-3 text-sm font-semibold text-[#111827] outline-none transition focus:border-[#74B8E0] focus:ring-2 focus:ring-[#c0edf7]"
          />
          <button
            type="button"
            onClick={clearFilters}
            className="h-11 rounded-lg border border-[#d8eef4] bg-white px-4 text-sm font-bold text-[#344054] transition hover:bg-[#f8fdfe]"
          >
            Xóa lọc
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-[#d8eef4] bg-white shadow-sm">
        <div className="border-b border-[#edf7f9] px-5 py-4">
          <div>
            <h2 className="text-base font-extrabold text-[#111827]">Dòng hoạt động</h2>
            <p className="mt-1 text-xs font-semibold text-[#667085]">Hiển thị tối đa 180 hoạt động gần nhất theo bộ lọc.</p>
          </div>
        </div>

        <div className="min-h-[430px] divide-y divide-[#edf7f9]">
          {isLoading ? (
            <div className="px-5 py-10 text-center text-sm font-semibold text-[#667085]">Đang tải nhật ký...</div>
          ) : logs.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm font-semibold text-[#667085]">
              Không có hoạt động phù hợp với bộ lọc hiện tại.
            </div>
          ) : (
            pagedLogs.map((log) => <ActivityLogRow key={log.id} log={log} />)
          )}
        </div>

        {!isLoading && <TablePagination currentPage={safePage} totalItems={logs.length} pageSize={PAGE_SIZE} onPageChange={setCurrentPage} itemLabel="hoạt động" ariaLabel="Phân trang nhật ký hoạt động" />}
      </section>
    </div>
  );
}

function ActivityLogRow({ log }) {
  const tone = getLogTone(log);
  const Icon = tone.icon;

  return (
    <article className="grid min-h-[86px] gap-4 px-5 py-4 transition hover:bg-[#f8fdfe] lg:grid-cols-[minmax(0,1fr)_190px_170px] lg:items-center">
      <div className="flex min-w-0 gap-4">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${tone.iconClass}`}>
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-extrabold text-[#111827]">{log.title}</h3>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${tone.badgeClass}`}>
              {tone.badge}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-sm font-medium text-[#667085]">{log.description}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-[#98a2b3]">
            <span>{log.module}</span>
            <span>{log.action_label}</span>
            {log.reference_code && <span>{log.reference_code}</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm font-semibold text-[#344054]">
        <UserRound size={17} className="text-[#74B8E0]" />
        <span className="truncate">{log.actor_name || 'Không rõ'}</span>
      </div>

      <div className="text-left lg:text-right">
        {log.amount !== null && log.amount !== undefined ? (
          <p className="text-sm font-extrabold text-[#0f3b46]">{formatCurrency(log.amount)}</p>
        ) : (
          <p className="text-sm font-extrabold text-[#0f3b46]">
            {Number(log.quantity || 0).toLocaleString('vi-VN')} sản phẩm
          </p>
        )}
        <p className="mt-1 text-xs font-semibold text-[#667085]">
          {formatTime(log.created_at)} - {formatDate(log.created_at)}
        </p>
      </div>
    </article>
  );
}
