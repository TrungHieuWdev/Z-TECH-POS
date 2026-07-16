import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  CircleX,
  ReceiptText,
  RefreshCw,
  Search,
  TriangleAlert,
  User,
  Wallet
} from 'lucide-react';
import api from '../api/axios';
import KpiCard from '../components/KpiCard';
import Modal from '../components/Modal';
import TablePagination from '../components/TablePagination';
import { formatCurrency, formatDate, formatTime } from '../utils/format';
import { getUser, isFullAccessRole } from '../utils/auth';

const PAGE_SIZE = 5;

const paymentLabels = {
  cash: 'Tiền mặt',
  card: 'Thẻ',
  transfer: 'Chuyển khoản'
};

const statusLabels = {
  completed: 'Đã thanh toán',
  cancelled: 'Đã hủy'
};

const filterOptions = [
  { value: 'all', label: 'Tất cả hóa đơn' },
  { value: 'completed', label: 'Đã thanh toán' },
  { value: 'cancelled', label: 'Đã hủy' },
  { value: 'cash', label: 'Tiền mặt' },
  { value: 'transfer', label: 'Chuyển khoản' }
];

const cancellationReasons = [
  { value: 'customer_changed_mind', label: 'Khách hàng đổi ý' },
  { value: 'incorrect_order', label: 'Nhập sai sản phẩm hoặc số lượng' },
  { value: 'payment_failed', label: 'Thanh toán không thành công' },
  { value: 'out_of_stock', label: 'Sản phẩm hết hàng hoặc bị lỗi' },
  { value: 'duplicate_order', label: 'Tạo trùng hóa đơn' },
  { value: 'other', label: 'Lý do khác' }
];

const paymentBadgeClasses = {
  cash: 'bg-brand-soft text-brand-ink',
  card: 'bg-violet-100 text-violet-700',
  transfer: 'bg-blue-100 text-blue-700'
};

const statusBadgeClasses = {
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700'
};

function getSalesType(order) {
  return order.payment_method === 'transfer' ? 'Đặt hàng Online' : 'Bán hàng trực tiếp';
}

function getCustomerName(order) {
  return order.customer_name || 'Khách thường';
}

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isSameLocalDate(value, dateKey) {
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10) === dateKey;

  return formatDateInput(date) === dateKey;
}

