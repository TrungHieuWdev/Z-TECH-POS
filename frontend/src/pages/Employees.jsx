import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  Box,
  CalendarDays,
  CircleX,
  Download,
  Edit,
  Eye,
  FileSpreadsheet,
  Filter,
  KeyRound,
  Lock,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  Unlock,
  UserCheck,
  UserPlus,
  UserSquare2,
  UserX,
  WalletCards,
  Users
} from 'lucide-react';
import api from '../api/axios';
import KpiCard from '../components/KpiCard';
import Modal from '../components/Modal';
import TablePagination from '../components/TablePagination';
import Shifts from './Shifts';

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

function formatSaleDateTime(value) {
  if (!value) return '';
  const text = String(value);
  if (text.includes('T') || text.endsWith('Z')) {
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).format(parsed);
    }
  }
  return formatDateTime(text.slice(0, 19));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatPaymentMethod(value) {
  const methods = {
    cash: 'Tiền mặt',
    card: 'Thẻ',
    transfer: 'Chuyển khoản'
  };

  return methods[value] || value || 'Không rõ';
}

function getTodayInputValue() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function getDefaultRevenueRange() {
  const to = getTodayInputValue();
  const fromDate = new Date(`${to}T00:00:00+07:00`);
  fromDate.setDate(fromDate.getDate() - 29);
  const from = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(fromDate);
  return { from, to };
}

function formatOrderStatus(value) {
  return value === 'cancelled' ? 'Đã hủy' : 'Hoàn thành';
}

function orderStatusClass(value) {
  return value === 'cancelled'
    ? 'bg-rose-50 text-rose-700'
    : 'bg-emerald-50 text-emerald-700';
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function styleExcelTitle(sheet, range, title, subtitle = '') {
  sheet.mergeCells(range);
  const cell = sheet.getCell(range.split(':')[0]);
  cell.value = title;
  cell.font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3B46' } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(cell.row).height = 34;
  if (subtitle) {
    const subtitleRow = cell.row + 1;
    sheet.mergeCells(subtitleRow, 1, subtitleRow, sheet.getColumn(range.split(':')[1].replace(/\d/g, '')).number);
    const subtitleCell = sheet.getCell(subtitleRow, 1);
    subtitleCell.value = subtitle;
    subtitleCell.font = { italic: true, color: { argb: 'FF475569' } };
    subtitleCell.alignment = { horizontal: 'center' };
  }
}

function styleExcelHeader(row, color = 'FF0891B2') {
  row.height = 24;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
  });
}

