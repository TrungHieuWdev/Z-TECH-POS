import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Save, Trash2 } from 'lucide-react';
import api from '../api/axios';
import { formatCurrency } from '../utils/format';

const emptyItem = { product_id: '', quantity: 1, import_price: 0 };

export default function PurchaseOrders() {
  const location = useLocation();
  const suggestedItems = location.state?.source === 'restock-suggestions' ? location.state.suggestedItems : null;
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [items, setItems] = useState(() => suggestedItems?.length ? suggestedItems : [{ ...emptyItem }]);
  const [note, setNote] = useState(suggestedItems?.length ? 'Tạo từ AI gợi ý nhập hàng' : '');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [ordersResponse, suppliersResponse, productsResponse] = await Promise.all([
      api.get('/purchase-orders'), api.get('/suppliers'), api.get('/products')
    ]);
    setOrders(ordersResponse.data);
    setSuppliers(suppliersResponse.data.filter((item) => item.status === 'active'));
    setProducts(productsResponse.data);
  };
  useEffect(() => { load().catch(() => toast.error('Không thể tải dữ liệu nhập hàng')); }, []);

  const total = useMemo(() => items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.import_price || 0), 0), [items]);
  const updateItem = (index, field, value) => setItems((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  const submit = async (event) => {
    event.preventDefault();
    if (items.some((item) => Number(item.import_price) <= 0)) return toast.error('Vui lòng bổ sung giá nhập hợp lệ cho tất cả sản phẩm.');
    setSaving(true);
    try {
      await api.post('/purchase-orders', { supplier_id: Number(supplierId), note, items: items.map((item) => ({ ...item, product_id: Number(item.product_id), quantity: Number(item.quantity), import_price: Number(item.import_price) })) });
      toast.success('Đã tạo phiếu nhập và cập nhật tồn kho');
      setItems([{ ...emptyItem }]); setNote(''); await load();
    } catch (error) { toast.error(error.response?.data?.message || 'Không thể tạo phiếu nhập'); }
    finally { setSaving(false); }
  };

  return <div className="space-y-6"><header><h1 className="text-2xl font-extrabold text-gray-950">Phiếu nhập hàng</h1><p className="mt-1 text-sm text-gray-500">Nhập hàng và cập nhật tồn kho trong cùng một giao dịch.</p></header>
    {suggestedItems?.length > 0 && <div className="border-l-4 border-sky-500 bg-sky-50 px-4 py-3 text-sm text-sky-900">Đã thêm {suggestedItems.length} sản phẩm từ gợi ý nhập hàng. Hãy chọn nhà cung cấp, kiểm tra số lượng và bổ sung giá nhập còn thiếu trước khi tạo phiếu.</div>}
    <form onSubmit={submit} className="space-y-4 border-y border-gray-200 bg-white py-5"><div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-semibold">Nhà cung cấp<select required value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="mt-1 h-10 w-full rounded border px-3"><option value="">Chọn nhà cung cấp</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.name || item.supplier_name}</option>)}</select></label><label className="text-sm font-semibold">Ghi chú<input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 h-10 w-full rounded border px-3" /></label></div>
    <div className="space-y-2">{items.map((item, index) => <div key={`${item.product_id}-${index}`} className="grid gap-2 md:grid-cols-[1fr_120px_160px_40px]"><select required value={item.product_id} onChange={(e) => updateItem(index, 'product_id', e.target.value)} className="h-10 rounded border px-3"><option value="">Chọn sản phẩm</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select><input required min="1" type="number" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} className="h-10 rounded border px-3" title="Số lượng" /><input required min="1" type="number" value={item.import_price} onChange={(e) => updateItem(index, 'import_price', e.target.value)} className={`h-10 rounded border px-3 ${Number(item.import_price) <= 0 ? 'border-amber-400 bg-amber-50' : ''}`} title="Giá nhập" placeholder="Nhập giá nhập" /><button type="button" title="Xóa dòng" onClick={() => setItems((rows) => rows.length === 1 ? rows : rows.filter((_, itemIndex) => itemIndex !== index))} className="grid h-10 place-items-center text-red-600"><Trash2 size={18} /></button></div>)}</div>
    <div className="flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={() => setItems((rows) => [...rows, { ...emptyItem }])} className="inline-flex items-center gap-2 rounded border px-4 py-2 font-semibold"><Plus size={17} />Thêm sản phẩm</button><div className="flex items-center gap-4"><strong>{formatCurrency(total)}</strong><button disabled={saving} className="inline-flex items-center gap-2 rounded bg-brand px-5 py-2 font-bold text-white disabled:opacity-50"><Save size={17} />{saving ? 'Đang lưu' : 'Tạo phiếu nhập'}</button></div></div></form>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b"><tr><th className="p-3">Mã phiếu</th><th>Nhà cung cấp</th><th>Người tạo</th><th>Tổng tiền</th><th>Ngày tạo</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} className="border-b"><td className="p-3 font-bold">{order.purchase_code}</td><td>{order.supplier_name}</td><td>{order.created_by_name}</td><td>{formatCurrency(order.total_amount)}</td><td>{new Date(order.created_at).toLocaleString('vi-VN')}</td></tr>)}</tbody></table></div>
  </div>;
}
