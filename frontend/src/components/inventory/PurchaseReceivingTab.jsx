import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Banknote, CalendarDays, CreditCard, Eye, Plus, Save, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import Modal from '../Modal';
import { formatCurrency } from '../../utils/format';
import CurrencyInput from '../CurrencyInput';

const emptyItem = { product_id: '', quantity: 1, import_price: 0 };

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString('vi-VN') : '-';
}

function formatDate(value) {
  if (!value) return 'Chưa đặt hạn';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

function getPaymentMeta(status) {
  if (status === 'paid') return { label: 'Đã thanh toán', className: 'bg-emerald-50 text-emerald-700' };
  if (status === 'partial') return { label: 'Thanh toán một phần', className: 'bg-amber-50 text-amber-700' };
  return { label: 'Chưa thanh toán', className: 'bg-rose-50 text-rose-700' };
}

function getPaymentMethodLabel(method) {
  if (method === 'cash') return 'Tiền mặt';
  if (method === 'transfer') return 'Chuyển khoản';
  if (method === 'other') return 'Khác';
  return 'Chưa ghi nhận';
}

export default function PurchaseReceivingTab({ preferredSupplierId = null, canManage = false, onCreated }) {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [note, setNote] = useState('');
  const [paymentMode, setPaymentMode] = useState('paid');
  const [paidAmountInput, setPaidAmountInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('transfer');
  const [dueDate, setDueDate] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paymentRecord, setPaymentRecord] = useState({ amount: '', method: 'transfer', dueDate: '' });
  const [paymentSaving, setPaymentSaving] = useState(false);

  async function load() {
    const [ordersResponse, suppliersResponse, productsResponse] = await Promise.all([
      api.get('/purchase-orders'),
      api.get('/suppliers'),
      api.get('/products')
    ]);
    setOrders(ordersResponse.data);
    setSuppliers(suppliersResponse.data.filter((item) => item.status !== 'inactive'));
    setProducts(productsResponse.data);
  }

  useEffect(() => {
    load().catch(() => toast.error('Không thể tải dữ liệu nhập hàng'));
  }, []);

  useEffect(() => {
    if (!preferredSupplierId) return;
    setSupplierId(String(preferredSupplierId));
    setIsFormOpen(true);
  }, [preferredSupplierId]);

  const selectedSupplier = suppliers.find((item) => String(item.id) === String(supplierId));

  const total = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.import_price || 0), 0),
    [items]
  );
  const paidAmount = paymentMode === 'paid'
    ? total
    : paymentMode === 'unpaid'
      ? 0
      : Math.max(0, Number(paidAmountInput || 0));
  const debtAmount = Math.max(total - paidAmount, 0);

  const updateItem = (index, field, value) => {
    setItems((rows) => rows.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )));
  };

  const resetForm = () => {
    setSupplierId('');
    setItems([{ ...emptyItem }]);
    setNote('');
    setPaymentMode('paid');
    setPaidAmountInput('');
    setPaymentMethod('transfer');
    setDueDate('');
  };

  const closeForm = () => {
    if (saving) return;
    setIsFormOpen(false);
  };

  const openDetail = async (order) => {
    setDetailLoading(true);
    setDetailOrder({ ...order, items: [] });
    try {
      const response = await api.get(`/purchase-orders/${order.id}`);
      setDetailOrder(response.data);
      setPaymentRecord({ amount: '', method: 'transfer', dueDate: response.data.due_date?.slice(0, 10) || '' });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể tải chi tiết phiếu nhập');
      setDetailOrder(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (items.some((item) => Number(item.import_price) <= 0)) {
      toast.error('Vui lòng bổ sung giá nhập hợp lệ cho tất cả sản phẩm.');
      return;
    }
    if (paymentMode === 'partial' && (paidAmount <= 0 || paidAmount >= total)) {
      toast.error('Tiền đã thanh toán một phần phải lớn hơn 0 và nhỏ hơn tổng tiền.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/purchase-orders', {
        supplier_id: Number(supplierId),
        note,
        paid_amount: paidAmount,
        payment_method: paidAmount > 0 ? paymentMethod : null,
        due_date: debtAmount > 0 ? dueDate || null : null,
        items: items.map((item) => ({
          ...item,
          product_id: Number(item.product_id),
          quantity: Number(item.quantity),
          import_price: Number(item.import_price)
        }))
      });
      toast.success('Đã tạo phiếu nhập và cập nhật tồn kho');
      resetForm();
      setIsFormOpen(false);
      await load();
      onCreated?.();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể tạo phiếu nhập');
    } finally {
      setSaving(false);
    }
  };

  const recordAdditionalPayment = async (event) => {
    event.preventDefault();
    if (!detailOrder || paymentSaving) return;
    const additionalAmount = Number(paymentRecord.amount || 0);
    const currentDebt = Number(detailOrder.debt_amount || 0);
    if (!Number.isFinite(additionalAmount) || additionalAmount <= 0 || additionalAmount > currentDebt) {
      toast.error('Số tiền trả thêm phải lớn hơn 0 và không vượt quá số tiền còn nợ.');
      return;
    }

    setPaymentSaving(true);
    try {
      await api.patch(`/purchase-orders/${detailOrder.id}/payment`, {
        paid_amount: Number(detailOrder.paid_amount || 0) + additionalAmount,
        payment_method: paymentRecord.method,
        due_date: additionalAmount < currentDebt ? paymentRecord.dueDate || detailOrder.due_date || null : null
      });
      const response = await api.get(`/purchase-orders/${detailOrder.id}`);
      setDetailOrder(response.data);
      setPaymentRecord((current) => ({ ...current, amount: '', dueDate: response.data.due_date?.slice(0, 10) || '' }));
      await load();
      onCreated?.();
      toast.success('Đã ghi nhận thanh toán công nợ');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể cập nhật thanh toán');
    } finally {
      setPaymentSaving(false);
    }
  };

  const form = (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold text-gray-700">
          Nhà cung cấp
          <select required value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className="mt-1 h-11 w-full border border-gray-300 bg-white px-3 outline-none focus:border-[#69afd6]">
            <option value="">Chọn nhà cung cấp</option>
            {suppliers.map((item) => <option key={item.id} value={item.id}>{item.name || item.supplier_name}{item.status === 'paused' ? ' (Tạm ngừng)' : ''}</option>)}
          </select>
          {selectedSupplier?.status === 'paused' && <p className="mt-1 text-xs font-medium text-amber-700">Nhà cung cấp này đang tạm ngừng hợp tác. Hãy kiểm tra trước khi tạo phiếu nhập.</p>}
        </label>
        <label className="text-sm font-semibold text-gray-700">
          Ghi chú
          <input value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 h-11 w-full border border-gray-300 bg-white px-3 outline-none focus:border-[#69afd6]" />
        </label>
      </div>

      <div className="space-y-2">
        <div className="hidden grid-cols-[1fr_120px_160px_40px] gap-2 px-1 text-xs font-bold uppercase text-gray-500 md:grid">
          <span>Sản phẩm</span>
          <span>Số lượng</span>
          <span>Giá nhập</span>
          <span />
        </div>
        {items.map((item, index) => (
          <div key={`${item.product_id}-${index}`} className="grid gap-2 md:grid-cols-[1fr_120px_160px_40px]">
            <select required value={item.product_id} onChange={(event) => updateItem(index, 'product_id', event.target.value)} className="h-11 min-w-0 border border-gray-300 bg-white px-3 outline-none focus:border-[#69afd6]">
              <option value="">Chọn sản phẩm</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
            <input required min="1" type="number" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} className="h-11 border border-gray-300 bg-white px-3 outline-none focus:border-[#69afd6]" title="Số lượng" />
            <CurrencyInput required min="1" value={item.import_price} onValueChange={(value) => updateItem(index, 'import_price', value)} className={`h-11 border px-3 outline-none focus:border-[#69afd6] ${Number(item.import_price) <= 0 ? 'border-amber-400 bg-amber-50' : 'border-gray-300 bg-white'}`} title="Giá nhập" placeholder="Nhập giá nhập" />
            <button type="button" title="Xóa dòng" onClick={() => setItems((rows) => rows.length === 1 ? rows : rows.filter((_, itemIndex) => itemIndex !== index))} className="grid h-11 place-items-center text-red-600 hover:bg-red-50">
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>

      <section className="border border-[#d7eef3] bg-[#f8fdfe] p-4">
        <div className="mb-4 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center bg-white text-[#159bb5] shadow-sm"><CreditCard size={18} /></span>
          <div>
            <h3 className="font-extrabold text-gray-950">Thanh toán nhà cung cấp</h3>
            <p className="text-xs text-gray-500">Nhập số tiền đã trả; hệ thống tự tính công nợ còn lại.</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-semibold text-gray-700">
            Tình trạng thanh toán
            <select value={paymentMode} onChange={(event) => setPaymentMode(event.target.value)} className="mt-1 h-11 w-full border border-gray-300 bg-white px-3 outline-none focus:border-[#69afd6]">
              <option value="paid">Thanh toán đủ</option>
              <option value="partial">Thanh toán một phần</option>
              <option value="unpaid">Chưa thanh toán</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-gray-700">
            Đã thanh toán
            <CurrencyInput
              min="0"
              max={total}
              value={paymentMode === 'partial' ? paidAmountInput : paidAmount}
              onValueChange={setPaidAmountInput}
              readOnly={paymentMode !== 'partial'}
              className={`mt-1 h-11 w-full border px-3 outline-none focus:border-[#69afd6] ${paymentMode === 'partial' ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-100 text-gray-500'}`}
            />
          </label>
          <label className="text-sm font-semibold text-gray-700">
            Phương thức
            <select disabled={paidAmount <= 0} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="mt-1 h-11 w-full border border-gray-300 bg-white px-3 outline-none focus:border-[#69afd6] disabled:bg-gray-100 disabled:text-gray-400">
              <option value="transfer">Chuyển khoản</option>
              <option value="cash">Tiền mặt</option>
              <option value="other">Khác</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-gray-700">
            Hạn thanh toán
            <input disabled={debtAmount <= 0} type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-1 h-11 w-full border border-gray-300 bg-white px-3 outline-none focus:border-[#69afd6] disabled:bg-gray-100 disabled:text-gray-400" />
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="border border-sky-100 bg-white p-3">
            <p className="text-xs font-bold uppercase text-gray-500">Tổng tiền</p>
            <p className="mt-1 text-lg font-extrabold text-gray-950">{formatCurrency(total)}</p>
          </div>
          <div className="border border-emerald-100 bg-white p-3">
            <p className="text-xs font-bold uppercase text-emerald-600">Đã thanh toán</p>
            <p className="mt-1 text-lg font-extrabold text-emerald-700">{formatCurrency(paidAmount)}</p>
          </div>
          <div className={`border bg-white p-3 ${debtAmount > 0 ? 'border-rose-200' : 'border-gray-100'}`}>
            <p className={`text-xs font-bold uppercase ${debtAmount > 0 ? 'text-rose-600' : 'text-gray-500'}`}>Còn nợ</p>
            <p className={`mt-1 text-lg font-extrabold ${debtAmount > 0 ? 'text-rose-700' : 'text-gray-700'}`}>{formatCurrency(debtAmount)}</p>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4">
        <button type="button" onClick={() => setItems((rows) => [...rows, { ...emptyItem }])} className="inline-flex h-10 items-center gap-2 border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          <Plus size={17} />Thêm sản phẩm
        </button>
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" onClick={closeForm} disabled={saving} className="inline-flex h-10 items-center border border-gray-300 bg-white px-5 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            Hủy
          </button>
          <button disabled={saving} className="inline-flex h-10 items-center gap-2 bg-brand px-5 text-sm font-bold text-white disabled:opacity-50">
            <Save size={17} />{saving ? 'Đang lưu' : 'Tạo phiếu nhập'}
          </button>
        </div>
      </div>
    </form>
  );

  return (
    <div className="space-y-4">
      <section className="border border-gray-200 bg-white shadow-sm">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 px-4 py-4">
          <div>
            <h2 className="text-lg font-extrabold text-gray-950">Lịch sử nhập hàng</h2>
            <p className="mt-1 text-sm text-gray-500">Theo dõi các phiếu nhập đã tạo và lượng hàng đã bổ sung vào kho.</p>
          </div>
          {canManage && (
            <button type="button" onClick={() => setIsFormOpen(true)} className="inline-flex h-10 items-center gap-2 bg-[#69afd6] px-4 text-sm font-bold text-white hover:bg-[#579fc8]">
              <Plus size={17} /> Tạo phiếu nhập mới
            </button>
          )}
        </header>

        <div className="overflow-x-auto">
              <table className="w-full min-w-[1280px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Mã phiếu</th>
                    <th className="px-4 py-3 font-semibold">Nhà cung cấp</th>
                    <th className="px-4 py-3 font-semibold">Người tạo</th>
                    <th className="px-4 py-3 text-right font-semibold">Tổng tiền</th>
                    <th className="px-4 py-3 text-right font-semibold">Đã trả</th>
                    <th className="px-4 py-3 text-right font-semibold">Còn nợ</th>
                    <th className="px-4 py-3 font-semibold">Thanh toán</th>
                    <th className="px-4 py-3 font-semibold">Ngày tạo</th>
                    <th className="px-4 py-3 text-center font-semibold">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50/70">
                      <td className="px-4 py-3 font-bold text-gray-950">{order.purchase_code}</td>
                      <td className="px-4 py-3 text-gray-600">{order.supplier_name}</td>
                      <td className="px-4 py-3 text-gray-600">{order.created_by_name}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-950">{formatCurrency(order.total_amount)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-700">{formatCurrency(order.paid_amount)}</td>
                      <td className={`px-4 py-3 text-right font-bold ${Number(order.debt_amount || 0) > 0 ? 'text-rose-700' : 'text-gray-400'}`}>{formatCurrency(order.debt_amount)}</td>
                      <td className="px-4 py-3"><span className={`inline-flex whitespace-nowrap px-2.5 py-1 text-xs font-bold ${getPaymentMeta(order.payment_status).className}`}>{getPaymentMeta(order.payment_status).label}</span></td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">{formatDateTime(order.created_at)}</td>
                      <td className="px-4 py-3 text-center">
                        <button type="button" onClick={() => openDetail(order)} className="inline-flex h-9 items-center gap-2 border border-sky-200 bg-white px-3 text-xs font-bold text-sky-700 hover:bg-sky-50">
                          <Eye size={15} /> Xem chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
        </div>
        {orders.length === 0 && <div className="px-4 py-10 text-center text-sm text-gray-500">Chưa có phiếu nhập nào.</div>}
      </section>

      <Modal isOpen={isFormOpen} onClose={closeForm} title="Tạo phiếu nhập mới" maxWidth="max-w-5xl">
        {form}
      </Modal>

      <Modal
        isOpen={Boolean(detailOrder)}
        onClose={() => setDetailOrder(null)}
        title="Chi tiết phiếu nhập"
        showCloseButton
        maxWidth="max-w-5xl"
      >
        {detailOrder && (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div className="border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-bold uppercase text-gray-500">Mã phiếu</p>
                <p className="mt-1 font-extrabold text-gray-950">{detailOrder.purchase_code}</p>
              </div>
              <div className="border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-bold uppercase text-gray-500">Nhà cung cấp</p>
                <p className="mt-1 font-semibold text-gray-950">{detailOrder.supplier_name}</p>
              </div>
              <div className="border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-bold uppercase text-gray-500">Người tạo</p>
                <p className="mt-1 font-semibold text-gray-950">{detailOrder.created_by_name}</p>
              </div>
              <div className="border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-bold uppercase text-gray-500">Tổng tiền</p>
                <p className="mt-1 font-extrabold text-gray-950">{formatCurrency(detailOrder.total_amount)}</p>
              </div>
              <div className="border border-emerald-100 bg-emerald-50 p-3">
                <p className="text-xs font-bold uppercase text-emerald-600">Đã thanh toán</p>
                <p className="mt-1 font-extrabold text-emerald-700">{formatCurrency(detailOrder.paid_amount)}</p>
              </div>
              <div className={`border p-3 ${Number(detailOrder.debt_amount || 0) > 0 ? 'border-rose-200 bg-rose-50' : 'border-gray-200 bg-gray-50'}`}>
                <p className={`text-xs font-bold uppercase ${Number(detailOrder.debt_amount || 0) > 0 ? 'text-rose-600' : 'text-gray-500'}`}>Còn nợ</p>
                <p className={`mt-1 font-extrabold ${Number(detailOrder.debt_amount || 0) > 0 ? 'text-rose-700' : 'text-gray-700'}`}>{formatCurrency(detailOrder.debt_amount)}</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div className="border border-gray-200 p-3">
                <p className="text-xs font-bold uppercase text-gray-500">Ngày tạo</p>
                <p className="mt-1 text-sm font-semibold text-gray-800">{formatDateTime(detailOrder.created_at)}</p>
              </div>
              <div className="border border-gray-200 p-3">
                <p className="text-xs font-bold uppercase text-gray-500">Thanh toán</p>
                <span className={`mt-1 inline-flex px-2.5 py-1 text-xs font-bold ${getPaymentMeta(detailOrder.payment_status).className}`}>{getPaymentMeta(detailOrder.payment_status).label}</span>
              </div>
              <div className="border border-gray-200 p-3">
                <p className="text-xs font-bold uppercase text-gray-500">Phương thức</p>
                <p className="mt-1 text-sm font-semibold text-gray-800">{getPaymentMethodLabel(detailOrder.payment_method)}</p>
              </div>
              <div className="border border-gray-200 p-3">
                <p className="text-xs font-bold uppercase text-gray-500">Hạn thanh toán</p>
                <p className="mt-1 text-sm font-semibold text-gray-800">{formatDate(detailOrder.due_date)}</p>
              </div>
              <div className="border border-gray-200 p-3">
                <p className="text-xs font-bold uppercase text-gray-500">Ghi chú</p>
                <p className="mt-1 text-sm font-semibold text-gray-800">{detailOrder.note || '-'}</p>
              </div>
            </div>

            {canManage && Number(detailOrder.debt_amount || 0) > 0 && (
              <form onSubmit={recordAdditionalPayment} className="border border-amber-200 bg-amber-50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Banknote size={18} className="text-amber-700" />
                  <div>
                    <h3 className="font-extrabold text-gray-950">Ghi nhận trả công nợ</h3>
                    <p className="text-xs text-gray-600">Còn phải trả {formatCurrency(detailOrder.debt_amount)} cho nhà cung cấp.</p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
                  <label className="text-sm font-semibold text-gray-700">
                    Số tiền trả thêm
                    <CurrencyInput required min="1" max={Number(detailOrder.debt_amount || 0)} value={paymentRecord.amount} onValueChange={(value) => setPaymentRecord({ ...paymentRecord, amount: value })} className="mt-1 h-10 w-full border border-amber-200 bg-white px-3 outline-none focus:border-amber-500" />
                  </label>
                  <label className="text-sm font-semibold text-gray-700">
                    Phương thức
                    <select value={paymentRecord.method} onChange={(event) => setPaymentRecord({ ...paymentRecord, method: event.target.value })} className="mt-1 h-10 w-full border border-amber-200 bg-white px-3 outline-none focus:border-amber-500">
                      <option value="transfer">Chuyển khoản</option>
                      <option value="cash">Tiền mặt</option>
                      <option value="other">Khác</option>
                    </select>
                  </label>
                  <label className="text-sm font-semibold text-gray-700">
                    Hạn trả phần còn lại
                    <div className="relative mt-1">
                      <CalendarDays className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                      <input type="date" value={paymentRecord.dueDate} onChange={(event) => setPaymentRecord({ ...paymentRecord, dueDate: event.target.value })} className="h-10 w-full border border-amber-200 bg-white pl-9 pr-3 outline-none focus:border-amber-500" />
                    </div>
                  </label>
                  <button disabled={paymentSaving} className="inline-flex h-10 items-center justify-center gap-2 bg-amber-600 px-4 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50">
                    <Save size={16} />{paymentSaving ? 'Đang lưu' : 'Ghi nhận'}
                  </button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto border border-gray-200">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Sản phẩm</th>
                    <th className="px-4 py-3 font-semibold">SKU</th>
                    <th className="px-4 py-3 text-right font-semibold">Số lượng</th>
                    <th className="px-4 py-3 text-right font-semibold">Giá nhập</th>
                    <th className="px-4 py-3 text-right font-semibold">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {detailLoading ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-500">Đang tải chi tiết...</td></tr>
                  ) : detailOrder.items?.length ? detailOrder.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-semibold text-gray-950">{item.product_name}</td>
                      <td className="px-4 py-3 text-gray-600">{item.sku || '-'}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-950">{Number(item.quantity || 0).toLocaleString('vi-VN')}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(item.import_price)}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-950">{formatCurrency(item.subtotal)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-500">Phiếu nhập này chưa có sản phẩm.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
