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
  Square,
  StopCircle,
  Users
} from 'lucide-react';
import Modal from '../components/Modal';

const STORAGE_KEY = 'ztech-shifts';
const TODAY = '2026-06-10';

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

const employeeOptions = [
  'Trần Thị Hạnh',
  'Lê Quốc Khoa',
  'Phạm Gia Bảo',
  'Nguyễn Văn Minh'
];

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
    name: 'Ca chiều',
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

const emptyForm = {
  name: '',
  employee: employeeOptions[0],
  startTime: '08:00',
  endTime: '12:00',
  workDate: TODAY,
  status: 'scheduled',
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
  return name
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
  return date >= range.from && date <= range.to;
}

function getShiftStats(shifts) {
  const todayShifts = shifts.filter((shift) => shift.workDate === TODAY);
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

export default function Shifts() {
  const [shifts, setShifts] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : initialShifts;
  });
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('today');
  const [statusFilter, setStatusFilter] = useState('all');
  const [form, setForm] = useState(emptyForm);
  const [editingShift, setEditingShift] = useState(null);
  const [viewingShift, setViewingShift] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shifts));
  }, [shifts]);

  const stats = useMemo(() => getShiftStats(shifts), [shifts]);

  const filteredShifts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const dateRange = getDateRange(period);

    return shifts.filter((shift) => {
      const matchesPeriod = isDateInRange(shift.workDate, dateRange);
      const matchesStatus = statusFilter === 'all' || shift.status === statusFilter;
      const matchesKeyword = [shift.code, shift.name, shift.employee, shift.note]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(keyword));

      return matchesPeriod && matchesStatus && matchesKeyword;
    });
  }, [shifts, search, period, statusFilter]);

  const openCreate = () => {
    setEditingShift(null);
    setForm(emptyForm);
    setIsFormOpen(true);
  };

  const openEdit = (shift) => {
    setEditingShift(shift);
    setForm({
      name: shift.name,
      employee: shift.employee,
      startTime: shift.startTime,
      endTime: shift.endTime,
      workDate: shift.workDate,
      status: shift.status,
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

    const nextShift = {
      ...form,
      id: editingShift?.id ?? Date.now(),
      code: editingShift?.code ?? getNextShiftCode(shifts),
      name: form.name.trim(),
      note: form.note.trim()
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
      toast.success('Đã thêm ca làm');
    }

    closeForm();
  };

  const updateShiftStatus = (shift, status) => {
    setShifts((current) =>
      current.map((item) => (item.id === shift.id ? { ...item, status } : item))
    );

    toast.success(getStatusMeta(status).label);
  };

  return (
    <div className="space-y-6">
      <section>
        <div>
          <h1 className="text-2xl font-bold text-gray-950">Quản lý ca làm</h1>
          <p className="mt-1 text-sm text-gray-500">
            Theo dõi lịch làm việc, phân công nhân viên và trạng thái các ca bán hàng.
          </p>
        </div>
      </section>

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
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#c0edf7] px-5 font-semibold text-[#0f3b46] transition hover:bg-[#a9e3ef]"
        >
          <PlusCircle size={19} />
          <span>Thêm ca làm</span>
        </button>
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
                          disabled={shift.status === 'completed'}
                          className="rounded-lg p-2 text-gray-500 transition hover:bg-[#c0edf7] hover:text-[#0f3b46] disabled:cursor-not-allowed disabled:opacity-40"
                          title="Chỉnh sửa"
                          aria-label="Chỉnh sửa"
                        >
                          <Edit size={18} />
                        </button>
                        {shift.status === 'scheduled' && (
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
                        {shift.status === 'active' && (
                          <button
                            type="button"
                            onClick={() => updateShiftStatus(shift, 'completed')}
                            className="rounded-lg p-2 text-red-600 transition hover:bg-red-50"
                            title="Dừng ca"
                            aria-label="Dừng ca"
                          >
                            <StopCircle size={18} />
                          </button>
                        )}
                        {shift.status === 'completed' && (
                          <button
                            type="button"
                            className="rounded-lg p-2 text-gray-500 transition hover:bg-[#f4fcfe]"
                            title="Đã kết thúc"
                            aria-label="Đã kết thúc"
                          >
                            <Square size={18} />
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

        <div className="flex items-center justify-between border-t border-[#edf7f9] px-5 py-4 text-sm text-gray-500">
          <span>
            Hiển thị <strong className="text-gray-950">{filteredShifts.length}</strong> của{' '}
            <strong className="text-gray-950">{shifts.length}</strong> ca làm
          </span>
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#c0edf7] font-bold text-[#0f3b46]">1</div>
        </div>
      </section>

      <Modal isOpen={isFormOpen} onClose={closeForm} title={editingShift ? 'Sửa ca làm' : 'Thêm ca làm'}>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Tên ca</span>
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
              placeholder="VD: Ca sáng"
              required
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Nhân viên phụ trách</span>
            <select
              value={form.employee}
              onChange={(event) => setForm({ ...form, employee: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
            >
              {employeeOptions.map((employee) => (
                <option key={employee} value={employee}>
                  {employee}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Giờ bắt đầu</span>
            <input
              type="time"
              value={form.startTime}
              onChange={(event) => setForm({ ...form, startTime: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
              required
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Giờ kết thúc</span>
            <input
              type="time"
              value={form.endTime}
              onChange={(event) => setForm({ ...form, endTime: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
              required
            />
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
            <span className="mb-1 block text-sm font-medium text-gray-700">Trạng thái</span>
            <select
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
            >
              {statusOptions
                .filter((option) => option.value !== 'all')
                .map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
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
              <div>
                <span className="text-gray-500">Ghi chú</span>
                <p className="font-semibold text-gray-950">{viewingShift.note || 'Chưa có ghi chú'}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
