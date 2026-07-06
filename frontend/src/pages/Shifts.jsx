import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Edit,
  Eye,
  PlayCircle,
  PlusCircle,
  Search,
  StopCircle,
  Users
} from 'lucide-react';
import api from '../api/axios';
import Modal from '../components/Modal';
import { getUser, isFullAccessRole } from '../utils/auth';
import { readLocalJson } from '../utils/storage';
import { formatCurrency } from '../utils/format';

const STORAGE_KEY = 'ztech-shifts';
const TODAY = new Date().toISOString().slice(0, 10);

const periodOptions = [
  { value: 'today', label: 'Hôm nay' },
  { value: 'week', label: 'Tuần này' },
  { value: 'month', label: 'Tháng này' },
  { value: 'all', label: 'Tất cả' }
];

const statusOptions = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'scheduled', label: 'Chưa bắt đầu' },
  { value: 'active', label: 'Đang làm' },
  { value: 'completed', label: 'Đã kết thúc' },
  { value: 'cancelled', label: 'Đã hủy' }
];


const shiftNameOptions = ['Ca sáng', 'Ca trưa', 'Ca chiều', 'Ca tối'];

const timeOptions24h = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, '0');
  const minutes = index % 2 === 0 ? '00' : '30';
  return `${hours}:${minutes}`;
});

const initialShifts = [
  {
    id: 1,
    code: 'CA001',
    name: 'Ca sáng',
    employee: 'Trần Thị Hạnh',
    startTime: '08:00',
    endTime: '12:00',
    workDate: TODAY,
    status: 'active',
    note: 'Bán hàng tại quầy'
  },
  {
    id: 2,
    code: 'CA002',
    name: 'Ca trưa',
    employee: 'Lê Quốc Khoa',
    startTime: '13:00',
    endTime: '17:00',
    workDate: TODAY,
    status: 'scheduled',
    note: 'Kiểm kho và bán hàng'
  },
  {
    id: 3,
    code: 'CA003',
    name: 'Ca tối',
    employee: 'Phạm Gia Bảo',
    startTime: '18:00',
    endTime: '22:00',
    workDate: TODAY,
    status: 'scheduled',
    note: 'Bán hàng tại quầy'
  },
  {
    id: 4,
    code: 'CA004',
    name: 'Ca sáng',
    employee: 'Nguyễn Văn Minh',
    startTime: '08:00',
    endTime: '12:00',
    workDate: '2026-06-09',
    status: 'completed',
    note: 'Quản lý cửa hàng'
  }
];

// Used until the employee API responds, and as a safe fallback when it is
// unavailable. This must be declared before emptyForm is initialized.
const employeeOptions = Array.from(
  new Set(initialShifts.map((shift) => shift.employee).filter(Boolean))
);

function sanitizeShifts(value, fallback = []) {
  if (!Array.isArray(value)) return fallback;
  return value.filter((shift) => shift && typeof shift === 'object' && !Array.isArray(shift));
}

const emptyForm = {
  name: shiftNameOptions[0],
  employee: employeeOptions[0],
  startTime: '08:00',
  endTime: '12:00',
  workDate: TODAY,
  status: 'scheduled',
  openingCash: 0,
  note: ''
};

function getStatusMeta(status) {
  const statusMap = {
    scheduled: {
      label: 'Chưa bắt đầu',
      badgeClass: 'bg-slate-100 text-slate-600',
      dotClass: 'bg-slate-400'
    },
    active: {
      label: 'Đang làm',
      badgeClass: 'bg-emerald-50 text-emerald-700',
      dotClass: 'bg-emerald-600'
    },
    completed: {
      label: 'Đã kết thúc',
      badgeClass: 'bg-[#c0edf7] text-[#0f3b46]',
      dotClass: 'bg-[#0f3b46]'
    },
    cancelled: {
      label: 'Đã hủy',
      badgeClass: 'bg-red-100 text-red-700',
      dotClass: 'bg-red-600'
    }
  };

  return statusMap[status] || statusMap.scheduled;
}

