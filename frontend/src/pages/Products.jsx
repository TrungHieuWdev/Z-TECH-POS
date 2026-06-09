import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Edit, Plus, Search, Trash2 } from 'lucide-react';
import api from '../api/axios';
import Modal from '../components/Modal';
import { formatCurrency } from '../utils/format';

const initialForm = {
  category_id: '',
  name: '',
  description: '',
  price: '',
  cost_price: '',
  stock_quantity: 0,
  min_stock: 5,
  image_url: ''
};

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(initialForm);

  async function loadProducts() {
    const params = new URLSearchParams();

    if (search) params.set('search', search);
    if (categoryId) params.set('category_id', categoryId);

    const response = await api.get(`/products?${params.toString()}`);
    setProducts(response.data);
  }

  useEffect(() => {
    api.get('/categories').then((response) => setCategories(response.data));
  }, []);

  useEffect(() => {
    loadProducts();
  }, [search, categoryId]);

  const openCreate = () => {
    setEditingProduct(null);
    setForm(initialForm);
    setIsOpen(true);
  };

  const openEdit = (product) => {
    setEditingProduct(product);
    setForm({
      category_id: product.category_id || '',
      name: product.name || '',
      description: product.description || '',
      price: product.price || '',
      cost_price: product.cost_price || '',
      stock_quantity: product.stock_quantity || 0,
      min_stock: product.min_stock || 5,
      image_url: product.image_url || ''
    });
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setEditingProduct(null);
    setForm(initialForm);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const payload = {
      ...form,
      category_id: form.category_id || null,
      price: Number(form.price),
      cost_price: form.cost_price === '' ? null : Number(form.cost_price),
      stock_quantity: Number(form.stock_quantity),
      min_stock: Number(form.min_stock)
    };

    try {
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, payload);
        toast.success('Đã cập nhật sản phẩm');
      } else {
        await api.post('/products', payload);
        toast.success('Đã thêm sản phẩm');
      }

      closeModal();
      await loadProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể lưu sản phẩm');
    }
  };

  const handleDelete = async (product) => {
    if (!window.confirm(`Xóa sản phẩm "${product.name}"?`)) {
      return;
    }

    try {
      await api.delete(`/products/${product.id}`);
      toast.success('Đã xóa sản phẩm');
      await loadProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể xóa sản phẩm');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-950">Sản phẩm</h1>
          <p className="mt-1 text-sm text-gray-500">Quản lý hàng hóa bán tại cửa hàng</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-[#74B8E0] px-4 py-2.5 font-semibold text-white transition hover:bg-[#74B8E0] active:bg-[#74B8E0]"
        >
          <Plus size={18} />
          <span>Thêm sản phẩm</span>
        </button>
      </div>

      <div className="grid gap-3 rounded-lg bg-white p-4 shadow-sm md:grid-cols-[1fr_220px]">
        <div className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2">
          <Search size={18} className="text-gray-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full outline-none"
            placeholder="Tìm sản phẩm"
          />
        </div>
        <select
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
        >
          <option value="">Tất cả danh mục</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <section className="rounded-lg bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Ảnh</th>
                <th className="px-4 py-3 font-semibold">Tên</th>
                <th className="px-4 py-3 font-semibold">Danh mục</th>
                <th className="px-4 py-3 font-semibold">Giá</th>
                <th className="px-4 py-3 font-semibold">Tồn kho</th>
                <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((product) => {
                const isLowStock = Number(product.stock_quantity) <= Number(product.min_stock);

                return (
                  <tr key={product.id}>
                    <td className="px-4 py-3">
                      <img
                        src={product.image_url || 'https://placehold.co/80x80?text=SP'}
                        alt={product.name}
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-950">{product.name}</td>
                    <td className="px-4 py-3 text-gray-600">{product.category_name}</td>
                    <td className="px-4 py-3 text-gray-950">{formatCurrency(product.price)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          isLowStock ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {product.stock_quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(product)}
                          className="rounded-lg p-2 text-gray-500 transition hover:bg-brand-surface hover:text-brand-strong"
                          title="Sửa"
                          aria-label="Sửa"
                        >
                          <Edit size={17} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(product)}
                          className="rounded-lg p-2 text-gray-500 transition hover:bg-red-50 hover:text-red-600"
                          title="Xóa"
                          aria-label="Xóa"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <Modal isOpen={isOpen} onClose={closeModal} title={editingProduct ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="mb-1 block text-sm font-medium text-gray-700">Tên sản phẩm</span>
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
              required
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Danh mục</span>
            <select
              value={form.category_id}
              onChange={(event) => setForm({ ...form, category_id: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
            >
              <option value="">Chưa chọn</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Giá bán</span>
            <input
              type="number"
              min="0"
              value={form.price}
              onChange={(event) => setForm({ ...form, price: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
              required
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Giá vốn</span>
            <input
              type="number"
              min="0"
              value={form.cost_price}
              onChange={(event) => setForm({ ...form, cost_price: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Tồn kho</span>
            <input
              type="number"
              min="0"
              value={form.stock_quantity}
              onChange={(event) => setForm({ ...form, stock_quantity: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Tồn tối thiểu</span>
            <input
              type="number"
              min="0"
              value={form.min_stock}
              onChange={(event) => setForm({ ...form, min_stock: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
            />
          </label>
          <label className="md:col-span-2">
            <span className="mb-1 block text-sm font-medium text-gray-700">Ảnh</span>
            <input
              value={form.image_url}
              onChange={(event) => setForm({ ...form, image_url: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
              placeholder="https://..."
            />
          </label>
          <label className="md:col-span-2">
            <span className="mb-1 block text-sm font-medium text-gray-700">Mô tả</span>
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              className="min-h-24 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
            />
          </label>
          <div className="flex justify-end gap-3 md:col-span-2">
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
