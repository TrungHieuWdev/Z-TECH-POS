import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { PackagePlus, RotateCcw, Search } from 'lucide-react';
import api from '../api/axios';
import Modal from '../components/Modal';
import { formatDate } from '../utils/format';
import { getUser, isFullAccessRole } from '../utils/auth';

const initialForm = { product_id: '', quantity: '', note: '' };

export default function Inventory() {
  const hasFullAccess = isFullAccessRole(getUser()?.role);
  const [logs, setLogs] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
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

  const filteredLogs = useMemo(() => {
    const keyword = search.toLowerCase();

    return logs.filter((log) =>
      [log.product_name, log.user_name, log.note]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(keyword))
    );
  }, [logs, search]);

  const openModal = (nextMode) => {
    setMode(nextMode);
    setForm(initialForm);
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
      quantity: Number(form.quantity)
    };

    try {
      if (mode === 'in') {
        await api.post('/inventory/add', payload);
        toast.success('Đã nhập kho');
      } else {
        await api.put('/inventory/adjust', payload);
        toast.success('Đã điều chỉnh kho');
      }

      closeModal();
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể lưu kho');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-950">Kho hàng</h1>
          <p className="mt-1 text-sm text-gray-500">Lịch sử nhập và điều chỉnh tồn kho</p>
        </div>
        <div className="flex flex-wrap gap-2" style={{ display: hasFullAccess ? undefined : 'none' }} title={hasFullAccess ? '' : 'Bạn không có quyền thực hiện thao tác này'}>
          <button
            type="button"
            onClick={() => openModal('in')}
            className="flex items-center gap-2 rounded-lg bg-[#74B8E0] px-4 py-2.5 font-semibold text-white transition hover:bg-[#74B8E0] active:bg-[#74B8E0]"
          >
            <PackagePlus size={18} />
            <span>Nhập kho</span>
          </button>
          <button
            type="button"
            onClick={() => openModal('adjust')}
            className="flex items-center gap-2 rounded-lg border border-[#BFE3F5] bg-white px-4 py-2.5 font-semibold text-[#5EAED9] transition hover:bg-brand-surface active:bg-brand-soft"
          >
            <RotateCcw size={18} />
            <span>Điều chỉnh</span>
          </button>
        </div>
      </div>

      <div className="rounded-lg bg-white p-4 shadow-sm">
        <div className="flex max-w-xl items-center gap-2 rounded-lg border border-gray-300 px-3 py-2">
          <Search size={18} className="text-gray-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full outline-none"
            placeholder="Tìm sản phẩm, nhân viên, ghi chú"
          />
        </div>
      </div>

      <section className="rounded-lg bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Sản phẩm</th>
                <th className="px-4 py-3 font-semibold">Nhân viên</th>
                <th className="px-4 py-3 font-semibold">Loại</th>
                <th className="px-4 py-3 font-semibold">Số lượng</th>
                <th className="px-4 py-3 font-semibold">Ghi chú</th>
                <th className="px-4 py-3 font-semibold">Ngày tạo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-3 font-medium text-gray-950">{log.product_name}</td>
                  <td className="px-4 py-3 text-gray-600">{log.user_name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        log.type === 'in'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {log.type === 'in' ? 'Nhập' : 'Điều chỉnh'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-950">{log.quantity}</td>
                  <td className="px-4 py-3 text-gray-600">{log.note}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(log.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Modal isOpen={isOpen} onClose={closeModal} title={mode === 'in' ? 'Nhập kho' : 'Điều chỉnh tồn kho'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Sản phẩm</span>
            <select
              value={form.product_id}
              onChange={(event) => setForm({ ...form, product_id: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
              required
            >
              <option value="">Chọn sản phẩm</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} - tồn {product.stock_quantity}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              {mode === 'in' ? 'Số lượng nhập' : 'Tồn kho mới'}
            </span>
            <input
              type="number"
              min={mode === 'in' ? 1 : 0}
              value={form.quantity}
              onChange={(event) => setForm({ ...form, quantity: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
              required
            />
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
            <button type="button" onClick={closeModal} className="rounded-lg border border-gray-300 px-4 py-2 font-medium">
              Hủy
            </button>
            <button type="submit" className="rounded-lg bg-brand px-4 py-2 font-semibold text-brand-ink hover:bg-brand-muted">
              Lưu
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
