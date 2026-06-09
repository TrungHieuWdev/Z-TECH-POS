import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Edit, Eye, Search, XCircle } from 'lucide-react';
import api from '../api/axios';
import Modal from '../components/Modal';
import { formatCurrency, formatDate } from '../utils/format';

const paymentLabels = {
  cash: 'Tiền mặt',
  card: 'Thẻ',
  transfer: 'Chuyển khoản'
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [form, setForm] = useState({ status: 'completed', payment_method: 'cash', note: '' });

  async function loadOrders() {
    const params = new URLSearchParams();

    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);

    const response = await api.get(`/orders?${params.toString()}`);
    setOrders(response.data);
  }

  useEffect(() => {
    loadOrders();
  }, [dateFrom, dateTo]);

  const filteredOrders = useMemo(() => {
    const keyword = search.toLowerCase();

    return orders.filter((order) =>
      [order.order_number, order.customer_name, order.cashier_name]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(keyword))
    );
  }, [orders, search]);

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

  const cancelOrder = async (order) => {
    if (!window.confirm(`Hủy đơn "${order.order_number}"?`)) {
      return;
    }

    try {
      await api.delete(`/orders/${order.id}`);
      toast.success('Đã hủy đơn hàng');
      await loadOrders();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể hủy đơn hàng');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-950">Đơn hàng</h1>
        <p className="mt-1 text-sm text-gray-500">Theo dõi giao dịch đã bán</p>
      </div>

      <div className="grid gap-3 rounded-lg bg-white p-4 shadow-sm lg:grid-cols-[1fr_180px_180px]">
        <div className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2">
          <Search size={18} className="text-gray-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full outline-none"
            placeholder="Tìm mã đơn, khách hàng, thu ngân"
          />
        </div>
        <input
          type="date"
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-indigo-600"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-indigo-600"
        />
      </div>

      <section className="rounded-lg bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Mã đơn</th>
                <th className="px-4 py-3 font-semibold">Khách hàng</th>
                <th className="px-4 py-3 font-semibold">Thu ngân</th>
                <th className="px-4 py-3 font-semibold">Tổng tiền</th>
                <th className="px-4 py-3 font-semibold">Thanh toán</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
                <th className="px-4 py-3 font-semibold">Ngày tạo</th>
                <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredOrders.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-3 font-medium text-gray-950">{order.order_number}</td>
                  <td className="px-4 py-3 text-gray-600">{order.customer_name || 'Khách lẻ'}</td>
                  <td className="px-4 py-3 text-gray-600">{order.cashier_name}</td>
                  <td className="px-4 py-3 font-semibold text-gray-950">{formatCurrency(order.total)}</td>
                  <td className="px-4 py-3 text-gray-600">{paymentLabels[order.payment_method]}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        order.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {order.status === 'completed' ? 'Hoàn tất' : 'Đã hủy'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(order.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => viewOrder(order)}
                        className="rounded-lg p-2 text-gray-500 transition hover:bg-sky-50 hover:text-sky-700"
                        title="Xem"
                        aria-label="Xem"
                      >
                        <Eye size={17} />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(order)}
                        className="rounded-lg p-2 text-gray-500 transition hover:bg-indigo-50 hover:text-indigo-700"
                        title="Sửa"
                        aria-label="Sửa"
                      >
                        <Edit size={17} />
                      </button>
                      <button
                        type="button"
                        onClick={() => cancelOrder(order)}
                        className="rounded-lg p-2 text-gray-500 transition hover:bg-red-50 hover:text-red-600"
                        title="Hủy"
                        aria-label="Hủy"
                      >
                        <XCircle size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Modal isOpen={Boolean(selectedOrder)} onClose={() => setSelectedOrder(null)} title="Chi tiết đơn hàng">
        {selectedOrder && (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-lg bg-gray-50 p-4 text-sm md:grid-cols-2">
              <div>
                <span className="text-gray-500">Mã đơn</span>
                <div className="font-semibold text-gray-950">{selectedOrder.order_number}</div>
              </div>
              <div>
                <span className="text-gray-500">Khách hàng</span>
                <div className="font-semibold text-gray-950">{selectedOrder.customer_name || 'Khách lẻ'}</div>
              </div>
              <div>
                <span className="text-gray-500">Thu ngân</span>
                <div className="font-semibold text-gray-950">{selectedOrder.cashier_name}</div>
              </div>
              <div>
                <span className="text-gray-500">Ngày tạo</span>
                <div className="font-semibold text-gray-950">{formatDate(selectedOrder.created_at)}</div>
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
          </div>
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-indigo-600"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-indigo-600"
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
                className="min-h-28 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-indigo-600"
              />
            </label>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={closeEdit} className="rounded-lg border border-gray-300 px-4 py-2 font-medium">
                Hủy
              </button>
              <button type="submit" className="rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800">
                Lưu
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
