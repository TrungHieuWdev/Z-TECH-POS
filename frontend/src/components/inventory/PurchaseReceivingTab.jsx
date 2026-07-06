import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { BrainCircuit, ClipboardList, Eye, Plus, Save, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import Modal from '../Modal';
import { formatCurrency } from '../../utils/format';
import RestockSuggestionTab from './restock/RestockSuggestionTab';

const emptyItem = { product_id: '', quantity: 1, import_price: 0 };

function createInitialItems(suggestedItems) {
  return suggestedItems?.length ? suggestedItems : [{ ...emptyItem }];
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString('vi-VN') : '-';
}

export default function PurchaseReceivingTab({ restockSuggestions, suggestedItems = null, canManage = false, onCreated, onSuggestedItemsConsumed }) {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [items, setItems] = useState(() => createInitialItems(suggestedItems));
  const [note, setNote] = useState(suggestedItems?.length ? 'Tạo từ AI gợi ý nhập hàng' : '');
  const [isFormOpen, setIsFormOpen] = useState(Boolean(suggestedItems?.length));
  const [activeSection, setActiveSection] = useState('orders');
  const [detailOrder, setDetailOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [ordersResponse, suppliersResponse, productsResponse] = await Promise.all([
      api.get('/purchase-orders'),
      api.get('/suppliers'),
      api.get('/products')
    ]);
    setOrders(ordersResponse.data);
    setSuppliers(suppliersResponse.data.filter((item) => item.status === 'active'));
    setProducts(productsResponse.data);
  }

  useEffect(() => {
    load().catch(() => toast.error('Không thể tải dữ liệu nhập hàng'));
  }, []);

  useEffect(() => {
    if (!suggestedItems?.length) return;
    setItems(createInitialItems(suggestedItems));
    setNote('Tạo từ AI gợi ý nhập hàng');
    setIsFormOpen(true);
    setActiveSection('orders');
    onSuggestedItemsConsumed?.();
  }, [suggestedItems, onSuggestedItemsConsumed]);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.import_price || 0), 0),
    [items]
  );

  const totalAmount = useMemo(
    () => orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
    [orders]
  );

  const updateItem = (index, field, value) => {
    setItems((rows) => rows.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )));
  };

  const resetForm = () => {
    setSupplierId('');
    setItems([{ ...emptyItem }]);
    setNote('');
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

    setSaving(true);
    try {
      await api.post('/purchase-orders', {
        supplier_id: Number(supplierId),
        note,
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

  const form = (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold text-gray-700">
          Nhà cung cấp
          <select required value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className="mt-1 h-11 w-full border border-gray-300 bg-white px-3 outline-none focus:border-[#69afd6]">
            <option value="">Chọn nhà cung cấp</option>
            {suppliers.map((item) => <option key={item.id} value={item.id}>{item.name || item.supplier_name}</option>)}
          </select>
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
            <input required min="1" type="number" value={item.import_price} onChange={(event) => updateItem(index, 'import_price', event.target.value)} className={`h-11 border px-3 outline-none focus:border-[#69afd6] ${Number(item.import_price) <= 0 ? 'border-amber-400 bg-amber-50' : 'border-gray-300 bg-white'}`} title="Giá nhập" placeholder="Nhập giá nhập" />
            <button type="button" title="Xóa dòng" onClick={() => setItems((rows) => rows.length === 1 ? rows : rows.filter((_, itemIndex) => itemIndex !== index))} className="grid h-11 place-items-center text-red-600 hover:bg-red-50">
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4">
        <button type="button" onClick={() => setItems((rows) => [...rows, { ...emptyItem }])} className="inline-flex h-10 items-center gap-2 border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          <Plus size={17} />Thêm sản phẩm
        </button>
        <div className="flex flex-wrap items-center gap-4">
          <div className="text-right">
            <p className="text-xs font-bold uppercase text-gray-500">Tổng tiền</p>
            <strong className="text-xl text-gray-950">{formatCurrency(total)}</strong>
          </div>
          <button disabled={saving} className="inline-flex h-10 items-center gap-2 bg-brand px-5 text-sm font-bold text-white disabled:opacity-50">
            <Save size={17} />{saving ? 'Đang lưu' : 'Tạo phiếu nhập'}
          </button>
        </div>
      </div>
    </form>
  );

  return (
    <div className="space-y-4">
      {suggestedItems?.length > 0 && (
        <div className="border-l-4 border-sky-500 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          Đã thêm {suggestedItems.length} sản phẩm từ gợi ý nhập hàng. Hãy chọn nhà cung cấp, kiểm tra số lượng và bổ sung giá nhập còn thiếu trước khi tạo phiếu.
        </div>
      )}

      <section className="border border-gray-200 bg-white shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
          <div className="inline-flex border border-gray-200 bg-gray-50 p-1">
            <button type="button" onClick={() => setActiveSection('orders')} className={`inline-flex h-9 items-center gap-2 px-3 text-sm font-bold ${activeSection === 'orders' ? 'bg-white text-sky-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
              <ClipboardList size={16} /> Phiếu nhập
            </button>
            <button type="button" onClick={() => setActiveSection('ai')} className={`inline-flex h-9 items-center gap-2 px-3 text-sm font-bold ${activeSection === 'ai' ? 'bg-white text-sky-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
              <BrainCircuit size={16} /> AI gợi ý
            </button>
          </div>

          {activeSection === 'orders' && canManage && (
            <button type="button" onClick={() => setIsFormOpen(true)} className="inline-flex h-10 items-center gap-2 bg-[#69afd6] px-4 text-sm font-bold text-white hover:bg-[#579fc8]">
              <Plus size={17} /> Tạo phiếu nhập mới
            </button>
          )}
        </header>

        {activeSection === 'orders' ? (
          <>
            <div className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(260px,1fr)_180px_220px]">
              <div>
                <h2 className="text-lg font-extrabold text-gray-950">Phiếu nhập hàng</h2>
                <p className="mt-1 text-sm text-gray-500">Theo dõi lịch sử nhập và tạo phiếu mới khi cần bổ sung tồn kho.</p>
              </div>
              <div className="border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-xs font-bold uppercase text-gray-500">Tổng phiếu</p>
                <p className="mt-1 text-xl font-extrabold text-gray-950">{orders.length.toLocaleString('vi-VN')}</p>
              </div>
              <div className="border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-xs font-bold uppercase text-gray-500">Giá trị đã nhập</p>
                <p className="mt-1 text-xl font-extrabold text-gray-950">{formatCurrency(totalAmount)}</p>
              </div>
            </div>

            <div className="overflow-x-auto border-t border-gray-100">
              <table className="w-full min-w-[940px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Mã phiếu</th>
                    <th className="px-4 py-3 font-semibold">Nhà cung cấp</th>
                    <th className="px-4 py-3 font-semibold">Người tạo</th>
                    <th className="px-4 py-3 text-right font-semibold">Tổng tiền</th>
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
          </>
        ) : canManage ? (
          <div className="border-t border-gray-100">
            <RestockSuggestionTab analysis={restockSuggestions} />
          </div>
        ) : (
          <div className="border-t border-gray-100 px-4 py-6 text-sm text-gray-500">
            Tài khoản hiện tại chỉ có quyền xem lịch sử phiếu nhập.
          </div>
        )}
      </section>

      <Modal isOpen={isFormOpen} onClose={closeForm} title="Tạo phiếu nhập mới" maxWidth="max-w-5xl">
        {form}
      </Modal>

      <Modal isOpen={Boolean(detailOrder)} onClose={() => setDetailOrder(null)} title="Chi tiết phiếu nhập" maxWidth="max-w-5xl">
        {detailOrder && (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="border border-gray-200 p-3">
                <p className="text-xs font-bold uppercase text-gray-500">Ngày tạo</p>
                <p className="mt-1 text-sm font-semibold text-gray-800">{formatDateTime(detailOrder.created_at)}</p>
              </div>
              <div className="border border-gray-200 p-3">
                <p className="text-xs font-bold uppercase text-gray-500">Trạng thái</p>
                <p className="mt-1 text-sm font-semibold text-emerald-700">{detailOrder.status || 'completed'}</p>
              </div>
              <div className="border border-gray-200 p-3">
                <p className="text-xs font-bold uppercase text-gray-500">Ghi chú</p>
                <p className="mt-1 text-sm font-semibold text-gray-800">{detailOrder.note || '-'}</p>
              </div>
            </div>

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
