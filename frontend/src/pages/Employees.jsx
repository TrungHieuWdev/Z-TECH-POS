import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  Download,
  Edit,
  Eye,
  Filter,
  KeyRound,
  Lock,
  Phone,
  Search,
  ShieldCheck,
  Trash2,
  Unlock,
  UserCheck,
  UserPlus,
  UserSquare2,
  UserX,
  Users
} from 'lucide-react';
import api from '../api/axios';
import Modal from '../components/Modal';

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

const emptyForm = {
  name: '',
  phone: '',
  password: '',
  role: 'cashier',
  status: 'active',
  createdAt: new Date().toISOString().slice(0, 10),
  lastLoginAt: '',
  note: ''
};

const rolePermissionSummary = {
  manager: ['Toàn quyền quản trị', 'Xem báo cáo toàn cửa hàng', 'Quản lý sản phẩm, kho và nhân viên'],
  cashier: ['Bán hàng và áp dụng khuyến mãi', 'Xem sản phẩm, kho và hóa đơn của mình', 'Chăm sóc khách hàng và tiếp nhận bảo hành'],
  warehouse: ['Xem sản phẩm và tồn kho', 'Theo dõi cảnh báo kho', 'Không được quản trị nhân viên hoặc báo cáo tổng']
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

function formatDate(value) {
  if (!value) return '';
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

function formatDateTime(value) {
  if (!value) return 'Chưa đăng nhập';

  const [datePart, timePart = ''] = String(value).split(' ');
  const [year, month, day] = datePart.split('-');
  return `${timePart} ${day}/${month}/${year}`.trim();
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
  const headers = ['Ma NV', 'Ho ten', 'Dien thoai', 'Lan dang nhap gan nhat', 'Vai tro', 'Trang thai', 'Ngay tao'];
  const rows = employees.map((employee) => [
    employee.code,
    employee.name,
    employee.phone,
    formatDateTime(employee.lastLoginAt),
    getRoleMeta(employee.role).label,
    getStatusMeta(employee.status).label,
    formatDate(employee.createdAt)
  ]);

  return [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

function maskPassword() {
  return 'Đã tạo';
}

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loadingPage, setLoadingPage] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [form, setForm] = useState(emptyForm);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [viewingEmployee, setViewingEmployee] = useState(null);
  const [revealedPasswords, setRevealedPasswords] = useState({});
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [passwordEmployee, setPasswordEmployee] = useState(null);
  const [passwordForm, setPasswordForm] = useState('');
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const loadEmployees = async () => {
    const response = await api.get('/employees');
    setEmployees(Array.isArray(response.data) ? response.data : []);
  };

  useEffect(() => {
    loadEmployees()
      .catch((error) => toast.error(error.response?.data?.message || 'Không thể tải danh sách nhân viên'))
      .finally(() => setLoadingPage(false));
  }, []);

  const stats = useMemo(() => getEmployeeStats(employees), [employees]);

  const filteredEmployees = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return employees.filter((employee) => {
      const matchesRole = roleFilter === 'all' || employee.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || employee.status === statusFilter;
      const matchesKeyword = [employee.code, employee.name, employee.phone, employee.lastLoginAt]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));

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
      password: '',
      role: employee.role,
      status: employee.status,
      createdAt: employee.createdAt,
      lastLoginAt: employee.lastLoginAt || '',
      note: employee.note || ''
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingEmployee(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!editingEmployee && !form.password.trim()) {
      toast.error('Vui lòng tạo mật khẩu cho nhân viên');
      return;
    }

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      password: form.password.trim(),
      role: form.role,
      status: form.status,
      createdAt: form.createdAt,
      lastLoginAt: form.lastLoginAt.trim(),
      note: form.note.trim()
    };

    if (editingEmployee) {
      setConfirmAction({ type: 'update', employee: editingEmployee, payload });
      return;
    }

    try {
      {
        const response = await api.post('/employees', payload);
        toast.success(`Đã thêm nhân viên ${response.data.code}`);
      }

      await loadEmployees();
      closeForm();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể lưu nhân viên');
    }
  };

  const toggleStatus = async (employee) => {
    try {
      const response = await api.post(`/employees/${employee.id}/toggle-status`);
      await loadEmployees();
      toast.success(
        response.data.status === 'active' ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản'
      );
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể cập nhật trạng thái');
    }
  };

  const openPasswordModal = (employee) => {
    setPasswordEmployee(employee);
    setPasswordForm('');
  };

  const closePasswordModal = () => {
    if (isPasswordSaving) return;
    setPasswordEmployee(null);
    setPasswordForm('');
  };

  const changePassword = async (event) => {
    event.preventDefault();
    if (!passwordEmployee || isPasswordSaving) return;

    const nextPassword = passwordForm.trim();
    if (nextPassword.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }

    setIsPasswordSaving(true);
    try {
      const response = await api.post(`/employees/${passwordEmployee.id}/reset-password`, { password: nextPassword });
      setRevealedPasswords((current) => ({ ...current, [passwordEmployee.id]: nextPassword }));
      await loadEmployees();
      toast.success(`Đã đổi mật khẩu cho ${response.data.code}`);
      setPasswordEmployee(null);
      setPasswordForm('');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể đổi mật khẩu');
    } finally {
      setIsPasswordSaving(false);
    }
  };

  const deleteEmployee = (employee) => {
    setConfirmAction({ type: 'delete', employee });
  };

  const executeConfirmedAction = async () => {
    if (!confirmAction || isConfirming) return;
    const { type, employee, payload } = confirmAction;
    setIsConfirming(true);
    try {
      if (type === 'update') {
        await api.put(`/employees/${employee.id}`, payload);
        closeForm();
        toast.success(`Đã cập nhật tài khoản ${employee.code}`);
      } else {
        await api.delete(`/employees/${employee.id}`);
        setRevealedPasswords((current) => {
          const next = { ...current };
          delete next[employee.id];
          return next;
        });
        if (viewingEmployee?.id === employee.id) setViewingEmployee(null);
        toast.success(`Đã xóa nhân viên ${employee.code}`);
      }
      await loadEmployees();
      setConfirmAction(null);
    } catch (error) {
      toast.error(error.response?.data?.message || `Không thể ${type === 'update' ? 'cập nhật' : 'xóa'} nhân viên`);
    } finally {
      setIsConfirming(false);
    }
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
            Mã NV và mật khẩu ở đây được lưu thật trong hệ thống và dùng để đăng nhập cho từng nhân viên.
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
            placeholder="Tìm theo mã NV, tên, SĐT hoặc thời gian đăng nhập..."
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
          <table className="w-full min-w-[1380px] text-left text-sm">
            <thead className="bg-[#f4fcfe] text-gray-500">
              <tr>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide">Mã NV</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide">Họ tên</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide">Thông tin đăng nhập</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide">Vai trò</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide">Trạng thái</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide">Đăng nhập gần nhất</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide">Ngày tạo</th>
                <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wide">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf7f9]">
              {loadingPage ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center font-semibold text-gray-500">
                    Đang tải nhân viên...
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((employee) => {
                  const roleMeta = getRoleMeta(employee.role);
                  const statusMeta = getStatusMeta(employee.status);
                  const ToggleIcon = employee.status === 'active' ? Unlock : Lock;

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
                          <span>Mật khẩu: {maskPassword()}</span>
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
                      <td className="px-5 py-4 font-semibold text-[#58779a]">{formatDateTime(employee.lastLoginAt)}</td>
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
                            onClick={() => openPasswordModal(employee)}
                            className="rounded-lg p-2 text-gray-500 transition hover:bg-amber-50 hover:text-amber-700"
                          >
                            <KeyRound size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleStatus(employee)}
                            title={employee.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                            aria-label={employee.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                            className="rounded-lg p-2 text-gray-500 transition hover:bg-red-50 hover:text-red-600"
                          >
                            <ToggleIcon size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteEmployee(employee)}
                            title="Xóa nhân viên"
                            aria-label="Xóa nhân viên"
                            className="rounded-lg p-2 text-gray-500 transition hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
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
            <span className="mb-1 block text-sm font-medium text-gray-700">
              {editingEmployee ? 'Mật khẩu mới nếu muốn đổi' : 'Mật khẩu đăng nhập'}
            </span>
            <input
              type="text"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
              placeholder={editingEmployee ? 'Để trống nếu giữ nguyên mật khẩu' : 'VD: NV001@123'}
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
          <div className="border border-[#d8eef4] bg-[#f8fdfe] p-3 md:col-span-2">
            <p className="text-sm font-bold text-[#0f3b46]">Quyền của vai trò: {getRoleMeta(form.role).label}</p>
            <ul className="mt-2 grid gap-1 text-xs text-[#4f5965] sm:grid-cols-2">
              {(rolePermissionSummary[form.role] || []).map((permission) => <li key={permission}>• {permission}</li>)}
            </ul>
            {form.role !== 'manager' && <p className="mt-2 text-xs font-semibold text-amber-700">Các thao tác thêm, sửa, xóa dữ liệu quản trị sẽ bị khóa và kiểm tra lại ở backend.</p>}
          </div>
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
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Đăng nhập gần nhất</span>
            <input
              type="text"
              value={form.lastLoginAt}
              onChange={(event) => setForm({ ...form, lastLoginAt: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
              placeholder="YYYY-MM-DD HH:mm:ss"
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
            Mã đăng nhập sẽ tạo thật trong hệ thống. Khi sửa nhân viên, để trống mật khẩu nếu bạn không muốn đổi mật khẩu hiện tại.
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

      <Modal
        isOpen={Boolean(passwordEmployee)}
        onClose={closePasswordModal}
        title="Đổi mật khẩu nhân viên"
        maxWidth="max-w-md"
      >
        {passwordEmployee && (
          <form onSubmit={changePassword} className="space-y-5">
            <div className="bg-[#f4fcfe] p-4">
              <p className="font-bold text-gray-950">
                {passwordEmployee.code} - {passwordEmployee.name}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                Nhân viên sẽ đăng nhập bằng mã nhân viên và mật khẩu mới này.
              </p>
            </div>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-gray-700">Mật khẩu mới</span>
              <input
                type="password"
                value={passwordForm}
                onChange={(event) => setPasswordForm(event.target.value)}
                className="h-11 w-full border border-gray-300 px-3 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
                placeholder="Nhập mật khẩu mới"
                minLength={6}
                autoFocus
                required
              />
              <p className="mt-1 text-xs text-gray-500">Tối thiểu 6 ký tự.</p>
            </label>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closePasswordModal}
                disabled={isPasswordSaving}
                className="border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isPasswordSaving}
                className="bg-[#0f3b46] px-4 py-2 font-semibold text-white hover:bg-[#174f5d] disabled:opacity-60"
              >
                {isPasswordSaving ? 'Đang lưu...' : 'Lưu mật khẩu'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(confirmAction)}
        onClose={() => !isConfirming && setConfirmAction(null)}
        title={confirmAction?.type === 'delete' ? 'Xác nhận xóa nhân viên' : 'Xác nhận cập nhật tài khoản'}
        maxWidth="max-w-md"
      >
        {confirmAction && (
          <div className="space-y-5">
            <div className={`flex gap-4 p-4 ${confirmAction.type === 'delete' ? 'bg-red-50' : 'bg-[#f4fcfe]'}`}>
              <div className={`grid h-11 w-11 shrink-0 place-items-center ${confirmAction.type === 'delete' ? 'bg-red-100 text-red-600' : 'bg-[#c0edf7] text-[#0f3b46]'}`}>
                {confirmAction.type === 'delete' ? <AlertTriangle size={22} /> : <Edit size={22} />}
              </div>
              <div>
                <p className="font-bold text-gray-950">
                  {confirmAction.employee.code} - {confirmAction.employee.name}
                </p>
                <p className="mt-1 text-sm leading-6 text-gray-600">
                  {confirmAction.type === 'delete'
                    ? 'Nhân viên sẽ bị xóa khỏi hệ thống. Thao tác này không thể hoàn tác.'
                    : 'Các thông tin vừa chỉnh sửa sẽ được lưu vào tài khoản nhân viên này.'}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={isConfirming}
                className="border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={executeConfirmedAction}
                disabled={isConfirming}
                className={`px-4 py-2 font-semibold text-white disabled:opacity-60 ${confirmAction.type === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#0f3b46] hover:bg-[#174f5d]'}`}
              >
                {isConfirming ? 'Đang xử lý...' : confirmAction.type === 'delete' ? 'Xác nhận xóa' : 'Xác nhận cập nhật'}
              </button>
            </div>
          </div>
        )}
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
                <span className="text-gray-500">Mật khẩu đăng nhập</span>
                {revealedPasswords[viewingEmployee.id] ? (
                  <p className="font-semibold text-gray-950">{revealedPasswords[viewingEmployee.id]}</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => openPasswordModal(viewingEmployee)}
                    className="mt-1 font-semibold text-[#0f3b46] underline underline-offset-2"
                  >
                    Đổi mật khẩu đăng nhập
                  </button>
                )}
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
                <span className="text-gray-500">Đăng nhập gần nhất</span>
                <p className="font-semibold text-[#58779a]">{formatDateTime(viewingEmployee.lastLoginAt)}</p>
              </div>
              <div>
                <span className="text-gray-500">Ngày tạo</span>
                <p className="font-semibold text-gray-950">{formatDate(viewingEmployee.createdAt)}</p>
              </div>
              <div className="md:col-span-2">
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
