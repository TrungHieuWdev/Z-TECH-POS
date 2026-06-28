import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ChevronLeft,
  ChevronRight,
  Edit,
  Eye,
  EyeOff,
  FolderOpen,
  PackageCheck,
  PackagePlus,
  Plus,
  Search,
  Trash2
} from 'lucide-react';
import api from '../api/axios';
import Modal from '../components/Modal';
import { formatDate } from '../utils/format';

const initialForm = { name: '', description: '' };
const PAGE_SIZE = 6;

const statusFilters = [
  { value: 'all', label: 'Tất cả' },
  { value: 'active', label: 'Đang sử dụng' },
  { value: 'empty', label: 'Chưa có sản phẩm' },
  { value: 'hidden', label: 'Tạm ẩn' }
];

function getCategoryStatus(category) {
  if (category.status === 'hidden' || Number(category.is_active) === 0) return 'hidden';
  return Number(category.productCount || 0) > 0 ? 'active' : 'empty';
}

function getStatusMeta(status) {
  if (status === 'hidden') {
    return { label: 'Tạm ẩn', className: 'bg-gray-100 text-gray-600' };
  }

  if (status === 'empty') {
    return { label: 'Chưa có sản phẩm', className: 'bg-amber-50 text-amber-700' };
  }

  return { label: 'Đang sử dụng', className: 'bg-emerald-50 text-emerald-700' };
}

function getShortDescription(category) {
  const description = String(category.description || '').trim();
  if (description) return description;
  return 'Dùng để nhóm sản phẩm khi bán hàng, nhập kho và xem báo cáo.';
}

