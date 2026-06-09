import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Edit, Plus, Search, Trash2 } from 'lucide-react';
import api from '../api/axios';
import Modal from '../components/Modal';
import { formatDate } from '../utils/format';

const initialForm = { name: '', phone: '', email: '', address: '' };

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(initialForm);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  async function loadCustomers() {
    const params = new URLSearchParams();
    if (search) params.set('search', search);

    const response = await api.get(`/customers?${params.toString()}`);
    setCustomers(response.data);
  }

  useEffect(() => {
    loadCustomers();
  }, [search]);

  const openCreate = () => {
    setEditingCustomer(null);
    setForm(initialForm);
    setIsOpen(true);
  };

  const openEdit = (customer) => {
    setEditingCustomer(customer);
    setForm({
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || ''
    });
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setEditingCustomer(null);
    setForm(initialForm);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      if (editingCustomer) {
        await api.put(`/customers/${editingCustomer.id}`, form);
        toast.success('Đã cập nhật khách hàng');
      } else {
        await api.post('/customers', form);
        toast.success('Đã thêm khách hàng');
      }

      closeModal();
      await loadCustomers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể lưu khách hàng');
    }
  };

  const handleDelete = async (customer) => {
    if (!window.confirm(`Xóa khách hàng "${customer.name}"?`)) {
      return;
    }

    try {
      await api.delete(`/customers/${customer.id}`);
      toast.success('Đã xóa khách hàng');
      await loadCustomers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể xóa khách hàng');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-950">Khách hàng</h1>
          <p className="mt-1 text-sm text-gray-500">Thông tin khách mua tại cửa hàng</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2.5 font-semibold text-white transition hover:bg-indigo-800"
        >
          <Plus size={18} />
          <span>Thêm khách hàng</span>
        </button>
      </div>

      <div className="rounded-lg bg-white p-4 shadow-sm">
        <div className="flex max-w-xl items-center gap-2 rounded-lg border border-gray-300 px-3 py-2">
          <Search size={18} className="text-gray-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full outline-none"
            placeholder="Tìm tên hoặc số điện thoại"
          />
        </div>
      </div>

      <section className="rounded-lg bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Tên</th>
                <th className="px-4 py-3 font-semibold">Điện thoại</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Địa chỉ</th>
                <th className="px-4 py-3 font-semibold">Ngày tạo</th>
                <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td className="px-4 py-3 font-medium text-gray-950">{customer.name}</td>
                  <td className="px-4 py-3 text-gray-600">{customer.phone}</td>
                  <td className="px-4 py-3 text-gray-600">{customer.email}</td>
                  <td className="px-4 py-3 text-gray-600">{customer.address}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(customer.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(customer)}
                        className="rounded-lg p-2 text-gray-500 transition hover:bg-indigo-50 hover:text-indigo-700"
                        title="Sửa"
                        aria-label="Sửa"
                      >
                        <Edit size={17} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(customer)}
                        className="rounded-lg p-2 text-gray-500 transition hover:bg-red-50 hover:text-red-600"
                        title="Xóa"
                        aria-label="Xóa"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Modal isOpen={isOpen} onClose={closeModal} title={editingCustomer ? 'Sửa khách hàng' : 'Thêm khách hàng'}>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="mb-1 block text-sm font-medium text-gray-700">Tên khách hàng</span>
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-indigo-600"
              required
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Điện thoại</span>
            <input
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-indigo-600"
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-indigo-600"
            />
          </label>
          <label className="md:col-span-2">
            <span className="mb-1 block text-sm font-medium text-gray-700">Địa chỉ</span>
            <textarea
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
              className="min-h-24 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-indigo-600"
            />
          </label>
          <div className="flex justify-end gap-3 md:col-span-2">
            <button type="button" onClick={closeModal} className="rounded-lg border border-gray-300 px-4 py-2 font-medium">
              Hủy
            </button>
            <button type="submit" className="rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800">
              Lưu
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
