import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Edit, Plus, Search, Trash2 } from 'lucide-react';
import api from '../api/axios';
import Modal from '../components/Modal';
import { formatDate } from '../utils/format';

const initialForm = { name: '', description: '' };

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(initialForm);
  const [editingCategory, setEditingCategory] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  async function loadCategories() {
    const response = await api.get('/categories');
    setCategories(response.data);
  }

  useEffect(() => {
    loadCategories();
  }, []);

  const filteredCategories = useMemo(() => {
    const keyword = search.toLowerCase();
    return categories.filter((category) => category.name.toLowerCase().includes(keyword));
  }, [categories, search]);

  const openCreate = () => {
    setEditingCategory(null);
    setForm(initialForm);
    setIsOpen(true);
  };

  const openEdit = (category) => {
    setEditingCategory(category);
    setForm({ name: category.name, description: category.description || '' });
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setEditingCategory(null);
    setForm(initialForm);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      if (editingCategory) {
        await api.put(`/categories/${editingCategory.id}`, form);
        toast.success('Đã cập nhật danh mục');
      } else {
        await api.post('/categories', form);
        toast.success('Đã thêm danh mục');
      }

      closeModal();
      await loadCategories();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể lưu danh mục');
    }
  };

  const handleDelete = async (category) => {
    if (!window.confirm(`Xóa danh mục "${category.name}"?`)) {
      return;
    }

    try {
      await api.delete(`/categories/${category.id}`);
      toast.success('Đã xóa danh mục');
      await loadCategories();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể xóa danh mục');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-950">Danh mục</h1>
          <p className="mt-1 text-sm text-gray-500">Nhóm sản phẩm theo loại phụ kiện</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-[#74B8E0] px-4 py-2.5 font-semibold text-white transition hover:bg-[#74B8E0] active:bg-[#74B8E0]"
        >
          <Plus size={18} />
          <span>Thêm danh mục</span>
        </button>
      </div>

      <div className="rounded-lg bg-white p-4 shadow-sm">
        <div className="flex max-w-xl items-center gap-2 rounded-lg border border-gray-300 px-3 py-2">
          <Search size={18} className="text-gray-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full outline-none"
            placeholder="Tìm danh mục"
          />
        </div>
      </div>

      <section className="rounded-lg bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Tên</th>
                <th className="px-4 py-3 font-semibold">Mô tả</th>
                <th className="px-4 py-3 font-semibold">Ngày tạo</th>
                <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredCategories.map((category) => (
                <tr key={category.id}>
                  <td className="px-4 py-3 font-medium text-gray-950">{category.name}</td>
                  <td className="px-4 py-3 text-gray-600">{category.description}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(category.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(category)}
                        className="rounded-lg p-2 text-gray-500 transition hover:bg-brand-surface hover:text-brand-strong"
                        title="Sửa"
                        aria-label="Sửa"
                      >
                        <Edit size={17} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(category)}
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

      <Modal isOpen={isOpen} onClose={closeModal} title={editingCategory ? 'Sửa danh mục' : 'Thêm danh mục'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Tên danh mục</span>
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Mô tả</span>
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
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
