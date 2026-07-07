import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Ban,
  Building2,
  Download,
  Edit,
  Eye,
  Filter,
  Handshake,
  Lock,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Unlock
} from 'lucide-react';
import Modal from '../components/Modal';
import api from '../api/axios';

const PAGE_SIZE = 5;

const statusOptions = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Đang hợp tác' },
  { value: 'inactive', label: 'Ngừng hợp tác' }
];

const initialSuppliers = [
  {
    id: 1,
    code: 'NCC001',
    name: 'Phụ Kiện Sài Gòn',
    group: 'Đối tác chiến lược',
    contact: 'Anh Minh',
    phone: '0901 234 567',
    email: 'pk.saigon@gmail.com',
    region: 'TP.HCM',
    status: 'active',
    note: 'Nguồn hàng ốp lưng và kính cường lực ổn định.'
  },
  {
    id: 2,
    code: 'NCC002',
    name: 'Linh Kiện Mobile VN',
    group: 'Phụ kiện công nghệ',
    contact: 'Chị Hạnh',
    phone: '0912 888 999',
    email: 'mobilevn@gmail.com',
    region: 'Bình Dương',
    status: 'active',
    note: 'Cung cấp cáp, sạc và phụ kiện tiện ích.'
  },
  {
    id: 3,
    code: 'NCC003',
    name: 'Tech Accessories Pro',
    group: 'Linh kiện cao cấp',
    contact: 'Anh Khoa',
    phone: '0987 456 123',
    email: 'techpro@gmail.com',
    region: 'TP.HCM',
    status: 'inactive',
    note: 'Tạm dừng để kiểm tra lại chính sách giá.'
  },
  {
    id: 4,
    code: 'NCC004',
    name: 'Phụ Kiện Giá Sỉ 24H',
    group: 'Bán buôn phụ kiện',
    contact: 'Chị Lan',
    phone: '0933 222 111',
    email: 'giasi24h@gmail.com',
    region: 'Đồng Nai',
    status: 'active',
    note: 'Nguồn hàng số lượng lớn cho chương trình khuyến mãi.'
  }
];

const emptyForm = {
  name: '',
  group: '',
  contact: '',
  phone: '',
  email: '',
  region: '',
  status: 'active',
  note: ''
};

function getStatusMeta(status) {
  if (status === 'active') {
    return {
      label: 'Đang hợp tác',
      badgeClass: 'bg-[#c0edf7] text-[#0f3b46]'
    };
  }

  return {
    label: 'Ngừng hợp tác',
    badgeClass: 'bg-red-100 text-red-700'
  };
}

