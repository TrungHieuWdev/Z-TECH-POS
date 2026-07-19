import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Ban,
  CalendarDays,
  CircleCheck,
  CirclePause,
  Download,
  Edit,
  Eye,
  Mail,
  Phone,
  Plus,
  Search,
  SlidersHorizontal,
  MoreVertical,
  Trash2,
  ShoppingCart,
  UserRound,
  X,
} from 'lucide-react';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import PageTitle from '../components/PageTitle';
import KpiCard from '../components/KpiCard';
import TablePagination from '../components/TablePagination';
import api from '../api/axios';
import { isVietnamPhone, normalizePhone, vietnamPhoneMessage } from '../utils/phone';

const PAGE_SIZE = 5;

const statusOptions = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Đang hợp tác' },
  { value: 'paused', label: 'Tạm ngừng' },
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
    email: 'sales@doitacthididong.vn',
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
    email: 'contact@khophukien.vn',
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
    email: 'nppmiennam@gmail.com',
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
    email: 'sales@phukiensi24h.vn',
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

  if (status === 'paused') {
    return {
      label: 'Tạm ngừng',
      badgeClass: 'border border-amber-200 bg-amber-50 text-amber-700'
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
  const paused = suppliers.filter((supplier) => supplier.status === 'paused').length;
  const inactive = suppliers.filter((supplier) => supplier.status === 'inactive').length;
  return { total: suppliers.length, active, paused, inactive };
}

function formatDate(value) {
  if (!value) return 'Chưa nhập hàng';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa nhập hàng';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value) || 0);
}

function buildCsv(suppliers) {
  const headers = ['Ma NCC', 'Nha cung cap', 'Nhom', 'Lien he', 'Dien thoai', 'Email', 'Khu vuc', 'Lan nhap gan nhat', 'So don nhap', 'Tong tien da nhap', 'Ghi chu mat hang', 'Trang thai'];
  const rows = suppliers.map((supplier) => [
    supplier.code,
    supplier.name,
    supplier.group,
    supplier.contact,
    supplier.phone,
    supplier.email,
    supplier.region,
    formatDate(supplier.last_purchase_at),
    supplier.purchase_order_count || 0,
    supplier.total_purchased || 0,
    supplier.note || '',
    getStatusMeta(supplier.status).label
  ]);

  return [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

export default function Suppliers() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [form, setForm] = useState(emptyForm);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [viewingSupplier, setViewingSupplier] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPosition, setMenuPosition] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [deletingSupplier, setDeletingSupplier] = useState(null);
  const [statusChange, setStatusChange] = useState(null);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);

  const toggleActionMenu = (event, supplierId) => {
    if (openMenuId === supplierId) {
      setOpenMenuId(null);
      setMenuPosition(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const menuHeight = 310;
    const opensUpward = window.innerHeight - rect.bottom < menuHeight + 16;
    setOpenMenuId(supplierId);
    setMenuPosition(opensUpward
      ? { bottom: window.innerHeight - rect.top + 8, right: window.innerWidth - rect.right }
      : { top: rect.bottom + 8, right: window.innerWidth - rect.right });
  };

  useEffect(() => {
    if (!openMenuId) return undefined;
    const closeMenu = () => { setOpenMenuId(null); setMenuPosition(null); };
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('resize', closeMenu);
    return () => {
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('resize', closeMenu);
    };
  }, [openMenuId]);

  const loadSuppliers = async () => {
    try {
      const response = await api.get('/suppliers');
      setSuppliers(response.data.map((item) => ({
        ...item,
        region: item.address || '',
        group: item.group || '',
        contact: item.contact || ''
      })));
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
  const paginatedSuppliers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;

    return filteredSuppliers.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredSuppliers]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, pageCount));
  }, [pageCount]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

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
    const supplierName = form.name.trim();
    const phone = normalizePhone(form.phone);
    if (supplierName.length < 2 || supplierName.length > 150) {
      return toast.error('Tên nhà cung cấp phải từ 2 đến 150 ký tự');
    }
    if (form.contact.trim().length < 2) return toast.error('Vui lòng nhập tên người liên hệ');
    if (!isVietnamPhone(phone)) return toast.error(vietnamPhoneMessage);
    if (!form.email.trim()) return toast.error('Vui lòng nhập email');
    if (!form.region.trim()) return toast.error('Vui lòng nhập địa chỉ');
    const payload = {
      supplier_code: editingSupplier?.code ?? getNextSupplierCode(suppliers),
      supplier_name: supplierName, supplier_group: form.group.trim() || null,
      contact_name: form.contact.trim() || null, phone,
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

  const updateStatus = (supplier, nextStatus) => {
    setStatusChange({ supplier, nextStatus });
  };

  const confirmStatusChange = async () => {
    if (!statusChange || isStatusUpdating) return;
    const { supplier, nextStatus } = statusChange;
    setIsStatusUpdating(true);
    try {
      await api.put(`/suppliers/${supplier.id}`, {
        supplier_code: supplier.code, supplier_name: supplier.name, phone: supplier.phone || null,
        supplier_group: supplier.group || null, contact_name: supplier.contact || null,
        email: supplier.email || null, address: supplier.region || null, note: supplier.note || null,
        status: nextStatus
      });
      await loadSuppliers();
      toast.success(nextStatus === 'active' ? 'Đã chuyển sang đang hợp tác' : nextStatus === 'paused' ? 'Đã tạm ngừng hợp tác' : 'Đã ngừng hợp tác');
      setStatusChange(null);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể cập nhật trạng thái');
    } finally {
      setIsStatusUpdating(false);
    }
  };

  const deleteSupplier = async (supplier) => {
    try {
      await api.delete(`/suppliers/${supplier.id}`);
      setOpenMenuId(null);
      await loadSuppliers();
      toast.success('Đã xóa nhà cung cấp');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể xóa nhà cung cấp');
    }
  };

  const createPurchaseOrder = (supplier) => {
    setOpenMenuId(null);
    navigate('/inventory/purchase-orders', { state: { source: 'supplier', supplierId: supplier.id } });
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
      <div className="flex flex-col justify-between gap-4 border-b border-[#d7eef3] pb-5 lg:flex-row lg:items-center">
        <PageTitle
          title="Quản lý Nhà cung cấp"
          description="Quản lý thông tin đối tác cung ứng hàng hóa cho hệ thống cửa hàng."
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex h-11 min-w-72 items-center gap-2 border border-[#d7eef3] bg-white px-4 focus-within:border-[#7ed5e6]">
            <Search size={18} className="text-gray-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="Tìm kiếm nhà cung cấp..." />
          </div>
          <button type="button" onClick={openCreate} className="inline-flex h-11 items-center justify-center gap-2 bg-[#159bb5] px-5 font-bold text-white transition hover:bg-[#11869d]">
            <Plus size={18} /><span>Thêm nhà cung cấp</span>
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Tổng nhà cung cấp', stats.total, 'Đối tác đã lưu trong hệ thống', UserRound, 'bg-cyan-50 text-cyan-700'],
          ['Đang hợp tác', stats.active, 'Nhà cung cấp đang hoạt động', CircleCheck, 'bg-blue-50 text-blue-700'],
          ['Tạm ngừng', stats.paused, 'Nhà cung cấp tạm dừng', CirclePause, 'bg-amber-50 text-amber-700'],
          ['Ngừng hợp tác', stats.inactive, 'Nhà cung cấp đã ngừng', X, 'bg-red-50 text-red-700']
        ].map(([label, value, detail, icon, tone]) => (
          <KpiCard key={label} icon={icon} label={label} value={Number(value || 0).toLocaleString('vi-VN')} detail={detail} toneClassName={tone} />
        ))}
      </div>

      <section className="border border-[#d7eef3] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#edf7f9] p-4">
          <button type="button" onClick={() => setShowFilters((value) => !value)} className="inline-flex h-10 items-center gap-2 border border-gray-300 px-4 text-sm font-bold text-gray-700 hover:bg-[#f4fcfe]"><SlidersHorizontal size={17} /> Bộ lọc</button>
          <button type="button" onClick={exportCsv} className="grid h-10 w-10 place-items-center border border-[#d7eef3] text-gray-500 hover:bg-[#f4fcfe]" title="Xuất CSV"><Download size={18} /></button>
        </div>
        {showFilters && <div className="border-b border-[#edf7f9] bg-[#f8fdfe] p-4">
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
        </div>}
        <div className="min-h-[465px] overflow-x-auto">
          <table className="w-full min-w-[1240px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[19%]" />
              <col className="w-[12%]" />
              <col className="w-[14%]" />
              <col className="w-[20%]" />
              <col className="w-[13%]" />
              <col className="w-[13%]" />
              <col className="w-[9%]" />
            </colgroup>
            <thead className="bg-[#f4fcfe] text-gray-500">
              <tr>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide">Nhà cung cấp</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide">Người liên hệ</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide">Liên hệ</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide">Email</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide">Lần nhập gần nhất</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide">Trạng thái</th>
                <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wide">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf7f9]">
              {paginatedSuppliers.map((supplier) => {
                const statusMeta = getStatusMeta(supplier.status);
                return (
                  <tr key={supplier.id} className="h-[84px] transition hover:bg-[#f8fdfe]">
                    <td className="px-5 py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid h-11 w-11 shrink-0 place-items-center bg-[#e8f8fb] text-xs font-extrabold text-[#159bb5]">{supplier.name.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase()}</div>
                        <div className="min-w-0"><div className="line-clamp-2 font-bold leading-5 text-gray-950" title={supplier.name}>{supplier.name}</div><div className="mt-1 inline-flex bg-[#f4fcfe] px-2 py-1 text-[11px] font-semibold text-gray-500">{supplier.code}</div></div>
                      </div>
                    </td>
                    <td className="px-5 py-4"><div className="truncate font-semibold text-gray-800" title={supplier.contact || ''}>{supplier.contact || '—'}</div></td>
                    <td className="px-5 py-4"><div className="flex items-center gap-2 whitespace-nowrap font-semibold text-gray-700"><span className="grid h-6 w-6 shrink-0 place-items-center bg-[#e8f8fb] text-[#159bb5]"><Phone size={13} /></span><span>{supplier.phone || '—'}</span></div></td>
                    <td className="min-w-0 px-5 py-4">
                      <div className="flex min-w-0 items-center gap-2 text-gray-600">
                        <span className="grid h-6 w-6 shrink-0 place-items-center bg-gray-50 text-gray-400"><Mail size={13} /></span>
                        {supplier.email
                          ? <a href={`mailto:${supplier.email}`} className="block min-w-0 truncate hover:text-[#159bb5] hover:underline" title={supplier.email}>{supplier.email}</a>
                          : <span>—</span>}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <span className={`grid h-7 w-7 shrink-0 place-items-center ${supplier.last_purchase_at ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-400'}`}>
                          <CalendarDays size={14} />
                        </span>
                        <span className={supplier.last_purchase_at ? 'font-semibold text-gray-700' : 'text-gray-500'}>{formatDate(supplier.last_purchase_at)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-3 py-1 text-xs font-bold ${statusMeta.badgeClass}`}>
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="relative flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setViewingSupplier(supplier)}
                          className="grid h-8 w-8 place-items-center border border-[#edf7f9] text-gray-400 hover:bg-[#f4fcfe] hover:text-[#0f3b46]"
                          title="Xem"
                          aria-label="Xem"
                        >
                          <Eye size={18} />
                        </button>
                        <button type="button" onClick={(event) => toggleActionMenu(event, supplier.id)} className={`grid h-8 w-8 place-items-center transition ${openMenuId === supplier.id ? 'bg-[#159bb5] text-white shadow-sm' : 'border border-[#d7eef3] text-[#159bb5] hover:bg-[#e8f8fb]'}`} aria-label="Mở menu thao tác"><MoreVertical size={17} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <TablePagination currentPage={currentPage} totalItems={filteredSuppliers.length} pageSize={PAGE_SIZE} onPageChange={setCurrentPage} itemLabel="nhà cung cấp" ariaLabel="Phân trang nhà cung cấp" />
      </section>

      {openMenuId && menuPosition && (() => {
        const supplier = suppliers.find((item) => item.id === openMenuId);
        if (!supplier) return null;
        return (
          <div className="fixed z-[100] w-56 border border-[#d7eef3] bg-white py-1 text-left shadow-xl" style={menuPosition}>
            <button type="button" onClick={() => { setOpenMenuId(null); setViewingSupplier(supplier); }} className="flex w-full items-center gap-3 px-4 py-2.5 font-semibold text-gray-700 hover:bg-[#f4fcfe]"><Eye size={16} /> Xem chi tiết</button>
            <button type="button" onClick={() => { setOpenMenuId(null); openEdit(supplier); }} className="flex w-full items-center gap-3 px-4 py-2.5 font-semibold text-gray-700 hover:bg-[#f4fcfe]"><Edit size={16} /> Sửa thông tin</button>
            {supplier.status !== 'inactive' && <button type="button" onClick={() => createPurchaseOrder(supplier)} className="flex w-full items-center gap-3 px-4 py-2.5 font-semibold text-sky-700 hover:bg-sky-50"><ShoppingCart size={16} /> Tạo phiếu nhập</button>}
            {supplier.status !== 'paused' && supplier.status !== 'inactive' && <button type="button" onClick={() => { setOpenMenuId(null); updateStatus(supplier, 'paused'); }} className="flex w-full items-center gap-3 px-4 py-2.5 font-semibold text-gray-700 hover:bg-[#f4fcfe]"><CirclePause size={16} /> Tạm ngừng hợp tác</button>}
            {supplier.status !== 'active' && <button type="button" onClick={() => { setOpenMenuId(null); updateStatus(supplier, 'active'); }} className="flex w-full items-center gap-3 px-4 py-2.5 font-semibold text-emerald-700 hover:bg-emerald-50"><CircleCheck size={16} /> Chuyển sang đang hợp tác</button>}
            {supplier.status !== 'inactive' && <button type="button" onClick={() => { setOpenMenuId(null); updateStatus(supplier, 'inactive'); }} className="flex w-full items-center gap-3 border-t border-gray-100 px-4 py-2.5 font-semibold text-red-600 hover:bg-red-50"><Ban size={16} /> Ngừng hợp tác</button>}
            <button type="button" onClick={() => { setOpenMenuId(null); setDeletingSupplier(supplier); }} className="flex w-full items-center gap-3 px-4 py-2.5 font-semibold text-red-600 hover:bg-red-50"><Trash2 size={16} /> Xóa nhà cung cấp</button>
          </div>
        );
      })()}

      <Modal isOpen={isFormOpen} onClose={closeForm} title={editingSupplier ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp'} headerActions={<><button type="button" onClick={closeForm} className="h-11 border border-[#69afd6] bg-white px-5 text-base font-bold text-[#398fbd] hover:bg-sky-50">Hủy</button><button type="submit" form="supplier-form" className="h-11 bg-[#69afd6] px-5 text-base font-bold text-white hover:bg-[#579fc8]">Lưu</button></>}>
        <form id="supplier-form" onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="mb-1 block text-sm font-medium text-gray-700">Tên nhà cung cấp</span>
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              minLength={2}
              maxLength={150}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
              required
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Người liên hệ</span>
            <input
              value={form.contact}
              onChange={(event) => setForm({ ...form, contact: event.target.value })}
              maxLength={100}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
              required
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Số điện thoại</span>
            <input
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: normalizePhone(event.target.value) })}
              inputMode="numeric"
              maxLength={10}
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
              maxLength={100}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
              required
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Địa chỉ</span>
            <input
              value={form.region}
              onChange={(event) => setForm({ ...form, region: event.target.value })}
              minLength={2}
              maxLength={500}
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
              <option value="paused">Tạm ngừng</option>
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

      <Modal
        isOpen={Boolean(deletingSupplier)}
        onClose={() => setDeletingSupplier(null)}
        title="Xác nhận xóa nhà cung cấp"
        headerActions={<><button type="button" onClick={() => setDeletingSupplier(null)} className="h-10 border border-gray-300 bg-white px-4 text-sm font-bold text-gray-700 hover:bg-gray-50">Hủy</button><button type="button" onClick={async () => { await deleteSupplier(deletingSupplier); setDeletingSupplier(null); }} className="h-10 bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700">Xóa nhà cung cấp</button></>}
      >
        <div className="space-y-3 text-sm leading-6 text-gray-700">
          <p>Bạn có chắc muốn xóa <strong>{deletingSupplier?.name}</strong>?</p>
          <p className="border border-amber-200 bg-amber-50 p-3 text-amber-800">Nhà cung cấp đã có dữ liệu nhập hàng sẽ không thể xóa vĩnh viễn. Bạn có thể chuyển sang trạng thái Ngừng hợp tác.</p>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(viewingSupplier)}
        onClose={() => setViewingSupplier(null)}
        title="Chi tiết nhà cung cấp"
        showCloseButton
      >
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
                <span className="text-gray-500">Địa chỉ</span>
                <p className="font-semibold text-gray-950">{viewingSupplier.region || '—'}</p>
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
                <span className="text-gray-500">Ngày tạo</span>
                <p className="font-semibold text-gray-950">{formatDate(viewingSupplier.created_at)}</p>
              </div>
              <div>
                <span className="text-gray-500">Lần nhập hàng gần nhất</span>
                <p className="font-semibold text-gray-950">{formatDate(viewingSupplier.last_purchase_at)}</p>
              </div>
              <div>
                <span className="text-gray-500">Tổng số phiếu nhập</span>
                <p className="font-semibold text-gray-950">{viewingSupplier.purchase_order_count || 0} phiếu</p>
              </div>
              <div>
                <span className="text-gray-500">Tổng giá trị đã nhập</span>
                <p className="font-semibold text-gray-950">{formatCurrency(viewingSupplier.total_purchased)}</p>
              </div>
              <div>
                <span className="text-gray-500">Đã thanh toán</span>
                <p className="font-semibold text-emerald-700">{formatCurrency(viewingSupplier.total_paid)}</p>
              </div>
              <div>
                <span className="text-gray-500">Còn nợ</span>
                <p className="font-semibold text-red-600">{formatCurrency(viewingSupplier.total_debt)}</p>
              </div>
              <div className="md:col-span-2">
                <span className="text-gray-500">Ghi chú</span>
                <p className="font-semibold text-gray-950">{viewingSupplier.note || 'Chưa có ghi chú'}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmDialog
        isOpen={Boolean(statusChange)}
        onClose={() => setStatusChange(null)}
        onConfirm={confirmStatusChange}
        loading={isStatusUpdating}
        tone={statusChange?.nextStatus === 'active' ? 'primary' : 'danger'}
        title="Thay đổi trạng thái nhà cung cấp"
        message={`Bạn có chắc muốn ${
          statusChange?.nextStatus === 'paused'
            ? 'tạm ngừng hợp tác'
            : statusChange?.nextStatus === 'inactive'
              ? 'ngừng hợp tác'
              : 'khôi phục hợp tác'
        } với “${statusChange?.supplier?.name || ''}”?`}
      />
    </div>
  );
}