function getInitials(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function getNextShiftCode(shifts) {
  const nextNumber = shifts.reduce((max, shift) => {
    const number = Number(String(shift.code).replace(/\D/g, ''));
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 0) + 1;

  return `CA${String(nextNumber).padStart(3, '0')}`;
}

function formatDate(value) {
  if (!value) return '';

  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

function getCurrentTime() {
  return new Date().toTimeString().slice(0, 5);
}

function getDateRange(period) {
  if (period === 'today') {
    return { from: TODAY, to: TODAY };
  }

  if (period === 'week') {
    return { from: '2026-06-08', to: '2026-06-14' };
  }

  if (period === 'month') {
    return { from: '2026-06-01', to: '2026-06-30' };
  }

  return null;
}

function isDateInRange(date, range) {
  if (!range) return true;
  const normalizedDate = String(date || '').slice(0, 10);
  return normalizedDate >= range.from && normalizedDate <= range.to;
}

function getShiftStats(shifts) {
  const todayShifts = sanitizeShifts(shifts).filter((shift) => shift.workDate === TODAY);
  const active = todayShifts.filter((shift) => shift.status === 'active').length;
  const completed = todayShifts.filter((shift) => shift.status === 'completed').length;
  const employees = new Set(todayShifts.map((shift) => shift.employee)).size;

  return {
    todayTotal: todayShifts.length,
    active,
    completed,
    employees
  };
}

export default function Shifts({ embedded = false }) {
  const user = getUser();
  const hasFullAccess = isFullAccessRole(user?.role);
  const currentEmployeeName = user?.name || 'Nhân viên';
  const [shifts, setShifts] = useState(() => {
    return sanitizeShifts(readLocalJson(STORAGE_KEY, initialShifts, Array.isArray), initialShifts);
  });
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('today');
  const [statusFilter, setStatusFilter] = useState('all');
  const [employeeChoices, setEmployeeChoices] = useState(employeeOptions);
  const [form, setForm] = useState(emptyForm);
  const [editingShift, setEditingShift] = useState(null);
  const [viewingShift, setViewingShift] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [closingShift, setClosingShift] = useState(null);
  const [actualCash, setActualCash] = useState('');
  const [shiftStoreReady, setShiftStoreReady] = useState(false);

  useEffect(() => {
    api.get('/shifts').then(async (response) => {
      const sharedShifts = sanitizeShifts(response.data);
      if (sharedShifts.length) setShifts(sharedShifts);
      else if (hasFullAccess) await api.put('/shifts', shifts);
      setShiftStoreReady(true);
    }).catch(() => setShiftStoreReady(true));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shifts));
    if (shiftStoreReady && hasFullAccess) api.put('/shifts', shifts).catch(() => toast.error('Không thể đồng bộ ca làm lên hệ thống'));
  }, [shifts, shiftStoreReady, hasFullAccess]);

  useEffect(() => { api.get('/orders').then((response) => setOrders(response.data || [])).catch(() => setOrders([])); }, []);

  useEffect(() => {
    if (!hasFullAccess) {
      return;
    }

    api
      .get('/employees')
      .then((response) => {
        const employees = Array.isArray(response.data) ? response.data : [];
        const activeNames = employees
          .filter((employee) => employee.status === 'active')
          .map((employee) => employee.name)
          .filter(Boolean);
        const names = activeNames.length
          ? activeNames
          : employees.map((employee) => employee.name).filter(Boolean);

        setEmployeeChoices(names.length ? Array.from(new Set(names)) : employeeOptions);
      })
      .catch(() => {
        setEmployeeChoices(employeeOptions);
      });
  }, [hasFullAccess]);

  useEffect(() => {
    if (!isFormOpen || !employeeChoices.length || employeeChoices.includes(form.employee)) {
      return;
    }

    setForm((current) => ({ ...current, employee: employeeChoices[0] }));
  }, [employeeChoices, form.employee, isFormOpen]);

  const stats = useMemo(() => getShiftStats(shifts), [shifts]);

  const filteredShifts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const dateRange = getDateRange(period);

    return shifts.filter((shift) => {
      if (!shift || typeof shift !== 'object') return false;
      const matchesEmployee = hasFullAccess || shift.employee === currentEmployeeName;
      const matchesPeriod = isDateInRange(shift.workDate, dateRange);
      const matchesStatus = statusFilter === 'all' || shift.status === statusFilter;
      const matchesKeyword = [shift.code, shift.name, shift.employee, shift.note]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));

      return matchesEmployee && matchesPeriod && matchesStatus && matchesKeyword;
    });
  }, [shifts, search, period, statusFilter, hasFullAccess, currentEmployeeName]);

  const openCreate = () => {
    if (!hasFullAccess) {
      toast.error('Chỉ quản lý mới được mở ca cho nhân viên');
      return;
    }

    setEditingShift(null);
    setForm({ ...emptyForm, employee: employeeChoices[0] || emptyForm.employee });
    setIsFormOpen(true);
  };

  const openEdit = (shift) => {
    if (!hasFullAccess) {
      toast.error('Chỉ quản lý mới được chỉnh sửa ca làm');
      return;
    }

    setEditingShift(shift);
    setForm({
      name: shift.name,
      employee: shift.employee,
      startTime: shift.startTime,
      endTime: shift.endTime,
      workDate: shift.workDate,
      status: shift.status,
      openingCash: Number(shift.openingCash || 0),
      note: shift.note || ''
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingShift(null);
    setForm(emptyForm);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!hasFullAccess) {
      toast.error('Chỉ quản lý mới được mở hoặc cập nhật ca làm');
      return;
    }

    const nextShift = {
      ...form,
      id: editingShift?.id ?? Date.now(),
      code: editingShift?.code ?? getNextShiftCode(shifts),
      name: form.name.trim(),
      note: form.note.trim(),
      status: editingShift ? form.status : 'active',
      openingCash: Math.max(Number(form.openingCash || 0), 0)
    };

    if (nextShift.startTime >= nextShift.endTime) {
      toast.error('Giờ kết thúc phải sau giờ bắt đầu');
      return;
    }

    if (editingShift) {
      setShifts((current) => current.map((shift) => (shift.id === editingShift.id ? nextShift : shift)));
      toast.success('Đã cập nhật ca làm');
    } else {
      setShifts((current) => [nextShift, ...current]);
      toast.success(`${nextShift.employee} bắt đầu làm`);
    }

    closeForm();
  };

  const updateShiftStatus = (shift, status) => {
    if (!hasFullAccess) {
      toast.error('Chỉ quản lý mới được mở hoặc kết thúc ca làm');
      return;
    }

    const now = getCurrentTime();

    setShifts((current) =>
      current.map((item) =>
        item.id === shift.id
          ? {
              ...item,
              status,
              startTime: status === 'active' ? now : item.startTime,
              endTime: status === 'completed' || status === 'active' ? now : item.endTime
            }
          : item
      )
    );

    toast.success(getStatusMeta(status).label);
  };

  const getCashSales = (shift) => orders.filter((order) => order.status !== 'cancelled' && order.payment_method === 'cash' && order.cashier_name === shift.employee && String(order.created_at || '').slice(0, 10) === shift.workDate).reduce((sum, order) => sum + Number(order.total || 0), 0);
  const getExpectedCash = (shift) => Number(shift.openingCash || 0) + Number(shift.cashSales ?? getCashSales(shift));

  const openCloseShift = (shift) => { setClosingShift(shift); setActualCash(''); };
  const confirmCloseShift = () => {
    const cashSales = getCashSales(closingShift);
    const expectedCash = Number(closingShift.openingCash || 0) + cashSales;
    const actual = Math.max(Number(actualCash || 0), 0);
    const now = getCurrentTime();
    setShifts((current) => current.map((item) => item.id === closingShift.id ? { ...item, status: 'completed', endTime: now, cashSales, expectedCash, actualCash: actual, cashDifference: actual - expectedCash } : item));
    setClosingShift(null); setActualCash(''); toast.success('Đã chốt ca làm');
  };

  return (
    <div className="space-y-6">
      {!embedded && <section>
        <div>
          <h1 className="text-2xl font-extrabold text-gray-950">Quản lý ca làm</h1>
          <p className="mt-1 text-sm font-medium text-gray-500">
            Sắp xếp lịch làm việc, phân công nhân viên và theo dõi trạng thái từng ca bán hàng.
          </p>
        </div>
      </section>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex items-center gap-4 rounded-lg border border-[#d7eef3] bg-white p-5 shadow-sm">
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-[#c0edf7] text-[#0f3b46]">
            <CalendarDays size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Tổng ca hôm nay</p>
            <p className="text-3xl font-bold text-gray-950">{stats.todayTotal}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-lg border border-[#d7eef3] bg-white p-5 shadow-sm">
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
            <PlayCircle size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Đang làm</p>
            <p className="text-3xl font-bold text-gray-950">{stats.active}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-lg border border-[#d7eef3] bg-white p-5 shadow-sm">
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-[#f4fcfe] text-[#0f3b46]">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Đã kết thúc</p>
            <p className="text-3xl font-bold text-gray-950">{stats.completed}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-lg border border-[#d7eef3] bg-white p-5 shadow-sm">
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-blue-50 text-blue-600">
            <BadgeCheck size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Nhân viên trong ca</p>
            <p className="text-3xl font-bold text-gray-950">{stats.employees}</p>
          </div>
        </div>
      </section>

      <section className="flex flex-col justify-between gap-4 rounded-lg border border-[#d7eef3] bg-white p-4 shadow-sm xl:flex-row xl:items-center">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative min-w-[300px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 w-full rounded-lg border border-[#d7eef3] bg-white pl-10 pr-4 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
              placeholder="Tìm kiếm ca làm hoặc nhân viên..."
            />
          </div>
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            className="h-11 rounded-lg border border-[#d7eef3] bg-white px-3 text-sm outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
          >
            {periodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-11 rounded-lg border border-[#d7eef3] bg-white px-3 text-sm outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {hasFullAccess ? (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#c0edf7] px-5 font-semibold text-[#0f3b46] transition hover:bg-[#a9e3ef]"
          >
            <PlusCircle size={19} />
            <span>Thêm ca làm</span>
          </button>
        ) : (
          <div className="rounded-lg border border-[#d7eef3] bg-[#f4fcfe] px-4 py-3 text-sm font-semibold text-[#0f3b46]">
            Ca làm của bạn sẽ do quản lý mở trước khi bắt đầu làm việc.
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-[#d7eef3] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="bg-[#f4fcfe] text-gray-500">
              <tr>
                <th className="px-5 py-4 font-semibold">Mã ca</th>
                <th className="px-5 py-4 font-semibold">Tên ca</th>
                <th className="px-5 py-4 font-semibold">Nhân viên phụ trách</th>
                <th className="px-5 py-4 font-semibold">Thời gian</th>
                <th className="px-5 py-4 font-semibold">Ngày làm</th>
                <th className="px-5 py-4 font-semibold">Tiền đầu ca</th>
                <th className="px-5 py-4 font-semibold">Trạng thái</th>
                <th className="px-5 py-4 font-semibold">Ghi chú</th>
                <th className="px-5 py-4 text-center font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf7f9]">
              {filteredShifts.map((shift) => {
                const statusMeta = getStatusMeta(shift.status);

                return (
                  <tr key={shift.id} className="transition hover:bg-[#f8fdfe]">
                    <td className="px-5 py-4 font-bold text-[#0f3b46]">{shift.code}</td>
                    <td className="px-5 py-4 font-semibold text-gray-950">{shift.name}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="grid h-8 w-8 place-items-center rounded-full bg-[#c0edf7] text-xs font-bold text-[#0f3b46]">
                          {getInitials(shift.employee)}
                        </div>
                        <span className="font-medium text-gray-800">{shift.employee}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-700">
                      <div className="flex items-center gap-2">
                        <Clock3 size={15} className="text-gray-400" />
                        <span>{shift.startTime} - {shift.endTime}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-700">{formatDate(shift.workDate)}</td>
                    <td className="px-5 py-4 font-semibold text-gray-800">{formatCurrency(shift.openingCash || 0)}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${statusMeta.badgeClass}`}>
                        <span className={`mr-2 h-2 w-2 rounded-full ${statusMeta.dotClass}`} />
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 italic text-gray-500">{shift.note}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setViewingShift(shift)}
                          className="rounded-lg p-2 text-gray-500 transition hover:bg-[#c0edf7] hover:text-[#0f3b46]"
                          title="Chi tiết"
                          aria-label="Chi tiết"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(shift)}
                          style={{ display: hasFullAccess ? undefined : 'none' }}
                          disabled={shift.status === 'completed'}
                          className="rounded-lg p-2 text-gray-500 transition hover:bg-[#c0edf7] hover:text-[#0f3b46] disabled:cursor-not-allowed disabled:opacity-40"
                          title="Chỉnh sửa"
                          aria-label="Chỉnh sửa"
                        >
                          <Edit size={18} />
                        </button>
                        {hasFullAccess && shift.status === 'scheduled' && (
                          <button
                            type="button"
                            onClick={() => updateShiftStatus(shift, 'active')}
                            className="rounded-lg p-2 text-emerald-600 transition hover:bg-emerald-50"
                            title="Bắt đầu"
                            aria-label="Bắt đầu"
                          >
                            <PlayCircle size={18} />
                          </button>
                        )}
                        {hasFullAccess && shift.status === 'active' && (
                          <button
                            type="button"
                            onClick={() => openCloseShift(shift)}
                            className="rounded-lg p-2 text-red-600 transition hover:bg-red-50"
                            title="Dừng ca"
                            aria-label="Dừng ca"
                          >
                            <StopCircle size={18} />
                          </button>
                        )}
                        {hasFullAccess && shift.status === 'completed' && (
                          <button
                            type="button"
                            onClick={() => updateShiftStatus(shift, 'active')}
                            className="rounded-lg p-2 text-emerald-600 transition hover:bg-emerald-50"
                            title="Mở lại ca"
                            aria-label="Mở lại ca"
                          >
                            <PlayCircle size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <Modal isOpen={isFormOpen} onClose={closeForm} title={editingShift ? 'Sửa ca làm' : 'Thêm ca làm'}>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Tên ca</span>
            <select
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
              required
            >
              {shiftNameOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Nhân viên phụ trách</span>
            <select
              value={form.employee}
              onChange={(event) => setForm({ ...form, employee: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
            >
              {employeeChoices.map((employee) => (
                <option key={employee} value={employee}>
                  {employee}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Giờ bắt đầu</span>
            <select
              value={form.startTime}
              onChange={(event) => setForm({ ...form, startTime: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
              required
            >
              {timeOptions24h.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Giờ kết thúc</span>
            <select
              value={form.endTime}
              onChange={(event) => setForm({ ...form, endTime: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
              required
            >
              {timeOptions24h.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Ngày làm</span>
            <input
              type="date"
              value={form.workDate}
              onChange={(event) => setForm({ ...form, workDate: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
              required
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Tiền đầu ca</span>
            <div className="relative"><input type="number" min="0" step="1000" value={form.openingCash} onChange={(event) => setForm({ ...form, openingCash: event.target.value === '' ? '' : Math.max(Number(event.target.value), 0) })} className="w-full border border-gray-300 px-3 py-2 pr-10 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]" placeholder="0"/><span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-500">đ</span></div>
            <p className="mt-1 text-xs text-gray-500">{formatCurrency(Number(form.openingCash || 0))}</p>
          </label>
          <label className="md:col-span-2">
            <span className="mb-1 block text-sm font-medium text-gray-700">Ghi chú</span>
            <textarea
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
              className="min-h-24 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
            />
          </label>
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

      <Modal isOpen={Boolean(viewingShift)} onClose={() => setViewingShift(null)} title="Chi tiết ca làm">
        {viewingShift && (
          <div className="space-y-4">
            <div className="rounded-lg bg-[#f4fcfe] p-4">
              <div className="text-sm font-bold text-[#0f3b46]">{viewingShift.code}</div>
              <div className="mt-1 text-xl font-bold text-gray-950">{viewingShift.name}</div>
              <div className="mt-2">
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${getStatusMeta(viewingShift.status).badgeClass}`}>
                  {getStatusMeta(viewingShift.status).label}
                </span>
              </div>
            </div>
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <div>
                <span className="text-gray-500">Nhân viên phụ trách</span>
                <p className="font-semibold text-gray-950">{viewingShift.employee}</p>
              </div>
              <div>
                <span className="text-gray-500">Thời gian</span>
                <p className="font-semibold text-gray-950">{viewingShift.startTime} - {viewingShift.endTime}</p>
              </div>
              <div>
                <span className="text-gray-500">Ngày làm</span>
                <p className="font-semibold text-gray-950">{formatDate(viewingShift.workDate)}</p>
              </div>
              <div><span className="text-gray-500">Tiền đầu ca</span><p className="font-semibold text-gray-950">{formatCurrency(viewingShift.openingCash || 0)}</p></div>
              <div><span className="text-gray-500">Tiền mặt bán được trong ca</span><p className="font-semibold text-gray-950">{formatCurrency(viewingShift.cashSales ?? getCashSales(viewingShift))}</p></div>
              <div><span className="text-gray-500">Tiền mặt dự kiến cuối ca</span><p className="font-semibold text-[#0f3b46]">{formatCurrency(viewingShift.expectedCash ?? getExpectedCash(viewingShift))}</p></div>
              {viewingShift.status === 'completed' && <><div><span className="text-gray-500">Tiền mặt thực tế</span><p className="font-semibold">{formatCurrency(viewingShift.actualCash || 0)}</p></div><div><span className="text-gray-500">Chênh lệch</span><p className={`font-bold ${Number(viewingShift.cashDifference || 0) < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{formatCurrency(viewingShift.cashDifference || 0)}</p></div></>}
              <div>
                <span className="text-gray-500">Ghi chú</span>
                <p className="font-semibold text-gray-950">{viewingShift.note || 'Chưa có ghi chú'}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={Boolean(closingShift)} onClose={() => setClosingShift(null)} title="Chốt ca làm">
        {closingShift && <div className="space-y-4"><div className="grid gap-3 border bg-[#f8fdfe] p-4 text-sm sm:grid-cols-2"><div><span className="text-gray-500">Tiền đầu ca</span><p className="font-bold">{formatCurrency(closingShift.openingCash || 0)}</p></div><div><span className="text-gray-500">Tiền mặt bán được</span><p className="font-bold">{formatCurrency(getCashSales(closingShift))}</p></div><div className="sm:col-span-2"><span className="text-gray-500">Tiền mặt dự kiến cuối ca</span><p className="text-lg font-bold text-[#0f3b46]">{formatCurrency(getExpectedCash(closingShift))}</p></div></div><label className="block"><span className="mb-1 block text-sm font-semibold">Tiền mặt thực tế</span><input type="number" min="0" value={actualCash} onChange={(event) => setActualCash(event.target.value)} className="h-11 w-full border px-3" placeholder="0"/><p className="mt-1 text-xs text-gray-500">Chênh lệch dự kiến: <strong className={Number(actualCash || 0) - getExpectedCash(closingShift) < 0 ? 'text-red-600' : 'text-emerald-700'}>{formatCurrency(Number(actualCash || 0) - getExpectedCash(closingShift))}</strong></p></label><div className="flex justify-end gap-2"><button type="button" onClick={() => setClosingShift(null)} className="h-10 border px-4 font-semibold">Hủy</button><button type="button" onClick={confirmCloseShift} className="h-10 bg-brand px-4 font-bold text-white">Xác nhận chốt ca</button></div></div>}
      </Modal>
    </div>
  );
}