function styleExcelBody(sheet, startRow, endRow, moneyColumns = []) {
  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    row.height = 22;
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFCBD5E1' } } };
      if (rowNumber % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    });
  }
  moneyColumns.forEach((column) => { sheet.getColumn(column).numFmt = '#,##0 "đ"'; });
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
  const location = useLocation();
  const navigate = useNavigate();
  const employeeTab = location.pathname.endsWith('/revenue') ? 'revenue' : location.pathname.endsWith('/shifts') ? 'shifts' : 'accounts';
  const [employees, setEmployees] = useState([]);
  const [loadingPage, setLoadingPage] = useState(true);
  const activeTab = employeeTab;
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRevenueEmployeeId, setSelectedRevenueEmployeeId] = useState('');
  const initialRevenueRange = useMemo(getDefaultRevenueRange, []);
  const [revenueFilterDraft, setRevenueFilterDraft] = useState({
    ...initialRevenueRange,
    status: 'all',
    paymentMethod: 'all',
    search: ''
  });
  const [revenueFilters, setRevenueFilters] = useState({
    ...initialRevenueRange,
    status: 'all',
    paymentMethod: 'all',
    search: ''
  });
  const [revenuePage, setRevenuePage] = useState(1);
  const [revenueProductPage, setRevenueProductPage] = useState(1);
  const [employeeRevenue, setEmployeeRevenue] = useState(null);
  const [loadingRevenue, setLoadingRevenue] = useState(false);
  const [selectedRevenueOrder, setSelectedRevenueOrder] = useState(null);
  const [loadingRevenueOrder, setLoadingRevenueOrder] = useState(false);
  const [exportingRevenue, setExportingRevenue] = useState('');
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

  useEffect(() => {
    if (!selectedRevenueEmployeeId && employees.length > 0) {
      setSelectedRevenueEmployeeId(String(employees[0].id));
    }
  }, [employees, selectedRevenueEmployeeId]);

  const loadEmployeeRevenue = async ({ page = revenuePage, filters = revenueFilters, limit = 10 } = {}) => {
    if (!selectedRevenueEmployeeId) return;

    setLoadingRevenue(true);
    try {
      const response = await api.get('/employees/revenue', {
        params: {
          employeeId: selectedRevenueEmployeeId,
          ...filters,
          page,
          limit
        }
      });
      setEmployeeRevenue(response.data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể tải doanh thu nhân viên');
      setEmployeeRevenue(null);
    } finally {
      setLoadingRevenue(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'revenue') {
      loadEmployeeRevenue();
    }
  }, [activeTab, selectedRevenueEmployeeId, revenueFilters, revenuePage]);

  const stats = useMemo(() => getEmployeeStats(employees), [employees]);
  const revenueProducts = employeeRevenue?.products || [];
  const visibleRevenueProducts = useMemo(
    () => revenueProducts.slice((revenueProductPage - 1) * 10, revenueProductPage * 10),
    [revenueProducts, revenueProductPage]
  );

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

  const applyRevenueFilters = () => {
    if (!revenueFilterDraft.from || !revenueFilterDraft.to || revenueFilterDraft.from > revenueFilterDraft.to) {
      toast.error('Khoảng ngày bán không hợp lệ');
      return;
    }
    const nextFilters = {
      ...revenueFilterDraft,
      search: revenueFilterDraft.search.trim()
    };
    const filtersChanged = JSON.stringify(nextFilters) !== JSON.stringify(revenueFilters);
    setRevenuePage(1);
    setRevenueProductPage(1);
    setRevenueFilters(nextFilters);
    if (!filtersChanged && revenuePage === 1) loadEmployeeRevenue({ page: 1, filters: nextFilters });
  };

  const loadAllRevenueOrders = async () => {
    const firstResponse = await api.get('/employees/revenue', {
      params: {
        employeeId: selectedRevenueEmployeeId,
        ...revenueFilters,
        page: 1,
        limit: 100
      }
    });
    const firstData = firstResponse.data;
    const totalPages = Number(firstData.pagination?.totalPages || 1);
    if (totalPages <= 1) return firstData;

    const remaining = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, index) => api.get('/employees/revenue', {
        params: {
          employeeId: selectedRevenueEmployeeId,
          ...revenueFilters,
          page: index + 2,
          limit: 100
        }
      }))
    );
    return {
      ...firstData,
      orders: [firstData.orders, ...remaining.map((response) => response.data.orders)].flat()
    };
  };

  const loadRevenueOrderDetails = async (orders) => {
    const details = [];
    for (let index = 0; index < orders.length; index += 8) {
      const batch = orders.slice(index, index + 8);
      const responses = await Promise.all(batch.map((order) => api.get(`/orders/${order.id}`)));
      details.push(...responses.map((response) => response.data));
    }
    return details;
  };

  const exportRevenueCsv = async () => {
    if (!selectedRevenueEmployeeId) return;
    try {
      setExportingRevenue('csv');
      const exportData = await loadAllRevenueOrders();
      const headers = ['Mã đơn', 'Thời gian', 'Khách hàng', 'Trạng thái', 'Thanh toán', 'Số lượng SP', 'Tổng tiền'];
      const rows = exportData.orders.map((order) => [
        order.order_number,
        formatSaleDateTime(order.created_at),
        order.customer_name,
        formatOrderStatus(order.status),
        formatPaymentMethod(order.payment_method),
        order.item_quantity,
        order.total
      ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
      downloadBlob(
        new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' }),
        `lich-su-ban-hang-${exportData.employee.code}-${exportData.range.from}-${exportData.range.to}.csv`
      );
      toast.success('Đã xuất lịch sử bán hàng CSV');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể xuất lịch sử bán hàng CSV');
    } finally {
      setExportingRevenue('');
    }
  };

  const exportRevenueExcel = async () => {
    if (!selectedRevenueEmployeeId) return;
    try {
      setExportingRevenue('excel');
      const exportData = await loadAllRevenueOrders();
      const orderDetails = await loadRevenueOrderDetails(exportData.orders);
      const { default: ExcelJS } = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Z-TECH POS';
      workbook.created = new Date();
      workbook.modified = new Date();

      const summarySheet = workbook.addWorksheet('Tổng quan');
      summarySheet.columns = [
        { width: 24 }, { width: 24 }, { width: 4 },
        { width: 24 }, { width: 24 }, { width: 24 }
      ];
      styleExcelTitle(
        summarySheet,
        'A1:F1',
        'BÁO CÁO DOANH THU & LỊCH SỬ BÁN HÀNG',
        `${exportData.employee.code} – ${exportData.employee.name} | ${exportData.range.from} đến ${exportData.range.to}`
      );
      summarySheet.addRow([]);
      summarySheet.addRow(['THÔNG TIN BỘ LỌC', '', '', 'CHỈ SỐ KINH DOANH', '', '']);
      summarySheet.mergeCells('A4:B4');
      summarySheet.mergeCells('D4:F4');
      ['A4', 'D4'].forEach((address) => {
        summarySheet.getCell(address).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        summarySheet.getCell(address).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0891B2' } };
        summarySheet.getCell(address).alignment = { horizontal: 'center' };
      });
      const paymentFilterLabels = { all: 'Tất cả phương thức', cash: 'Tiền mặt', card: 'Thẻ', transfer: 'Chuyển khoản' };
      const statusFilterLabels = { all: 'Tất cả trạng thái', completed: 'Hoàn thành', cancelled: 'Đã hủy' };
      const summaryRows = [
        ['Nhân viên', `${exportData.employee.code} – ${exportData.employee.name}`, '', 'Doanh thu hoàn thành', Number(exportData.summary.revenue || 0), 'VNĐ'],
        ['Từ ngày', exportData.range.from, '', 'Đơn hoàn thành', Number(exportData.summary.completedOrders || 0), 'đơn'],
        ['Đến ngày', exportData.range.to, '', 'Đơn đã hủy', Number(exportData.summary.cancelledOrders || 0), 'đơn'],
        ['Trạng thái', statusFilterLabels[revenueFilters.status] || revenueFilters.status, '', 'Sản phẩm đã bán', Number(exportData.summary.productsSold || 0), 'sản phẩm'],
        ['Thanh toán', paymentFilterLabels[revenueFilters.paymentMethod] || revenueFilters.paymentMethod, '', 'Giá trị TB/đơn', Number(exportData.summary.averageOrderValue || 0), 'VNĐ'],
        ['Từ khóa', revenueFilters.search || 'Không có', '', 'Tổng hóa đơn phù hợp', Number(exportData.pagination?.total || exportData.orders.length), 'hóa đơn']
      ];
      summaryRows.forEach((values) => summarySheet.addRow(values));
      for (let rowNumber = 5; rowNumber <= 10; rowNumber += 1) {
        const row = summarySheet.getRow(rowNumber);
        row.getCell(1).font = { bold: true, color: { argb: 'FF334155' } };
        row.getCell(4).font = { bold: true, color: { argb: 'FF334155' } };
        row.getCell(5).font = { bold: true, color: { argb: 'FF0F3B46' } };
        row.eachCell((cell) => {
          cell.border = { bottom: { style: 'hair', color: { argb: 'FFCBD5E1' } } };
          cell.alignment = { vertical: 'middle', wrapText: true };
        });
      }
      summarySheet.getCell('E5').numFmt = '#,##0 "đ"';
      summarySheet.getCell('E9').numFmt = '#,##0 "đ"';

      const completedOrders = exportData.orders.filter((order) => order.status === 'completed');
      const paymentBreakdown = ['cash', 'card', 'transfer'].map((method) => {
        const orders = completedOrders.filter((order) => order.payment_method === method);
        return {
          method: formatPaymentMethod(method),
          orders: orders.length,
          revenue: orders.reduce((sum, order) => sum + Number(order.total || 0), 0)
        };
      });
      summarySheet.addRow([]);
      const paymentHeader = summarySheet.addRow(['PHÂN BỔ THANH TOÁN', 'Số hóa đơn', 'Doanh thu', '', 'TOP SẢN PHẨM', 'Doanh thu']);
      styleExcelHeader(paymentHeader);
      const topProducts = exportData.products.slice(0, Math.max(3, paymentBreakdown.length));
      const breakdownRows = Math.max(paymentBreakdown.length, topProducts.length);
      for (let index = 0; index < breakdownRows; index += 1) {
        const payment = paymentBreakdown[index] || {};
        const product = topProducts[index] || {};
        summarySheet.addRow([
          payment.method || '',
          payment.orders ?? '',
          payment.revenue ?? '',
          '',
          product.name || '',
          product.revenue ?? ''
        ]);
      }
      styleExcelBody(summarySheet, paymentHeader.number + 1, paymentHeader.number + breakdownRows, [3, 6]);

      const orderSheet = workbook.addWorksheet('Hóa đơn', { views: [{ state: 'frozen', ySplit: 1 }] });
      orderSheet.columns = [
        { header: 'Mã đơn', key: 'orderNumber', width: 24 },
        { header: 'Thời gian', key: 'createdAt', width: 22 },
        { header: 'Khách hàng', key: 'customerName', width: 26 },
        { header: 'Trạng thái', key: 'status', width: 16 },
        { header: 'Thanh toán', key: 'paymentMethod', width: 18 },
        { header: 'Số lượng SP', key: 'itemQuantity', width: 15 },
        { header: 'Tạm tính', key: 'subtotal', width: 18 },
        { header: 'Giảm giá', key: 'discount', width: 18 },
        { header: 'VAT', key: 'vatAmount', width: 16 },
        { header: 'Tổng tiền', key: 'total', width: 20 },
        { header: 'Ghi chú', key: 'note', width: 36 }
      ];
      orderSheet.addRows(exportData.orders.map((order) => ({
        orderNumber: order.order_number,
        createdAt: formatSaleDateTime(order.created_at),
        customerName: order.customer_name,
        status: formatOrderStatus(order.status),
        paymentMethod: formatPaymentMethod(order.payment_method),
        itemQuantity: Number(order.item_quantity || 0),
        subtotal: Number(order.subtotal || 0),
        discount: Number(order.discount || 0),
        vatAmount: Number(order.vat_amount || 0),
        total: Number(order.total || 0),
        note: order.note || ''
      })));
      styleExcelHeader(orderSheet.getRow(1));
      styleExcelBody(orderSheet, 2, exportData.orders.length + 1, [7, 8, 9, 10]);
      orderSheet.autoFilter = 'A1:K1';

      const detailRows = orderDetails.flatMap((order) => (order.items || []).map((item) => ({
        orderNumber: order.order_number,
        createdAt: formatSaleDateTime(order.created_at),
        employee: order.cashier_name,
        customer: order.customer_name || 'Khách thường',
        status: formatOrderStatus(order.status),
        paymentMethod: formatPaymentMethod(order.payment_method),
        sku: item.sku || '',
        productName: item.product_name,
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unit_price || 0),
        lineTotal: Number(item.subtotal || 0)
      })));
      const detailSheet = workbook.addWorksheet('Chi tiết từng sản phẩm', { views: [{ state: 'frozen', ySplit: 1 }] });
      detailSheet.columns = [
        { header: 'Mã đơn', key: 'orderNumber', width: 24 },
        { header: 'Thời gian', key: 'createdAt', width: 22 },
        { header: 'Nhân viên', key: 'employee', width: 24 },
        { header: 'Khách hàng', key: 'customer', width: 24 },
        { header: 'Trạng thái', key: 'status', width: 15 },
        { header: 'Thanh toán', key: 'paymentMethod', width: 18 },
        { header: 'SKU', key: 'sku', width: 18 },
        { header: 'Sản phẩm', key: 'productName', width: 42 },
        { header: 'Số lượng', key: 'quantity', width: 14 },
        { header: 'Đơn giá', key: 'unitPrice', width: 18 },
        { header: 'Thành tiền', key: 'lineTotal', width: 20 }
      ];
      detailSheet.addRows(detailRows);
      styleExcelHeader(detailSheet.getRow(1), 'FF2563EB');
      styleExcelBody(detailSheet, 2, detailRows.length + 1, [10, 11]);
      detailSheet.autoFilter = 'A1:K1';

      const productSheet = workbook.addWorksheet('Sản phẩm đã bán', { views: [{ state: 'frozen', ySplit: 1 }] });
      productSheet.columns = [
        { header: 'SKU', key: 'sku', width: 20 },
        { header: 'Tên sản phẩm', key: 'name', width: 40 },
        { header: 'Số lượng', key: 'quantity', width: 16 },
        { header: 'Doanh thu', key: 'revenue', width: 22 }
      ];
      productSheet.addRows(exportData.products);
      styleExcelHeader(productSheet.getRow(1), 'FF7C3AED');
      styleExcelBody(productSheet, 2, exportData.products.length + 1, [4]);
      productSheet.autoFilter = 'A1:D1';

      const paymentRows = orderDetails.flatMap((order) => (order.payments || []).map((payment) => ({
        orderNumber: order.order_number,
        paidAt: formatSaleDateTime(payment.paid_at || payment.created_at),
        method: formatPaymentMethod(payment.payment_method),
        status: payment.status,
        amount: Number(payment.amount || 0),
        paidAmount: Number(payment.paid_amount || 0),
        changeAmount: Number(payment.change_amount || 0)
      })));
      const paymentSheet = workbook.addWorksheet('Giao dịch thanh toán', { views: [{ state: 'frozen', ySplit: 1 }] });
      paymentSheet.columns = [
        { header: 'Mã đơn', key: 'orderNumber', width: 24 },
        { header: 'Thời gian', key: 'paidAt', width: 22 },
        { header: 'Phương thức', key: 'method', width: 18 },
        { header: 'Trạng thái', key: 'status', width: 18 },
        { header: 'Số tiền', key: 'amount', width: 20 },
        { header: 'Khách trả', key: 'paidAmount', width: 20 },
        { header: 'Tiền thừa', key: 'changeAmount', width: 20 }
      ];
      paymentSheet.addRows(paymentRows);
      styleExcelHeader(paymentSheet.getRow(1), 'FF059669');
      styleExcelBody(paymentSheet, 2, paymentRows.length + 1, [5, 6, 7]);
      paymentSheet.autoFilter = 'A1:G1';

      const buffer = await workbook.xlsx.writeBuffer();
      downloadBlob(
        new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `lich-su-ban-hang-${exportData.employee.code}-${exportData.range.from}-${exportData.range.to}.xlsx`
      );
      toast.success('Đã xuất lịch sử bán hàng Excel');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể xuất lịch sử bán hàng Excel');
    } finally {
      setExportingRevenue('');
    }
  };

  const exportRevenueOrderExcel = async () => {
    if (!selectedRevenueOrder) return;
    try {
      setExportingRevenue(`order-${selectedRevenueOrder.id}`);
      const { default: ExcelJS } = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Z-TECH POS';
      const sheet = workbook.addWorksheet('Chi tiết hóa đơn');
      sheet.columns = [
        { width: 22 }, { width: 38 }, { width: 16 },
        { width: 20 }, { width: 20 }, { width: 20 }
      ];
      styleExcelTitle(
        sheet,
        'A1:F1',
        `CHI TIẾT HÓA ĐƠN ${selectedRevenueOrder.order_number}`,
        `${formatSaleDateTime(selectedRevenueOrder.created_at)} | ${formatOrderStatus(selectedRevenueOrder.status)}`
      );
      sheet.addRow([]);
      sheet.addRow(['Nhân viên', selectedRevenueOrder.cashier_name, '', 'Khách hàng', selectedRevenueOrder.customer_name || 'Khách thường', '']);
      sheet.addRow(['Thanh toán', formatPaymentMethod(selectedRevenueOrder.payment_method), '', 'Trạng thái', formatOrderStatus(selectedRevenueOrder.status), '']);
      sheet.addRow(['Ghi chú', selectedRevenueOrder.note || 'Không có ghi chú', '', '', '', '']);
      sheet.mergeCells('B6:F6');
      for (let rowNumber = 4; rowNumber <= 6; rowNumber += 1) {
        const row = sheet.getRow(rowNumber);
        row.getCell(1).font = { bold: true };
        row.getCell(4).font = { bold: true };
        row.eachCell((cell) => { cell.alignment = { vertical: 'middle', wrapText: true }; });
      }
      sheet.addRow([]);
      const itemHeader = sheet.addRow(['SKU', 'Sản phẩm', 'Số lượng', 'Đơn giá', 'Thành tiền', '']);
      styleExcelHeader(itemHeader);
      (selectedRevenueOrder.items || []).forEach((item) => {
        sheet.addRow([
          item.sku || '',
          item.product_name,
          Number(item.quantity || 0),
          Number(item.unit_price || 0),
          Number(item.subtotal || 0),
          ''
        ]);
      });
      const itemStart = itemHeader.number + 1;
      const itemEnd = itemHeader.number + (selectedRevenueOrder.items || []).length;
      styleExcelBody(sheet, itemStart, itemEnd, [4, 5]);
      const totalStart = itemEnd + 2;
      sheet.getCell(totalStart, 4).value = 'Tạm tính';
      sheet.getCell(totalStart, 5).value = Number(selectedRevenueOrder.subtotal || 0);
      sheet.getCell(totalStart + 1, 4).value = 'Giảm giá';
      sheet.getCell(totalStart + 1, 5).value = -Number(selectedRevenueOrder.discount || 0);
      sheet.getCell(totalStart + 2, 4).value = 'VAT';
      sheet.getCell(totalStart + 2, 5).value = Number(selectedRevenueOrder.vat_amount || 0);
      sheet.getCell(totalStart + 3, 4).value = 'TỔNG TIỀN';
      sheet.getCell(totalStart + 3, 5).value = Number(selectedRevenueOrder.total || 0);
      for (let rowNumber = totalStart; rowNumber <= totalStart + 3; rowNumber += 1) {
        sheet.getCell(rowNumber, 4).font = { bold: true };
        sheet.getCell(rowNumber, 5).font = { bold: true };
        sheet.getCell(rowNumber, 5).numFmt = '#,##0 "đ"';
      }
      sheet.getRow(totalStart + 3).eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
        cell.font = { bold: true, color: { argb: 'FF0F3B46' } };
      });

      const paymentSheet = workbook.addWorksheet('Thanh toán');
      paymentSheet.columns = [
        { header: 'Phương thức', key: 'method', width: 22 },
        { header: 'Trạng thái', key: 'status', width: 20 },
        { header: 'Số tiền', key: 'amount', width: 20 },
        { header: 'Khách trả', key: 'paidAmount', width: 20 },
        { header: 'Tiền thừa', key: 'changeAmount', width: 20 },
        { header: 'Thời gian', key: 'paidAt', width: 22 }
      ];
      paymentSheet.addRows((selectedRevenueOrder.payments || []).map((payment) => ({
        method: formatPaymentMethod(payment.payment_method),
        status: payment.status,
        amount: Number(payment.amount || 0),
        paidAmount: Number(payment.paid_amount || 0),
        changeAmount: Number(payment.change_amount || 0),
        paidAt: formatSaleDateTime(payment.paid_at || payment.created_at)
      })));
      styleExcelHeader(paymentSheet.getRow(1), 'FF059669');
      styleExcelBody(paymentSheet, 2, (selectedRevenueOrder.payments || []).length + 1, [3, 4, 5]);

      const buffer = await workbook.xlsx.writeBuffer();
      downloadBlob(
        new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `hoa-don-${selectedRevenueOrder.order_number}.xlsx`
      );
      toast.success('Đã xuất chi tiết hóa đơn Excel');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể xuất chi tiết hóa đơn');
    } finally {
      setExportingRevenue('');
    }
  };

  const openRevenueOrder = async (order) => {
    try {
      setLoadingRevenueOrder(true);
      const response = await api.get(`/orders/${order.id}`);
      setSelectedRevenueOrder(response.data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể tải chi tiết hóa đơn');
    } finally {
      setLoadingRevenueOrder(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="flex items-center gap-2">
            <BadgeCheck className="text-sky-700" size={24} />
            <h1 className="text-2xl font-extrabold text-gray-950">Quản lý nhân viên</h1>
          </div>
          <p className="mt-1 text-sm font-medium text-gray-500">
            Quản trị tài khoản nhân viên và theo dõi chi tiết doanh số bán hàng trong ca trực.
          </p>
        </div>
        {activeTab === 'accounts' && <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#c0edf7] px-5 py-2.5 font-semibold text-[#0f3b46] shadow-sm transition hover:bg-[#a9e3ef] active:bg-[#91d9e8]"
        >
          <UserPlus size={18} />
          <span>Thêm nhân viên</span>
        </button>}
      </div>

      <div>
        <div className="flex gap-7">
          {[
            ['accounts', 'Tài khoản nhân viên'],
            ['revenue', 'Doanh thu & lịch sử bán hàng'],
            ['shifts', 'Ca làm']
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => navigate(key === 'accounts' ? '/employees' : `/employees/${key}`)}
              className={`border-b-2 px-0 py-3 text-sm font-bold transition ${activeTab === key ? 'border-sky-600 text-sky-700' : 'border-transparent text-gray-400 hover:text-gray-700'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'accounts' && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={Users} label="Tổng nhân viên" value={stats.total.toLocaleString('vi-VN')} detail="Nhân sự đã tạo tài khoản" toneClassName="bg-sky-50 text-sky-700" />
        <KpiCard icon={UserCheck} label="Đang hoạt động" value={stats.active.toLocaleString('vi-VN')} detail={`${stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}% tổng nhân sự`} toneClassName="bg-emerald-50 text-emerald-700" />
        <KpiCard icon={UserX} label="Ngừng hoạt động" value={stats.inactive.toLocaleString('vi-VN')} detail={`${stats.total > 0 ? Math.round((stats.inactive / stats.total) * 100) : 0}% tổng nhân sự`} toneClassName="bg-red-50 text-red-700" />
        <KpiCard icon={ShieldCheck} label="Quản trị viên" value={stats.admins.toLocaleString('vi-VN')} detail="Tài khoản có quyền quản lý" toneClassName="bg-violet-50 text-violet-700" />
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
      </>}

      {activeTab === 'revenue' && (
        <div className="space-y-5">
          <section className="border border-[#d7eef3] bg-white p-4 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(220px,1.3fr)_150px_150px_155px_170px]">
              <label>
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-gray-400">Nhân viên:</span>
                <select
                  value={selectedRevenueEmployeeId}
                  onChange={(event) => {
                    setSelectedRevenueEmployeeId(event.target.value);
                    setRevenuePage(1);
                    setRevenueProductPage(1);
                  }}
                  className="h-11 w-full border border-[#d7eef3] bg-white px-3 text-sm font-bold uppercase text-gray-900 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
                >
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name} ({employee.code})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-gray-400">Từ ngày:</span>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="date"
                    value={revenueFilterDraft.from}
                    onChange={(event) => setRevenueFilterDraft((current) => ({ ...current, from: event.target.value }))}
                    className="h-11 w-full border border-[#d7eef3] bg-white pl-9 pr-3 text-sm font-bold text-gray-900 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
                  />
                </div>
              </label>
              <label>
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-gray-400">Đến ngày:</span>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="date"
                    value={revenueFilterDraft.to}
                    onChange={(event) => setRevenueFilterDraft((current) => ({ ...current, to: event.target.value }))}
                    className="h-11 w-full border border-[#d7eef3] bg-white pl-9 pr-3 text-sm font-bold text-gray-900 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
                  />
                </div>
              </label>
              <label>
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-gray-400">Trạng thái:</span>
                <select value={revenueFilterDraft.status} onChange={(event) => setRevenueFilterDraft((current) => ({ ...current, status: event.target.value }))} className="h-11 w-full border border-[#d7eef3] bg-white px-3 text-sm font-bold text-gray-900 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]">
                  <option value="all">Tất cả</option>
                  <option value="completed">Hoàn thành</option>
                  <option value="cancelled">Đã hủy</option>
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-gray-400">Thanh toán:</span>
                <select value={revenueFilterDraft.paymentMethod} onChange={(event) => setRevenueFilterDraft((current) => ({ ...current, paymentMethod: event.target.value }))} className="h-11 w-full border border-[#d7eef3] bg-white px-3 text-sm font-bold text-gray-900 outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]">
                  <option value="all">Tất cả</option>
                  <option value="cash">Tiền mặt</option>
                  <option value="card">Thẻ</option>
                  <option value="transfer">Chuyển khoản</option>
                </select>
              </label>
            </div>
            <div className="mt-4 flex flex-col gap-3 border-t border-[#edf7f9] pt-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative min-w-0 flex-1 lg:max-w-xl">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={revenueFilterDraft.search}
                  onChange={(event) => setRevenueFilterDraft((current) => ({ ...current, search: event.target.value }))}
                  onKeyDown={(event) => { if (event.key === 'Enter') applyRevenueFilters(); }}
                  className="h-11 w-full border border-[#d7eef3] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
                  placeholder="Tìm mã đơn, khách hàng hoặc sản phẩm..."
                />
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={exportRevenueExcel} disabled={Boolean(exportingRevenue) || !selectedRevenueEmployeeId} className="inline-flex h-11 items-center gap-2 border border-emerald-300 px-4 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
                  {exportingRevenue === 'excel' ? <RefreshCw className="animate-spin" size={17} /> : <FileSpreadsheet size={17} />} Xuất Excel
                </button>
                <button type="button" onClick={exportRevenueCsv} disabled={Boolean(exportingRevenue) || !selectedRevenueEmployeeId} className="inline-flex h-11 items-center gap-2 border border-sky-300 px-4 text-sm font-bold text-sky-700 hover:bg-sky-50 disabled:opacity-50">
                  {exportingRevenue === 'csv' ? <RefreshCw className="animate-spin" size={17} /> : <Download size={17} />} Xuất CSV
                </button>
                <button type="button" onClick={applyRevenueFilters} disabled={loadingRevenue || !selectedRevenueEmployeeId} className="inline-flex h-11 items-center justify-center bg-[#69afd6] px-5 text-sm font-bold text-white transition hover:bg-[#579fc8] disabled:cursor-wait disabled:opacity-60">
                  {loadingRevenue ? 'Đang áp dụng...' : 'Áp dụng'}
                </button>
              </div>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Tổng doanh thu', value: formatCurrency(employeeRevenue?.summary?.revenue), detail: `TB/đơn: ${formatCurrency(employeeRevenue?.summary?.averageOrderValue)}`, icon: WalletCards, tone: 'bg-emerald-50 text-emerald-700' },
              { label: 'Hóa đơn hoàn thành', value: Number(employeeRevenue?.summary?.completedOrders || 0).toLocaleString('vi-VN'), detail: 'Đơn đã thanh toán thành công', icon: ShoppingCart, tone: 'bg-sky-50 text-sky-700' },
              { label: 'Đơn đã hủy', value: Number(employeeRevenue?.summary?.cancelledOrders || 0).toLocaleString('vi-VN'), detail: 'Không được tính vào doanh thu', icon: CircleX, tone: 'bg-rose-50 text-rose-700' },
              { label: 'Sản phẩm đã bán', value: Number(employeeRevenue?.summary?.productsSold || 0).toLocaleString('vi-VN'), detail: 'Chỉ tính đơn hoàn thành', icon: Box, tone: 'bg-purple-50 text-purple-700' }
            ].map(({ label, value, detail, icon, tone }) => (
              <KpiCard key={label} icon={icon} label={label} value={value} detail={detail} toneClassName={tone} />
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-[1fr_0.96fr]">
            <section className="overflow-hidden border border-[#d7eef3] bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-[#edf7f9] px-5 py-4">
                <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-gray-800">
                  <BarChart3 size={17} className="text-sky-700" />
                  Lịch sử hóa đơn
                </h2>
                <span className="text-xs font-bold text-gray-400">{Number(employeeRevenue?.pagination?.total || 0).toLocaleString('vi-VN')} hóa đơn</span>
              </div>
              <div className="min-h-[530px] overflow-x-auto">
                <table className="w-full min-w-[1080px] text-left text-sm">
                  <thead className="bg-white text-xs font-extrabold uppercase tracking-wide text-gray-400">
                    <tr>
                      <th className="px-5 py-4">Mã đơn</th>
                      <th className="px-5 py-4">Khách hàng</th>
                      <th className="px-5 py-4">Thời gian</th>
                      <th className="px-5 py-4">Trạng thái</th>
                      <th className="px-5 py-4">Thanh toán</th>
                      <th className="px-5 py-4 text-center">SL SP</th>
                      <th className="px-5 py-4 text-right">Tổng tiền</th>
                      <th className="px-5 py-4 text-center">Xem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf7f9]">
                    {loadingRevenue ? (
                      <tr><td colSpan={8} className="px-5 py-12 text-center font-semibold text-gray-500">Đang tải lịch sử bán hàng...</td></tr>
                    ) : employeeRevenue?.orders?.length ? (
                      employeeRevenue.orders.map((order) => (
                        <tr key={order.id} className="hover:bg-[#f8fdfe]">
                          <td className="px-5 py-4 font-bold text-[#0f3b46]">{order.order_number}</td>
                          <td className="px-5 py-4 text-gray-700">{order.customer_name}</td>
                          <td className="px-5 py-4 text-xs font-semibold text-gray-500">{formatSaleDateTime(order.created_at)}</td>
                          <td className="px-5 py-4"><span className={`inline-flex px-2.5 py-1 text-xs font-bold ${orderStatusClass(order.status)}`}>{formatOrderStatus(order.status)}</span></td>
                          <td className="px-5 py-4 text-gray-600">{formatPaymentMethod(order.payment_method)}</td>
                          <td className="px-5 py-4 text-center font-bold text-gray-700">{Number(order.item_quantity || 0).toLocaleString('vi-VN')}</td>
                          <td className={`px-5 py-4 text-right font-bold ${order.status === 'cancelled' ? 'text-gray-400 line-through' : 'text-gray-950'}`}>{formatCurrency(order.total)}</td>
                          <td className="px-5 py-4 text-center">
                            <button type="button" onClick={() => openRevenueOrder(order)} disabled={loadingRevenueOrder} className="grid h-9 w-9 place-items-center border border-[#d7eef3] text-gray-500 hover:bg-[#f4fcfe] hover:text-sky-700 disabled:opacity-50" title="Xem chi tiết hóa đơn">
                              <Eye size={17} />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={8} className="px-5 py-16 text-center font-semibold text-gray-400">Không có hóa đơn phù hợp với bộ lọc.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <TablePagination
                currentPage={employeeRevenue?.pagination?.page || revenuePage}
                totalItems={employeeRevenue?.pagination?.total || 0}
                pageSize={employeeRevenue?.pagination?.limit || 10}
                onPageChange={setRevenuePage}
                itemLabel="hóa đơn"
                ariaLabel="Phân trang lịch sử bán hàng nhân viên"
              />
            </section>

            <section className="overflow-hidden border border-[#d7eef3] bg-white shadow-sm">
              <div className="border-b border-[#edf7f9] px-5 py-4">
                <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-gray-800">
                  <Box size={17} className="text-purple-700" />
                  Mặt hàng nhân viên đã bán
                </h2>
              </div>
              <div className="min-h-[530px] overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-white text-xs font-extrabold uppercase tracking-wide text-gray-400">
                    <tr>
                      <th className="px-5 py-4">Tên sản phẩm</th>
                      <th className="px-5 py-4 text-center">Số lượng</th>
                      <th className="px-5 py-4 text-right">Doanh thu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf7f9]">
                    {loadingRevenue ? (
                      <tr><td colSpan={3} className="px-5 py-12 text-center font-semibold text-gray-500">Đang tải mặt hàng...</td></tr>
                    ) : visibleRevenueProducts.length ? (
                      visibleRevenueProducts.map((product) => (
                        <tr key={product.id} className="hover:bg-[#f8fdfe]">
                          <td className="px-5 py-4 font-semibold text-gray-900">{product.name}</td>
                          <td className="px-5 py-4 text-center font-bold text-gray-700">{product.quantity}</td>
                          <td className="px-5 py-4 text-right font-bold text-gray-950">{formatCurrency(product.revenue)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={3} className="px-5 py-16 text-center font-semibold text-gray-400">Chưa có sản phẩm thuộc các hóa đơn hoàn thành.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <TablePagination
                currentPage={revenueProductPage}
                totalItems={revenueProducts.length}
                pageSize={10}
                onPageChange={setRevenueProductPage}
                itemLabel="sản phẩm"
                ariaLabel="Phân trang sản phẩm nhân viên đã bán"
              />
            </section>
          </div>
        </div>
      )}

      {activeTab === 'shifts' && <Shifts embedded />}

      <Modal
        isOpen={Boolean(selectedRevenueOrder)}
        onClose={() => setSelectedRevenueOrder(null)}
        title="Chi tiết hóa đơn"
        maxWidth="max-w-5xl"
        headerActions={(
          <>
            <button
              type="button"
              onClick={exportRevenueOrderExcel}
              disabled={!selectedRevenueOrder || Boolean(exportingRevenue)}
              className="inline-flex h-10 items-center gap-2 border border-emerald-300 bg-white px-4 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-50"
            >
              {exportingRevenue === `order-${selectedRevenueOrder?.id}` ? <RefreshCw className="animate-spin" size={16} /> : <FileSpreadsheet size={16} />}
              {exportingRevenue === `order-${selectedRevenueOrder?.id}` ? 'Đang xuất...' : 'Xuất Excel'}
            </button>
            <button type="button" onClick={() => setSelectedRevenueOrder(null)} disabled={Boolean(exportingRevenue)} className="inline-flex h-10 items-center gap-2 border border-[#69afd6] bg-white px-4 text-sm font-bold text-[#398fbd] hover:bg-sky-50 disabled:opacity-50">
              Đóng
            </button>
          </>
        )}
      >
        {selectedRevenueOrder && (
          <div className="space-y-5">
            <div className="grid gap-3 border border-[#d7eef3] bg-[#f8fdfe] p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs font-bold uppercase text-gray-400">Mã hóa đơn</p>
                <p className="mt-1 font-extrabold text-[#0f3b46]">{selectedRevenueOrder.order_number}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-gray-400">Nhân viên</p>
                <p className="mt-1 font-bold text-gray-900">{selectedRevenueOrder.cashier_name}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-gray-400">Khách hàng</p>
                <p className="mt-1 font-bold text-gray-900">{selectedRevenueOrder.customer_name || 'Khách thường'}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-gray-400">Thời gian</p>
                <p className="mt-1 font-bold text-gray-900">{formatSaleDateTime(selectedRevenueOrder.created_at)}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-gray-400">Trạng thái</p>
                <span className={`mt-1 inline-flex px-2.5 py-1 text-xs font-bold ${orderStatusClass(selectedRevenueOrder.status)}`}>{formatOrderStatus(selectedRevenueOrder.status)}</span>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-gray-400">Thanh toán</p>
                <p className="mt-1 font-bold text-gray-900">{formatPaymentMethod(selectedRevenueOrder.payment_method)}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-bold uppercase text-gray-400">Ghi chú</p>
                <p className="mt-1 font-semibold text-gray-700">{selectedRevenueOrder.note || 'Không có ghi chú'}</p>
              </div>
            </div>

            <div className="overflow-x-auto border border-[#d7eef3]">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-[#f4fcfe] text-xs font-extrabold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Sản phẩm</th>
                    <th className="px-4 py-3 text-center">Số lượng</th>
                    <th className="px-4 py-3 text-right">Đơn giá</th>
                    <th className="px-4 py-3 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf7f9]">
                  {(selectedRevenueOrder.items || []).map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-semibold text-gray-900">{item.product_name}</td>
                      <td className="px-4 py-3 text-center font-bold">{Number(item.quantity || 0).toLocaleString('vi-VN')}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(item.unit_price)}</td>
                      <td className="px-4 py-3 text-right font-bold">{formatCurrency(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ml-auto w-full max-w-sm space-y-2 border border-[#d7eef3] p-4 text-sm">
              <div className="flex justify-between gap-4"><span className="text-gray-500">Tạm tính</span><strong>{formatCurrency(selectedRevenueOrder.subtotal)}</strong></div>
              <div className="flex justify-between gap-4"><span className="text-gray-500">Giảm giá</span><strong className="text-rose-600">-{formatCurrency(selectedRevenueOrder.discount)}</strong></div>
              <div className="flex justify-between gap-4"><span className="text-gray-500">VAT</span><strong>{formatCurrency(selectedRevenueOrder.vat_amount)}</strong></div>
              <div className="flex justify-between gap-4 border-t border-[#edf7f9] pt-3 text-base"><span className="font-extrabold text-gray-900">Tổng tiền</span><strong className={selectedRevenueOrder.status === 'cancelled' ? 'text-gray-400 line-through' : 'text-[#0f3b46]'}>{formatCurrency(selectedRevenueOrder.total)}</strong></div>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isFormOpen} onClose={closeForm} title={editingEmployee ? 'Sửa nhân viên' : 'Thêm nhân viên'} headerActions={<><button type="button" onClick={closeForm} className="h-11 border border-[#69afd6] bg-white px-5 text-base font-bold text-[#398fbd] hover:bg-sky-50">Hủy</button><button type="submit" form="employee-form" className="h-11 bg-[#69afd6] px-5 text-base font-bold text-white hover:bg-[#579fc8]">Lưu</button></>}>
        <form id="employee-form" onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
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
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(passwordEmployee)}
        onClose={closePasswordModal}
        title="Đổi mật khẩu nhân viên"
        maxWidth="max-w-md"
        headerActions={<><button type="button" onClick={closePasswordModal} disabled={isPasswordSaving} className="h-11 border border-[#69afd6] bg-white px-5 text-base font-bold text-[#398fbd] hover:bg-sky-50 disabled:opacity-60">Hủy</button><button type="submit" form="employee-password-form" disabled={isPasswordSaving} className="h-11 bg-[#69afd6] px-5 text-base font-bold text-white hover:bg-[#579fc8] disabled:opacity-60">{isPasswordSaving ? 'Đang lưu...' : 'Lưu mật khẩu'}</button></>}
      >
        {passwordEmployee && (
          <form id="employee-password-form" onSubmit={changePassword} className="space-y-5">
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