export default function Categories() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [editingCategory, setEditingCategory] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  async function loadData() {
    const categoryResponse = await api.get('/categories?include_hidden=1');
    setCategories(categoryResponse.data);
  }

  useEffect(() => {
    loadData().catch((error) => {
      toast.error(error.response?.data?.message || 'Không thể tải danh mục');
    });
  }, []);

  const enrichedCategories = useMemo(() => {
    return categories.map((category) => {
      const productCount = Number(category.product_count || 0);
      const status = getCategoryStatus({ ...category, productCount });

      return {
        ...category,
        productCount,
        status
      };
    });
  }, [categories]);

  const summary = useMemo(() => ({
    total: enrichedCategories.length,
    active: enrichedCategories.filter((category) => category.status === 'active').length,
    empty: enrichedCategories.filter((category) => category.status === 'empty').length,
    hidden: enrichedCategories.filter((category) => category.status === 'hidden').length
  }), [enrichedCategories]);

  const filteredCategories = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return enrichedCategories.filter((category) => {
      const searchable = [
        category.name,
        category.description,
        getStatusMeta(category.status).label
      ].join(' ').toLowerCase();

      if (keyword && !searchable.includes(keyword)) return false;
      if (statusFilter !== 'all' && category.status !== statusFilter) return false;
      return true;
    });
  }, [enrichedCategories, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / PAGE_SIZE));
  const paginatedCategories = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredCategories.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredCategories]);
  const visiblePages = useMemo(() => (
    Array.from({ length: totalPages }, (_, index) => index + 1)
      .filter((page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
  ), [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

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
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể lưu danh mục');
    }
  };

  const handleDelete = async (category) => {
    if (Number(category.productCount || 0) > 0) {
      toast.error('Không thể xóa danh mục đang có sản phẩm. Vui lòng chuyển sản phẩm sang danh mục khác trước.');
      return;
    }

    if (!window.confirm(`Xóa danh mục "${category.name}"?`)) {
      return;
    }

    try {
      await api.delete(`/categories/${category.id}`);
      toast.success('Đã xóa danh mục');
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể xóa danh mục');
    }
  };

  const handleVisibility = async (category) => {
    const willShow = category.status === 'hidden';
    const action = willShow ? 'mở' : 'tạm ẩn';

    if (!window.confirm(`${willShow ? 'Mở' : 'Tạm ẩn'} danh mục "${category.name}"?`)) return;

    try {
      await api.patch(`/categories/${category.id}/visibility`, { is_active: willShow ? 1 : 0 });
      toast.success(`Đã ${action} danh mục`);
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || `Không thể ${action} danh mục`);
    }
  };

  const viewProducts = (category) => {
    navigate(`/products?category_id=${category.id}`);
  };

  const summaryCards = [
    { label: 'Tổng danh mục', value: summary.total, icon: FolderOpen, tone: 'bg-brand-surface text-brand-strong' },
    { label: 'Đang sử dụng', value: summary.active, icon: PackageCheck, tone: 'bg-emerald-50 text-emerald-700' },
    { label: 'Chưa có sản phẩm', value: summary.empty, icon: PackagePlus, tone: 'bg-amber-50 text-amber-700' },
    { label: 'Tạm ẩn', value: summary.hidden, icon: EyeOff, tone: 'bg-gray-100 text-gray-600' }
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-950">Danh mục sản phẩm</h1>
          <p className="mt-1 text-sm font-medium text-gray-500">
            Quản lý nhóm sản phẩm dùng để phân loại hàng hóa, nhập kho và báo cáo bán hàng.
          </p>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <article key={card.label} className="flex min-w-0 items-center gap-3 border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <div className={`grid h-10 w-10 shrink-0 place-items-center ${card.tone}`}>
              <card.icon size={19} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold uppercase tracking-wide text-gray-500">{card.label}</p>
              <p className="mt-0.5 text-xl font-extrabold text-gray-950">{card.value}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-10 w-full border border-gray-300 pl-10 pr-3 text-sm outline-none focus:border-brand"
              placeholder="Tìm danh mục..."
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {statusFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                className={`h-10 border px-3 text-sm font-bold transition ${
                  statusFilter === filter.value
                    ? 'border-brand bg-brand-surface text-brand-deep'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-brand hover:text-brand-strong'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="flex h-10 shrink-0 items-center justify-center gap-2 bg-brand px-4 text-sm font-bold text-white transition hover:bg-brand-strong"
          >
            <Plus size={18} />
            <span>Thêm danh mục</span>
          </button>
        </div>
      </section>

      <section className="border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[22%]" />
              <col className="w-[12%]" />
              <col className="w-[28%]" />
              <col className="w-[14%]" />
              <col className="w-[11%]" />
              <col className="w-[13%]" />
            </colgroup>
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-bold">Tên danh mục</th>
                <th className="px-4 py-3 font-bold">Số sản phẩm</th>
                <th className="px-4 py-3 font-bold">Mô tả ngắn</th>
                <th className="px-4 py-3 font-bold">Trạng thái</th>
                <th className="px-4 py-3 font-bold">Ngày tạo</th>
                <th className="px-4 py-3 text-right font-bold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedCategories.map((category) => {
                const statusMeta = getStatusMeta(category.status);
                const canDelete = Number(category.productCount || 0) === 0;

                return (
                  <tr key={category.id} className="hover:bg-brand-surface/50">
                    <td className="px-4 py-3">
                      <p className="truncate font-bold text-gray-950">{category.name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-extrabold text-gray-950">{category.productCount}</span>
                      <span className="ml-1 text-xs font-medium text-gray-500">sản phẩm</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="line-clamp-2 text-gray-600">{getShortDescription(category)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-bold ${statusMeta.className}`}>
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">{formatDate(category.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => viewProducts(category)}
                          className="inline-flex h-8 items-center gap-1.5 px-2 text-xs font-bold text-brand-strong transition hover:bg-brand-surface"
                          title="Xem sản phẩm"
                        >
                          <Eye size={15} />
                          <span>Xem</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(category)}
                          className="grid h-8 w-8 place-items-center text-gray-500 transition hover:bg-brand-surface hover:text-brand-strong"
                          title="Sửa"
                          aria-label="Sửa"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleVisibility(category)}
                          className={`grid h-8 w-8 place-items-center transition ${
                            category.status === 'hidden'
                              ? 'text-emerald-600 hover:bg-emerald-50'
                              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                          }`}
                          title={category.status === 'hidden' ? 'Mở danh mục' : 'Tạm ẩn'}
                          aria-label={category.status === 'hidden' ? 'Mở danh mục' : 'Tạm ẩn'}
                        >
                          {category.status === 'hidden' ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(category)}
                          disabled={!canDelete}
                          className={`grid h-8 w-8 place-items-center transition ${
                            canDelete
                              ? 'text-gray-500 hover:bg-red-50 hover:text-red-600'
                              : 'cursor-not-allowed text-gray-300'
                          }`}
                          title={canDelete ? 'Xóa' : 'Không thể xóa danh mục đang có sản phẩm. Vui lòng chuyển sản phẩm sang danh mục khác trước.'}
                          aria-label="Xóa"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredCategories.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-4 py-12 text-center text-gray-500">
                    Không tìm thấy danh mục phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredCategories.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-gray-500">
              Hiển thị {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredCategories.length)} trong {filteredCategories.length} danh mục
            </p>
            <nav className="flex items-center justify-center gap-1" aria-label="Phân trang danh mục">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="grid h-9 w-9 place-items-center border border-gray-200 text-gray-600 transition hover:border-brand hover:text-brand-strong disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Trang trước"
              >
                <ChevronLeft size={17} />
              </button>
              {visiblePages.map((page, index) => (
                <span key={page} className="contents">
                  {index > 0 && page - visiblePages[index - 1] > 1 && (
                    <span className="px-1 text-gray-400">…</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`h-9 min-w-9 border px-2 text-sm font-bold transition ${
                      currentPage === page
                        ? 'border-brand bg-brand text-white'
                        : 'border-gray-200 text-gray-600 hover:border-brand hover:text-brand-strong'
                    }`}
                    aria-current={currentPage === page ? 'page' : undefined}
                  >
                    {page}
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="grid h-9 w-9 place-items-center border border-gray-200 text-gray-600 transition hover:border-brand hover:text-brand-strong disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Trang sau"
              >
                <ChevronRight size={17} />
              </button>
            </nav>
          </div>
        )}
      </section>

      <Modal isOpen={isOpen} onClose={closeModal} title={editingCategory ? 'Sửa danh mục' : 'Thêm danh mục'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Tên danh mục</span>
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="w-full border border-gray-300 px-3 py-2 outline-none focus:border-brand"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Mô tả</span>
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              className="min-h-28 w-full border border-gray-300 px-3 py-2 outline-none focus:border-brand"
            />
          </label>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={closeModal} className="border border-gray-300 px-4 py-2 font-medium">
              Hủy
            </button>
            <button type="submit" className="bg-brand px-4 py-2 font-semibold text-white hover:bg-brand-strong">
              Lưu
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