function getNextSupplierCode(suppliers) {
  const nextNumber = suppliers.reduce((max, supplier) => {
    const number = Number(String(supplier.code).replace(/\D/g, ''));
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 0) + 1;

  return `NCC${String(nextNumber).padStart(3, '0')}`;
}

function getSupplierStats(suppliers) {
  const active = suppliers.filter((supplier) => supplier.status === 'active').length;
  return { total: suppliers.length, active, inactive: suppliers.length - active };
}

function buildCsv(suppliers) {
  const headers = ['Ma NCC', 'Nha cung cap', 'Nhom', 'Lien he', 'Dien thoai', 'Email', 'Khu vuc', 'Trang thai'];
  const rows = suppliers.map((supplier) => [
    supplier.code,
    supplier.name,
    supplier.group,
    supplier.contact,
    supplier.phone,
    supplier.email,
    supplier.region,
    getStatusMeta(supplier.status).label
  ]);

  return [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [form, setForm] = useState(emptyForm);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [viewingSupplier, setViewingSupplier] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const loadSuppliers = async () => {
    try {
      const response = await api.get('/suppliers');
      setSuppliers(response.data.map((item) => ({ ...item, region: item.address || '', group: '', contact: '' })));
    } catch {
      toast.error('Không thể tải danh sách nhà cung cấp');
    }
  };

  useEffect(() => { loadSuppliers(); }, []);

  const stats = useMemo(() => getSupplierStats(suppliers), [suppliers]);

  const filteredSuppliers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return suppliers.filter((supplier) => {
      const matchesStatus = statusFilter === 'all' || supplier.status === statusFilter;
      const matchesKeyword = [
        supplier.code,
        supplier.name,
        supplier.group,
        supplier.contact,
        supplier.phone,
        supplier.email,
        supplier.region
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(keyword));

      return matchesStatus && matchesKeyword;
    });
  }, [suppliers, search, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredSuppliers.length / PAGE_SIZE));
  const pageNumbers = useMemo(() => Array.from({ length: pageCount }, (_, index) => index + 1), [pageCount]);
  const paginatedSuppliers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;

    return filteredSuppliers.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredSuppliers]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, pageCount));
  }, [pageCount]);

  const openCreate = () => {
    setEditingSupplier(null);
    setForm(emptyForm);
    setIsFormOpen(true);
  };

  const openEdit = (supplier) => {
    setEditingSupplier(supplier);
    setForm({
      name: supplier.name,
      group: supplier.group,
      contact: supplier.contact,
      phone: supplier.phone,
      email: supplier.email,
      region: supplier.region,
      status: supplier.status,
      note: supplier.note || ''
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingSupplier(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      supplier_code: editingSupplier?.code ?? getNextSupplierCode(suppliers),
      supplier_name: form.name.trim(), phone: form.phone.replace(/\s/g, ''),
      email: form.email.trim() || null, address: form.region.trim() || null,
      note: form.note.trim() || null, status: form.status
    };
    try {
      if (editingSupplier) await api.put(`/suppliers/${editingSupplier.id}`, payload);
      else await api.post('/suppliers', payload);
      await loadSuppliers();
      toast.success(editingSupplier ? 'Đã cập nhật nhà cung cấp' : 'Đã thêm nhà cung cấp');
      closeForm();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể lưu nhà cung cấp');
    }
  };

  const toggleStatus = async (supplier) => {
    const nextStatus = supplier.status === 'active' ? 'inactive' : 'active';
    try {
      await api.put(`/suppliers/${supplier.id}`, {
        supplier_code: supplier.code, supplier_name: supplier.name, phone: supplier.phone || null,
        email: supplier.email || null, address: supplier.region || null, note: supplier.note || null,
        status: nextStatus
      });
      await loadSuppliers();
      toast.success(nextStatus === 'active' ? 'Đã mở lại hợp tác' : 'Đã ngừng hợp tác');
    } catch (error) { toast.error(error.response?.data?.message || 'Không thể cập nhật trạng thái'); }
  };

  const exportCsv = () => {
    const blob = new Blob([`\ufeff${buildCsv(filteredSuppliers)}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'nha-cung-cap-ztech.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-950">Quản lý nhà cung cấp</h1>
          <p className="mt-1 text-sm font-medium text-gray-500">
            Lưu thông tin liên hệ, theo dõi trạng thái và quản lý các đối tác cung cấp hàng hóa.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#c0edf7] px-5 py-2.5 font-semibold text-[#0f3b46] shadow-sm transition hover:bg-[#a9e3ef] active:bg-[#91d9e8]"
        >
          <Plus size={18} />
          <span>Thêm nhà cung cấp</span>
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <section className="flex items-center justify-between rounded-lg border border-[#d7eef3] bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm text-gray-500">Tổng nhà cung cấp</p>
            <p className="mt-1 text-3xl font-bold text-[#0f3b46]">{stats.total}</p>
            <span className="mt-3 inline-flex items-center rounded-full bg-[#c0edf7] px-3 py-1 text-xs font-semibold text-[#0f3b46]">
              Hệ thống ổn định
            </span>
          </div>
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-[#c0edf7] text-[#0f3b46]">
            <Building2 size={26} />
          </div>
        </section>

        <section className="flex items-center justify-between rounded-lg border border-[#d7eef3] bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm text-gray-500">Đang hợp tác</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">{stats.active}</p>
            <span className="mt-3 inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Hoạt động tốt
            </span>
          </div>
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
            <Handshake size={26} />
          </div>
        </section>

        <section className="flex items-center justify-between rounded-lg border border-[#d7eef3] bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm text-gray-500">Ngừng hợp tác</p>
            <p className="mt-1 text-3xl font-bold text-red-600">{stats.inactive}</p>
            <span className="mt-3 inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
              Cần kiểm tra
            </span>
          </div>
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-red-50 text-red-600">
            <Ban size={26} />
          </div>
        </section>
      </div>

      <section className="flex flex-col gap-3 rounded-lg border border-[#d7eef3] bg-[#f4fcfe] p-4 shadow-sm md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#c0edf7] bg-white px-3 py-2">
          <Search size={18} className="text-gray-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full outline-none"
            placeholder="Tìm kiếm nhà cung cấp..."
          />
        </div>
        <div className="flex gap-3">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-10 min-w-48 rounded-lg border border-[#c0edf7] bg-white px-3 text-sm font-medium text-gray-700 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-lg border border-[#c0edf7] bg-white text-gray-600 transition hover:bg-[#c0edf7] hover:text-[#0f3b46]"
            title="Lọc"
            aria-label="Lọc"
          >
            <Filter size={18} />
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="grid h-10 w-10 place-items-center rounded-lg border border-[#c0edf7] bg-white text-gray-600 transition hover:bg-[#c0edf7] hover:text-[#0f3b46]"
            title="Xuất CSV"
            aria-label="Xuất CSV"
          >
            <Download size={18} />
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-[#d7eef3] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="bg-[#f4fcfe] text-gray-500">
              <tr>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide">Mã NCC</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide">Nhà cung cấp</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide">Người liên hệ</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide">Thông tin liên lạc</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide">Khu vực</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide">Trạng thái</th>
                <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wide">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf7f9]">
              {paginatedSuppliers.map((supplier) => {
                const statusMeta = getStatusMeta(supplier.status);
                const ToggleIcon = supplier.status === 'active' ? Unlock : Lock;

                return (
                  <tr key={supplier.id} className="transition hover:bg-[#f8fdfe]">
                    <td className="px-5 py-4 font-bold text-[#0f3b46]">{supplier.code}</td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-gray-950">{supplier.name}</div>
                      <div className="text-xs text-gray-500">{supplier.group}</div>
                    </td>
                    <td className="px-5 py-4 font-medium text-gray-800">{supplier.contact}</td>
                    <td className="px-5 py-4 text-gray-600">
                      <div className="mb-1 flex items-center gap-2">
                        <Phone size={15} className="text-gray-400" />
                        <span>{supplier.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail size={15} className="text-gray-400" />
                        <span>{supplier.email}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-600">
                      <div className="flex items-center gap-2">
                        <MapPin size={15} className="text-gray-400" />
                        <span>{supplier.region}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusMeta.badgeClass}`}>
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setViewingSupplier(supplier)}
                          className="rounded-lg p-2 text-gray-500 transition hover:bg-[#c0edf7] hover:text-[#0f3b46]"
                          title="Xem"
                          aria-label="Xem"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(supplier)}
                          className="rounded-lg p-2 text-gray-500 transition hover:bg-[#c0edf7] hover:text-[#0f3b46]"
                          title="Sửa"
                          aria-label="Sửa"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleStatus(supplier)}
                          className="rounded-lg p-2 text-gray-500 transition hover:bg-red-50 hover:text-red-600"
                          title={supplier.status === 'active' ? 'Ngừng hợp tác' : 'Mở lại hợp tác'}
                          aria-label={supplier.status === 'active' ? 'Ngừng hợp tác' : 'Mở lại hợp tác'}
                        >
                          <ToggleIcon size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end border-t border-[#edf7f9] px-5 py-4 text-sm text-gray-500">
          <nav className="flex items-center gap-2" aria-label="Phan trang nha cung cap">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              className="grid h-9 w-9 place-items-center rounded-lg border border-[#d7eef3] font-bold text-[#0f3b46] transition hover:bg-[#f4fcfe] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Trang truoc"
            >
              &lt;
            </button>
            {pageNumbers.map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={`grid h-9 w-9 place-items-center rounded-lg font-bold transition ${
                  currentPage === page
                    ? 'bg-[#c0edf7] text-[#0f3b46]'
                    : 'border border-[#d7eef3] text-gray-600 hover:bg-[#f4fcfe] hover:text-[#0f3b46]'
                }`}
                aria-current={currentPage === page ? 'page' : undefined}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
              disabled={currentPage === pageCount}
              className="grid h-9 w-9 place-items-center rounded-lg border border-[#d7eef3] font-bold text-[#0f3b46] transition hover:bg-[#f4fcfe] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Trang tiep"
            >
              &gt;
            </button>
          </nav>
        </div>
      </section>

      <Modal isOpen={isFormOpen} onClose={closeForm} title={editingSupplier ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp'} headerActions={<><button type="button" onClick={closeForm} className="h-11 border border-[#69afd6] bg-white px-5 text-base font-bold text-[#398fbd] hover:bg-sky-50">Hủy</button><button type="submit" form="supplier-form" className="h-11 bg-[#69afd6] px-5 text-base font-bold text-white hover:bg-[#579fc8]">Lưu</button></>}>
        <form id="supplier-form" onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="mb-1 block text-sm font-medium text-gray-700">Tên nhà cung cấp</span>
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
              required
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Nhóm cung cấp</span>
            <input
              value={form.group}
              onChange={(event) => setForm({ ...form, group: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
              required
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Người liên hệ</span>
            <input
              value={form.contact}
              onChange={(event) => setForm({ ...form, contact: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
              required
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Số điện thoại</span>
            <input
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
              required
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
              required
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Khu vực</span>
            <input
              value={form.region}
              onChange={(event) => setForm({ ...form, region: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
              required
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Trạng thái</span>
            <select
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
            >
              <option value="active">Đang hợp tác</option>
              <option value="inactive">Ngừng hợp tác</option>
            </select>
          </label>
          <label className="md:col-span-2">
            <span className="mb-1 block text-sm font-medium text-gray-700">Ghi chú</span>
            <textarea
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
              className="min-h-24 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
            />
          </label>
        </form>
      </Modal>

      <Modal isOpen={Boolean(viewingSupplier)} onClose={() => setViewingSupplier(null)} title="Chi tiết nhà cung cấp">
        {viewingSupplier && (
          <div className="space-y-4">
            <div className="rounded-lg bg-[#f4fcfe] p-4">
              <div className="text-sm font-bold text-[#0f3b46]">{viewingSupplier.code}</div>
              <div className="mt-1 text-xl font-bold text-gray-950">{viewingSupplier.name}</div>
              <div className="mt-2">
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusMeta(viewingSupplier.status).badgeClass}`}>
                  {getStatusMeta(viewingSupplier.status).label}
                </span>
              </div>
            </div>
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <div>
                <span className="text-gray-500">Nhóm cung cấp</span>
                <p className="font-semibold text-gray-950">{viewingSupplier.group}</p>
              </div>
              <div>
                <span className="text-gray-500">Người liên hệ</span>
                <p className="font-semibold text-gray-950">{viewingSupplier.contact}</p>
              </div>
              <div>
                <span className="text-gray-500">Số điện thoại</span>
                <p className="font-semibold text-gray-950">{viewingSupplier.phone}</p>
              </div>
              <div>
                <span className="text-gray-500">Email</span>
                <p className="font-semibold text-gray-950">{viewingSupplier.email}</p>
              </div>
              <div>
                <span className="text-gray-500">Khu vực</span>
                <p className="font-semibold text-gray-950">{viewingSupplier.region}</p>
              </div>
              <div>
                <span className="text-gray-500">Ghi chú</span>
                <p className="font-semibold text-gray-950">{viewingSupplier.note || 'Chưa có ghi chú'}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
