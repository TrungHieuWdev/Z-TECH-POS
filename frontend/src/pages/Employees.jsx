import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Download,
  Edit,
  Eye,
  Filter,
  KeyRound,
  Lock,
  Phone,
  Search,
  ShieldCheck,
  Unlock,
  UserCheck,
  UserPlus,
  UserSquare2,
  UserX,
  Users
} from 'lucide-react';
import Modal from '../components/Modal';

const STORAGE_KEY = 'ztech-employees';

const roleOptions = [
  { value: 'all', label: 'Tất cả vai trò' },
  { value: 'manager', label: 'Quản lý' },
  { value: 'cashier', label: 'Nhân viên bán hàng' },
  { value: 'warehouse', label: 'Nhân viên kho' }
];

const statusOptions = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'inactive', label: 'Ngừng hoạt động' }
];

const initialEmployees = [
  {
    id: 1,
    code: 'NV001',
    name: 'Nguyễn Văn Minh',
    phone: '0901 234 567',
    password: 'Minh@123',
    role: 'manager',
    status: 'active',
    createdAt: '2026-06-10',
    note: 'Quản lý vận hành cửa hàng và phân quyền nhân viên.'
  },
  {
    id: 2,
    code: 'NV002',
    name: 'Trần Thị Hạnh',
    phone: '0912 888 999',
    password: 'Hanh@123',
    role: 'cashier',
    status: 'active',
    createdAt: '2026-06-10',
    note: 'Phụ trách bán hàng tại quầy POS.'
  },
  {
    id: 3,
    code: 'NV003',
    name: 'Lê Quốc Khoa',
    phone: '0987 456 123',
    password: 'Khoa@123',
    role: 'warehouse',
    status: 'active',
    createdAt: '2026-06-09',
    note: 'Phụ trách nhập kho, kiểm kho và điều chỉnh tồn.'
  },
  {
    id: 4,
    code: 'NV004',
    name: 'Phạm Gia Bảo',
    phone: '0933 222 111',
    password: 'Bao@123',
    role: 'cashier',
    status: 'inactive',
    createdAt: '2026-06-08',
    note: 'Tài khoản đang tạm khóa.'
  }
];

const emptyForm = {
  name: '',
  phone: '',
  password: '',
  role: 'cashier',
  status: 'active',
  createdAt: new Date().toISOString().slice(0, 10),
  note: ''
};

function getRoleMeta(role) {
  const roleMap = {
    manager: { label: 'Quản lý', badgeClass: 'bg-[#c0edf7] text-[#0f3b46]' },
    cashier: { label: 'Nhân viên bán hàng', badgeClass: 'bg-emerald-50 text-emerald-700' },
    warehouse: { label: 'Nhân viên kho', badgeClass: 'bg-amber-50 text-amber-700' }
  };

  return roleMap[role] || roleMap.cashier;
}

function getStatusMeta(status) {
  return status === 'active'
    ? { label: 'Đang hoạt động', badgeClass: 'bg-[#c0edf7] text-[#0f3b46]', dotClass: 'bg-[#0f3b46]' }
    : { label: 'Ngừng hoạt động', badgeClass: 'bg-slate-100 text-slate-600', dotClass: 'bg-slate-400' };
}