function FilterBar({
  search,
  setSearch,
  filterType,
  setFilterType,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  onReset
}) {
  return (
    <section className="rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm shadow-gray-100">
      <div className="grid items-center gap-3 lg:grid-cols-[minmax(320px,1fr)_190px_170px_28px_170px_auto]">
        <div className="relative min-w-0">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-9 w-full rounded-md border border-gray-300 bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-gray-500 focus:border-brand"
            placeholder="Tìm mã hóa đơn, tên khách hàng..."
          />
        </div>

        <div className="relative min-w-0">
          <select
            value={filterType}
            onChange={(event) => setFilterType(event.target.value)}
            className="h-9 w-full appearance-none truncate rounded-md border border-gray-300 bg-white pl-3 pr-8 text-sm outline-none transition focus:border-brand"
          >
            {filterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-600" />
        </div>

        <input
          type="date"
          value={dateFrom}
          max={dateTo || undefined}
          onChange={(event) => setDateFrom(event.target.value)}
          className="h-9 min-w-0 rounded-md border border-gray-300 px-3 text-sm outline-none transition focus:border-brand"
        />

        <span className="hidden text-center text-sm text-gray-600 xl:block">đến</span>

        <input
          type="date"
          value={dateTo}
          min={dateFrom || undefined}
          onChange={(event) => setDateTo(event.target.value)}
          className="h-9 min-w-0 rounded-md border border-gray-300 px-3 text-sm outline-none transition focus:border-brand"
        />

        <button
          type="button"
          onClick={onReset}
          className="h-9 whitespace-nowrap rounded-md px-3 text-sm font-semibold text-gray-700 transition hover:bg-brand-surface hover:text-brand-deep"
        >
          Xóa lọc
        </button>
      </div>
    </section>
  );
}

function InvoiceRow({ order, onView }) {
  const paymentClassName = paymentBadgeClasses[order.payment_method] || 'bg-gray-100 text-gray-700';
  const statusClassName = statusBadgeClasses[order.status] || 'bg-gray-100 text-gray-700';

  return (
    <article
      className="grid h-[92px] min-w-[980px] cursor-pointer grid-cols-[minmax(320px,1.35fr)_minmax(170px,0.75fr)_minmax(170px,0.7fr)_150px] items-center gap-5 border-b border-gray-200 px-5 py-4 transition hover:bg-[#f8fdfe] last:border-b-0"
      onClick={() => onView(order)}
    >
      <div className="flex min-w-0 items-center gap-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-brand-surface text-brand-deep">
          <ReceiptText size={18} />
        </div>

        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-bold text-gray-950">{order.order_number}</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${paymentClassName}`}>
              {paymentLabels[order.payment_method] || order.payment_method}
            </span>
          </div>
          <p className="mt-2 truncate text-xs text-gray-700">{getCustomerName(order)}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-gray-600">
            <ReceiptText size={12} />
            <span className="truncate">{getSalesType(order)}</span>
          </p>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-2 text-xs text-gray-700">
        <User size={13} className="shrink-0" />
        <span className="truncate">{order.cashier_name || 'Không rõ'}</span>
      </div>

      <div className="text-right">
        <p className="text-sm font-bold text-gray-950">{formatCurrency(order.total)}</p>
        <p className="mt-1 text-xs text-gray-700">
          {formatTime(order.created_at)} - {formatDate(order.created_at)}
        </p>
      </div>

      <div className="text-right">
        <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold ${statusClassName}`}>
          {statusLabels[order.status] || order.status}
        </span>
      </div>
    </article>
  );
}

export default function Orders() {
  const hasFullAccess = isFullAccessRole(getUser()?.role);
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelDetails, setCancelDetails] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [form, setForm] = useState({ status: 'completed', payment_method: 'cash', note: '' });

  async function loadOrders() {
    const params = new URLSearchParams();

    if (dateFrom) {
      params.set('date_from', dateFrom);
    }

    if (dateTo) {
      params.set('date_to', dateTo);
    }

    const queryString = params.toString();
    const response = await api.get(queryString ? `/orders?${queryString}` : '/orders');
    setOrders(response.data);
  }

  useEffect(() => {
    loadOrders();
  }, [dateFrom, dateTo]);

  const filteredOrders = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesKeyword =
        !keyword ||
        [order.order_number, order.customer_name, order.cashier_name]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(keyword));

      const matchesFilter =
        filterType === 'all' ||
        order.status === filterType ||
        order.payment_method === filterType;

      return matchesKeyword && matchesFilter;
    });
  }, [orders, search, filterType]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterType, dateFrom, dateTo]);

  const summary = useMemo(() => {
    const todayKey = formatDateInput(new Date());

    return filteredOrders.reduce(
      (totals, order) => {
        totals.total += 1;

        if (order.payment_method === 'cash') {
          totals.cash += 1;
        }

        if (order.payment_method === 'transfer') {
          totals.transfer += 1;
        }

        if (order.status === 'cancelled') {
          totals.cancelled += 1;
        }

        if (isSameLocalDate(order.created_at, todayKey)) {
          totals.today += 1;
        }

        return totals;
      },
      { total: 0, cash: 0, transfer: 0, cancelled: 0, today: 0 }
    );
  }, [filteredOrders]);

  const totalPages = Math.max(Math.ceil(filteredOrders.length / PAGE_SIZE), 1);
  const visibleOrders = filteredOrders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const summaryCards = [
    {
      key: 'total',
      label: 'Tổng hóa đơn',
      value: summary.total.toLocaleString('vi-VN'),
      detail: 'Theo bộ lọc đang áp dụng',
      icon: ReceiptText,
      toneClassName: 'bg-brand-surface text-brand-deep'
    },
    {
      key: 'cash',
      label: 'Thanh toán bằng tiền mặt',
      value: summary.cash.toLocaleString('vi-VN'),
      detail: 'Hóa đơn thanh toán tiền mặt',
      icon: CheckCircle2,
      toneClassName: 'bg-emerald-100 text-emerald-700'
    },
    {
      key: 'transfer',
      label: 'Thanh toán bằng chuyển khoản',
      value: summary.transfer.toLocaleString('vi-VN'),
      detail: 'Hóa đơn thanh toán chuyển khoản',
      icon: Wallet,
      toneClassName: 'bg-orange-100 text-orange-700'
    },
    {
      key: 'cancelled',
      label: 'Đơn đã hủy',
      value: summary.cancelled.toLocaleString('vi-VN'),
      detail: 'Không tính vào doanh thu',
      icon: CircleX,
      toneClassName: 'bg-red-100 text-red-700',
      onClick: () => {
        setSearch('');
        setFilterType('cancelled');
      }
    },
    {
      key: 'today',
      label: 'Hóa đơn hôm nay',
      value: summary.today.toLocaleString('vi-VN'),
      detail: 'Phát sinh trong ngày hiện tại',
      icon: CalendarCheck,
      toneClassName: 'bg-sky-100 text-sky-700',
      onClick: () => {
        const today = formatDateInput(new Date());
        setSearch('');
        setFilterType('all');
        setDateFrom(today);
        setDateTo(today);
      }
    }
  ];

  const resetFilters = () => {
    setSearch('');
    setFilterType('all');
    setDateFrom('');
    setDateTo('');
  };

  const viewOrder = async (order) => {
    try {
      const response = await api.get(`/orders/${order.id}`);
      setSelectedOrder(response.data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể lấy chi tiết đơn hàng');
    }
  };

  const openEdit = (order) => {
    setEditingOrder(order);
    setForm({
      status: order.status,
      payment_method: order.payment_method,
      note: order.note || ''
    });
  };

  const closeEdit = () => {
    setEditingOrder(null);
    setForm({ status: 'completed', payment_method: 'cash', note: '' });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      await api.put(`/orders/${editingOrder.id}`, form);
      toast.success('Đã cập nhật đơn hàng');
      closeEdit();
      await loadOrders();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể cập nhật đơn hàng');
    }
  };

  const openCancelOrder = (order) => {
    setCancelTarget(order);
    setCancelReason('');
    setCancelDetails('');
    setSelectedOrder(null);
  };

  const closeCancelOrder = () => {
    if (isCancelling) return;
    setCancelTarget(null);
    setCancelReason('');
    setCancelDetails('');
  };

  const cancelOrder = async (event) => {
    event.preventDefault();

    if (!cancelReason) {
      toast.error('Vui lòng chọn lý do hủy hóa đơn');
      return;
    }

    if (cancelReason === 'other' && !cancelDetails.trim()) {
      toast.error('Vui lòng nhập chi tiết lý do hủy');
      return;
    }

    const reasonLabel = cancellationReasons.find((reason) => reason.value === cancelReason)?.label;
    const cancellationNote = [
      `Lý do hủy: ${reasonLabel}`,
      cancelDetails.trim() ? `Chi tiết: ${cancelDetails.trim()}` : '',
      cancelTarget.note ? `Ghi chú trước đó: ${cancelTarget.note}` : ''
    ].filter(Boolean).join('\n');

    try {
      setIsCancelling(true);
      await api.put(`/orders/${cancelTarget.id}`, {
        status: 'cancelled',
        payment_method: cancelTarget.payment_method,
        note: cancellationNote
      });
      toast.success(`Đã hủy hóa đơn ${cancelTarget.order_number}`);
      setCancelTarget(null);
      setCancelReason('');
      setCancelDetails('');
      await loadOrders();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể hủy hóa đơn');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="w-full space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-950">Hóa đơn</h1>
          <p className="mt-1 text-sm font-medium text-gray-500">Tra cứu hóa đơn, kiểm tra thanh toán và theo dõi lịch sử bán hàng của cửa hàng.</p>
        </div>
        <button
          type="button"
          onClick={loadOrders}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-brand-strong px-4 text-sm font-semibold text-white transition hover:bg-brand-deep"
        >
          <RefreshCw size={15} />
          Làm mới
        </button>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((card) => (
          <KpiCard key={card.key} {...card} />
        ))}
      </section>

      <FilterBar
        search={search}
        setSearch={setSearch}
        filterType={filterType}
        setFilterType={setFilterType}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        onReset={resetFilters}
      />

      <section className="overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm shadow-gray-100">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-950">Dòng hóa đơn</h2>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-800">
            {filteredOrders.length.toLocaleString('vi-VN')} dòng
          </span>
        </div>

        <div className="min-h-[502px] overflow-x-auto">
          <div className="grid min-w-[980px] grid-cols-[minmax(320px,1.35fr)_minmax(170px,0.75fr)_minmax(170px,0.7fr)_150px] gap-5 border-b border-gray-200 bg-gray-50 px-5 py-3 text-[11px] font-bold uppercase text-gray-500">
            <span>Hóa đơn</span>
            <span>Thu ngân</span>
            <span className="text-right">Tổng tiền</span>
            <span className="text-right">Trạng thái</span>
          </div>
          {visibleOrders.map((order) => (
            <InvoiceRow
              key={order.id}
              order={order}
              onView={viewOrder}
            />
          ))}

          {visibleOrders.length === 0 && (
            <div className="min-w-[980px] px-5 py-12 text-center text-sm font-medium text-gray-500">
              Không có hóa đơn phù hợp với bộ lọc hiện tại.
            </div>
          )}
        </div>

        <TablePagination currentPage={currentPage} totalItems={filteredOrders.length} pageSize={PAGE_SIZE} onPageChange={setCurrentPage} itemLabel="hóa đơn" ariaLabel="Phân trang hóa đơn" />
      </section>

      <Modal isOpen={Boolean(selectedOrder)} onClose={() => setSelectedOrder(null)} title="Chi tiết đơn hàng">
        {selectedOrder && (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-lg bg-gray-50 p-4 text-sm md:grid-cols-2">
              <div>
                <span className="font-medium text-gray-700">Mã đơn</span>
                <div className="font-semibold text-gray-950">{selectedOrder.order_number}</div>
              </div>
              <div>
                <span className="font-medium text-gray-700">Khách hàng</span>
                <div className="font-semibold text-gray-950">{selectedOrder.customer_name || 'Khách thường'}</div>
              </div>
              <div>
                <span className="font-medium text-gray-700">Thu ngân</span>
                <div className="font-semibold text-gray-950">{selectedOrder.cashier_name}</div>
              </div>
              <div>
                <span className="font-medium text-gray-700">Ngày tạo</span>
                <div className="font-semibold text-gray-950">{formatDate(selectedOrder.created_at)}</div>
              </div>
              <div className="md:col-span-2">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <span className="font-medium text-gray-700">Phương thức thanh toán</span>
                    <div className="mt-1">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${paymentBadgeClasses[selectedOrder.payment_method] || 'bg-gray-100 text-gray-700'}`}>
                        {paymentLabels[selectedOrder.payment_method] || selectedOrder.payment_method || 'Chưa xác định'}
                      </span>
                    </div>
                  </div>
                  <div className="text-left md:text-right">
                    <span className="font-medium text-gray-700">Trạng thái</span>
                    <div className="mt-1">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusBadgeClasses[selectedOrder.status] || 'bg-gray-100 text-gray-700'}`}>
                        {statusLabels[selectedOrder.status] || selectedOrder.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Sản phẩm</th>
                  <th className="px-3 py-2 font-semibold">SL</th>
                  <th className="px-3 py-2 font-semibold">Đơn giá</th>
                  <th className="px-3 py-2 font-semibold">Thành tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {selectedOrder.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 text-gray-950">{item.product_name}</td>
                    <td className="px-3 py-2 text-gray-600">{item.quantity}</td>
                    <td className="px-3 py-2 text-gray-600">{formatCurrency(item.unit_price)}</td>
                    <td className="px-3 py-2 font-medium text-gray-950">{formatCurrency(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="space-y-2 rounded-lg bg-gray-50 p-4 text-sm">
              <div className="flex justify-between">
                <span>Tạm tính</span>
                <span>{formatCurrency(selectedOrder.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Giảm giá</span>
                <span>{formatCurrency(selectedOrder.discount)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-gray-950">
                <span>Tổng cộng</span>
                <span>{formatCurrency(selectedOrder.total)}</span>
              </div>
            </div>

            {selectedOrder.note && (
              <div className="rounded-lg border border-gray-200 p-4 text-sm">
                <p className="font-semibold text-gray-900">Ghi chú hóa đơn</p>
                <p className="mt-2 whitespace-pre-line text-gray-700">{selectedOrder.note}</p>
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="h-10 rounded-md border border-gray-300 px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Đóng
              </button>
              {hasFullAccess && selectedOrder.status === 'completed' && (
                <button
                  type="button"
                  onClick={() => openCancelOrder(selectedOrder)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  <CircleX size={16} />
                  Hủy hóa đơn
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(cancelTarget)}
        onClose={closeCancelOrder}
        title="Xác nhận hủy hóa đơn"
        maxWidth="max-w-lg"
      >
        {cancelTarget && (
          <form onSubmit={cancelOrder} className="space-y-5">
            <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
              <TriangleAlert size={21} className="mt-0.5 shrink-0 text-red-600" />
              <div className="text-sm">
                <p className="font-bold text-red-900">Hủy hóa đơn {cancelTarget.order_number}?</p>
                <p className="mt-1 leading-6 text-red-800">
                  Thao tác này sẽ hoàn lại tồn kho, chuyển thanh toán sang hoàn tiền và vô hiệu hóa bảo hành liên quan.
                </p>
              </div>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-gray-800">
                Lý do hủy <span className="text-red-600">*</span>
              </span>
              <select
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                disabled={isCancelling}
                className="h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100 disabled:opacity-60"
              >
                <option value="">Chọn lý do hủy hóa đơn</option>
                {cancellationReasons.map((reason) => (
                  <option key={reason.value} value={reason.value}>{reason.label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-gray-800">
                Chi tiết {cancelReason === 'other' && <span className="text-red-600">*</span>}
              </span>
              <textarea
                value={cancelDetails}
                onChange={(event) => setCancelDetails(event.target.value)}
                disabled={isCancelling}
                maxLength={500}
                className="min-h-24 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition placeholder:text-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-100 disabled:opacity-60"
                placeholder="Nhập thông tin bổ sung để tiện đối soát..."
              />
              <span className="mt-1 block text-right text-xs text-gray-500">{cancelDetails.length}/500</span>
            </label>

            <div className="flex flex-col-reverse gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeCancelOrder}
                disabled={isCancelling}
                className="h-10 rounded-md border border-gray-300 px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
              >
                Quay lại
              </button>
              <button
                type="submit"
                disabled={isCancelling}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CircleX size={16} />
                {isCancelling ? 'Đang hủy...' : 'Xác nhận hủy'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={Boolean(editingOrder)} onClose={closeEdit} title="Cập nhật đơn hàng">
        {editingOrder && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Trạng thái</span>
              <select
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
              >
                <option value="completed">Hoàn tất</option>
                <option value="cancelled">Đã hủy</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Thanh toán</span>
              <select
                value={form.payment_method}
                onChange={(event) => setForm({ ...form, payment_method: event.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
              >
                <option value="cash">Tiền mặt</option>
                <option value="card">Thẻ</option>
                <option value="transfer">Chuyển khoản</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Ghi chú</span>
              <textarea
                value={form.note}
                onChange={(event) => setForm({ ...form, note: event.target.value })}
                className="min-h-28 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
              />
            </label>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={closeEdit} className="rounded-lg border border-gray-300 px-4 py-2 font-medium">
                Hủy
              </button>
              <button type="submit" className="rounded-lg bg-brand px-4 py-2 font-semibold text-brand-ink hover:bg-brand-muted">
                Lưu
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