function getInitials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function getNextEmployeeCode(employees) {
  const nextNumber = employees.reduce((max, employee) => {
    const number = Number(String(employee.code).replace(/\D/g, ''));
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 0) + 1;

  return `NV${String(nextNumber).padStart(3, '0')}`;
}

function formatDate(value) {
  if (!value) return '';
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

function getEmployeeStats(employees) {
  const active = employees.filter((employee) => employee.status === 'active').length;
  const admins = employees.filter((employee) => employee.role === 'manager').length;

  return {
    total: employees.length,
    active,
    inactive: employees.length - active,
    admins
  };
}

function buildCsv(employees) {
  const headers = ['Ma NV', 'Ho ten', 'Dien thoai', 'Mat khau', 'Vai tro', 'Trang thai', 'Ngay tao'];
  const rows = employees.map((employee) => [
    employee.code,
    employee.name,
    employee.phone,
    employee.password,
    getRoleMeta(employee.role).label,
    getStatusMeta(employee.status).label,
    formatDate(employee.createdAt)
  ]);

  return [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

function maskPassword(password = '') {
  return password ? '•'.repeat(Math.max(6, password.length)) : 'Chưa tạo';
}

export default function Employees() {
  const [employees, setEmployees] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : initialEmployees;
  });
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [form, setForm] = useState(emptyForm);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [viewingEmployee, setViewingEmployee] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(employees));
  }, [employees]);

  const stats = useMemo(() => getEmployeeStats(employees), [employees]);

  const filteredEmployees = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return employees.filter((employee) => {
      const matchesRole = roleFilter === 'all' || employee.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || employee.status === statusFilter;
      const matchesKeyword = [employee.code, employee.name, employee.phone]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(keyword));

      return matchesRole && matchesStatus && matchesKeyword;
    });
  }, [employees, search, roleFilter, statusFilter]);

  const openCreate = () => {
    setEditingEmployee(null);
    setForm(emptyForm);
    setIsFormOpen(true);
  };

  const openEdit = (employee) => {
    setEditingEmployee(employee);
    setForm({
      name: employee.name,
      phone: employee.phone,
      password: employee.password || '',
      role: employee.role,
      status: employee.status,
      createdAt: employee.createdAt,
      note: employee.note || ''
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingEmployee(null);
    setForm(emptyForm);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!form.password.trim()) {
      toast.error('Vui lòng tạo mật khẩu cho nhân viên');
      return;
    }

    const nextEmployee = {
      ...form,
      id: editingEmployee?.id ?? Date.now(),
      code: editingEmployee?.code ?? getNextEmployeeCode(employees),
      name: form.name.trim(),
      phone: form.phone.trim(),
      password: form.password.trim(),
      note: form.note.trim()
    };

    if (editingEmployee) {
      setEmployees((current) =>
        current.map((employee) => (employee.id === editingEmployee.id ? nextEmployee : employee))
      );
      toast.success('Đã cập nhật tài khoản nhân viên');
    } else {
      setEmployees((current) => [nextEmployee, ...current]);
      toast.success('Đã thêm nhân viên mới');
    }

    closeForm();
  };

  const toggleStatus = (employee) => {
    const nextStatus = employee.status === 'active' ? 'inactive' : 'active';
    setEmployees((current) =>
      current.map((item) => (item.id === employee.id ? { ...item, status: nextStatus } : item))
    );
    toast.success(nextStatus === 'active' ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản');
  };

  const resetPassword = (employee) => {
    const nextPassword = `${employee.code}@123`;
    setEmployees((current) =>
      current.map((item) => (item.id === employee.id ? { ...item, password: nextPassword } : item))
    );
    toast.success(`Đã đặt lại mật khẩu cho ${employee.code}: ${nextPassword}`);
  };

  const exportCsv = () => {
    const blob = new Blob([`\ufeff${buildCsv(filteredEmployees)}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'nhan-vien-ztech.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-950">Quản lý nhân viên</h1>
          <p className="mt-1 text-sm text-gray-500">
            Chủ cửa hàng tạo mã NV và mật khẩu riêng cho từng nhân viên để đăng nhập hệ thống.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#c0edf7] px-5 py-2.5 font-semibold text-[#0f3b46] shadow-sm transition hover:bg-[#a9e3ef] active:bg-[#91d9e8]"
        >
          <UserPlus size={18} />
          <span>Thêm nhân viên</span>
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <section className="rounded-lg border border-[#d7eef3] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between">
            <p className="font-semibold text-gray-500">Tổng nhân viên</p>
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#c0edf7] text-[#0f3b46]">
              <Users size={22} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-950">{stats.total}</span>
            <span className="text-sm text-gray-500">nhân sự</span>
          </div>
        </section>

        <section className="rounded-lg border border-[#d7eef3] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between">
            <p className="font-semibold text-gray-500">Đang hoạt động</p>
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
              <UserCheck size={22} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-950">{stats.active}</span>
            <span className="text-sm font-bold text-emerald-600">
              {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%
            </span>
          </div>
        </section>

        <section className="rounded-lg border border-[#d7eef3] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between">
            <p className="font-semibold text-gray-500">Ngừng hoạt động</p>
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-red-50 text-red-600">
              <UserX size={22} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-950">{stats.inactive}</span>
            <span className="text-sm font-bold text-red-600">
              {stats.total > 0 ? Math.round((stats.inactive / stats.total) * 100) : 0}%
            </span>
          </div>
        </section>

        <section className="rounded-lg border border-[#d7eef3] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between">
            <p className="font-semibold text-gray-500">Quản trị viên</p>
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#f4fcfe] text-[#0f3b46]">
              <ShieldCheck size={22} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-950">{stats.admins}</span>
            <span className="text-sm text-gray-500">tài khoản</span>
          </div>
        </section>
      </div>

      <section className="flex flex-col gap-4 rounded-lg border border-[#d7eef3] bg-white p-4 shadow-sm xl:flex-row xl:items-end">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-11 w-full rounded-lg border border-transparent bg-[#f4fcfe] pl-10 pr-4 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
            placeholder="Tìm theo mã NV, tên hoặc số điện thoại..."
          />
        </div>
        <label className="min-w-[180px]">
          <span className="mb-1 ml-1 block text-xs font-bold uppercase text-gray-500">Vai trò</span>
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            className="h-11 w-full rounded-lg border border-[#d7eef3] bg-white px-3 text-sm outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[190px]">
          <span className="mb-1 ml-1 block text-xs font-bold uppercase text-gray-500">Trạng thái</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-11 w-full rounded-lg border border-[#d7eef3] bg-white px-3 text-sm outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="grid h-11 w-11 place-items-center rounded-lg bg-[#c0edf7] text-[#0f3b46]">
          <Filter size={19} />
        </button>
        <button
          type="button"
          onClick={exportCsv}
          className="grid h-11 w-11 place-items-center rounded-lg bg-white text-gray-600 ring-1 ring-[#d7eef3] transition hover:bg-[#c0edf7] hover:text-[#0f3b46]"
        >
          <Download size={19} />
        </button>
      </section>

      <section className="overflow-hidden rounded-lg border border-[#d7eef3] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="bg-[#f4fcfe] text-gray-500">
              <tr>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide">Mã NV</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide">Họ tên</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide">Thông tin đăng nhập</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide">Vai trò</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide">Trạng thái</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide">Ngày tạo</th>
                <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wide">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf7f9]">
              {filteredEmployees.map((employee) => {
                const roleMeta = getRoleMeta(employee.role);
                const statusMeta = getStatusMeta(employee.status);
                const ToggleIcon = employee.status === 'active' ? Lock : Unlock;

                return (
                  <tr key={employee.id} className="transition hover:bg-[#f8fdfe]">
                    <td className="px-5 py-4 font-bold text-[#0f3b46]">{employee.code}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-full bg-[#c0edf7] font-bold text-[#0f3b46]">
                          {getInitials(employee.name)}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-950">{employee.name}</div>
                          <div className="mt-1 flex items-center gap-2 text-gray-500">
                            <Phone size={15} className="text-gray-400" />
                            <span>{employee.phone}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-600">
                      <div className="mb-1 flex items-center gap-2">
                        <UserSquare2 size={15} className="text-gray-400" />
                        <span>Mã đăng nhập: {employee.code}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <KeyRound size={15} className="text-gray-400" />
                        <span>Mật khẩu: {maskPassword(employee.password)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${roleMeta.badgeClass}`}>
                        {roleMeta.label}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${statusMeta.badgeClass}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotClass}`} />
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-600">{formatDate(employee.createdAt)}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setViewingEmployee(employee)}
                          className="rounded-lg p-2 text-gray-500 transition hover:bg-[#c0edf7] hover:text-[#0f3b46]"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(employee)}
                          className="rounded-lg p-2 text-gray-500 transition hover:bg-[#c0edf7] hover:text-[#0f3b46]"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => resetPassword(employee)}
                          className="rounded-lg p-2 text-gray-500 transition hover:bg-amber-50 hover:text-amber-700"
                        >
                          <KeyRound size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleStatus(employee)}
                          className="rounded-lg p-2 text-gray-500 transition hover:bg-red-50 hover:text-red-600"
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

        <div className="flex items-center justify-between border-t border-[#edf7f9] px-5 py-4 text-sm text-gray-500">
          <span>
            Hiển thị <strong className="text-gray-950">{filteredEmployees.length}</strong> trong tổng số{' '}
            <strong className="text-gray-950">{employees.length}</strong> nhân viên
          </span>
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#c0edf7] font-bold text-[#0f3b46]">1</div>
        </div>
      </section>

      <Modal isOpen={isFormOpen} onClose={closeForm} title={editingEmployee ? 'Sửa nhân viên' : 'Thêm nhân viên'}>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="mb-1 block text-sm font-medium text-gray-700">Họ tên</span>
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
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
            <span className="mb-1 block text-sm font-medium text-gray-700">Mật khẩu đăng nhập</span>
            <input
              type="text"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
              placeholder="VD: NV001@123"
              required
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Vai trò</span>
            <select
              value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
            >
              {roleOptions.filter((option) => option.value !== 'all').map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Trạng thái</span>
            <select
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
            >
              {statusOptions.filter((option) => option.value !== 'all').map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Ngày tạo</span>
            <input
              type="date"
              value={form.createdAt}
              onChange={(event) => setForm({ ...form, createdAt: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
              required
            />
          </label>
          <label className="md:col-span-2">
            <span className="mb-1 block text-sm font-medium text-gray-700">Ghi chú</span>
            <textarea
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
              className="min-h-24 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
            />
          </label>
          <div className="md:col-span-2 rounded-lg bg-[#f4fcfe] p-3 text-sm text-[#0f3b46]">
            Mã đăng nhập sẽ tự tạo theo dạng `NV001`, `NV002`... Chủ cửa hàng có thể sửa thông tin và đặt lại mật khẩu bất kỳ lúc nào.
          </div>
          <div className="flex justify-end gap-3 md:col-span-2">
            <button type="button" onClick={closeForm} className="rounded-lg border border-gray-300 px-4 py-2 font-medium">
              Hủy
            </button>
            <button type="submit" className="rounded-lg bg-[#c0edf7] px-4 py-2 font-semibold text-[#0f3b46] hover:bg-[#a9e3ef]">
              Lưu
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(viewingEmployee)} onClose={() => setViewingEmployee(null)} title="Chi tiết nhân viên">
        {viewingEmployee && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 rounded-lg bg-[#f4fcfe] p-4">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-[#c0edf7] text-lg font-bold text-[#0f3b46]">
                {getInitials(viewingEmployee.name)}
              </div>
              <div>
                <div className="text-sm font-bold text-[#0f3b46]">{viewingEmployee.code}</div>
                <div className="text-xl font-bold text-gray-950">{viewingEmployee.name}</div>
              </div>
            </div>
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <div>
                <span className="text-gray-500">Điện thoại</span>
                <p className="font-semibold text-gray-950">{viewingEmployee.phone}</p>
              </div>
              <div>
                <span className="text-gray-500">Mật khẩu hiện tại</span>
                <p className="font-semibold text-gray-950">{viewingEmployee.password}</p>
              </div>
              <div>
                <span className="text-gray-500">Vai trò</span>
                <p className="font-semibold text-gray-950">{getRoleMeta(viewingEmployee.role).label}</p>
              </div>
              <div>
                <span className="text-gray-500">Trạng thái</span>
                <p className="font-semibold text-gray-950">{getStatusMeta(viewingEmployee.status).label}</p>
              </div>
              <div>
                <span className="text-gray-500">Ngày tạo</span>
                <p className="font-semibold text-gray-950">{formatDate(viewingEmployee.createdAt)}</p>
              </div>
              <div>
                <span className="text-gray-500">Ghi chú</span>
                <p className="font-semibold text-gray-950">{viewingEmployee.note || 'Chưa có ghi chú'}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
