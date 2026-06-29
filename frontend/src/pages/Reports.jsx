import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Banknote,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Package,
  Search,
  ShoppingBag,
  TrendingUp,
  WalletCards
} from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import api from '../api/axios';
import { formatCurrency, formatDate, formatTime } from '../utils/format';

const periodOptions = [
  { value: 'today', label: 'Hôm nay' },
  { value: '7days', label: '7 ngày qua' },
  { value: 'month', label: 'Tháng này' },
  { value: 'custom', label: 'Tùy chọn' }
];

const paymentLabels = {
  cash: 'Tiền mặt',
  card: 'Thẻ',
  transfer: 'Chuyển khoản'
};

const chartColors = ['#0f3b46', '#5fbfd1', '#c0edf7', '#e8f9fc', '#cbd5e1', '#94a3b8'];
const ORDER_PAGE_SIZE = 8;

const emptyReport = {
  summary: {
    revenue: 0,
    orders: 0,
    soldQuantity: 0,
    grossProfit: 0,
    revenueGrowth: 0,
    orderGrowth: 0
  },
  daily: [],
  recentOrders: [],
  categories: [],
  topProducts: [],
  attentionProducts: []
};

function toInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getRangeByPeriod(period) {
  const today = new Date();

  if (period === 'today') {
    const current = toInputDate(today);
    return { dateFrom: current, dateTo: current };
  }

  if (period === 'month') {
    return {
      dateFrom: toInputDate(new Date(today.getFullYear(), today.getMonth(), 1)),
      dateTo: toInputDate(today)
    };
  }

  const start = new Date(today);
  start.setDate(today.getDate() - 6);
  return {
    dateFrom: toInputDate(start),
    dateTo: toInputDate(today)
  };
}

function formatPercent(value) {
  const numberValue = Number(value || 0);
  const prefix = numberValue > 0 ? '+' : '';
  return `${prefix}${numberValue.toLocaleString('vi-VN')}%`;
}

function buildCsv(products) {
  const headers = ['Sản phẩm', 'Danh mục', 'Số lượng bán', 'Doanh thu', 'Tồn kho'];
  const rows = products.map((product) => [
    product.name,
    product.category_name,
    product.quantity,
    product.revenue,
    product.stock_quantity
  ]);

  return [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

function getDonutSegments(categories) {
  let offset = 0;

  return categories.map((category, index) => {
    const segment = {
      ...category,
      color: chartColors[index % chartColors.length],
      offset
    };
    offset -= Number(category.percentage || 0);
    return segment;
  });
}

function buildDailyChartData(rows, dateFrom, dateTo) {
  if (!dateFrom || !dateTo) return [];

  const valuesByDate = new Map((rows || []).map((row) => [row.date, row]));
  const start = new Date(`${dateFrom}T00:00:00`);
  const end = new Date(`${dateTo}T00:00:00`);
  const data = [];

  for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const key = toInputDate(date);
    const row = valuesByDate.get(key) || {};
    data.push({
      date: key,
      label: `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`,
      revenue: Number(row.revenue || 0),
      grossProfit: Number(row.grossProfit || 0),
      profitMarker: Number(row.revenue || 0)
    });
  }

  return data;
}

function formatChartAxis(value) {
  const number = Number(value || 0);
  if (number === 0) return '0';
  if (Math.abs(number) >= 1000000) return `${(number / 1000000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}tr`;
  return `${Math.round(number / 1000)}k`;
}

function getAttentionMeta(product, dateFrom, dateTo) {
  const stock = Number(product.stock_quantity || 0);
  const minimum = Math.max(Number(product.min_stock || 0), 1);
  const sold = Number(product.sold_quantity || 0);
  const start = new Date(`${dateFrom}T00:00:00`);
  const end = new Date(`${dateTo}T00:00:00`);
  const days = Math.max(Math.round((end - start) / 86400000) + 1, 1);
  const dailySales = sold / days;

  if (stock <= minimum) return { speed: dailySales >= 1 ? 'Cao' : 'Trung bình', label: 'Nên nhập thêm', tone: 'bg-emerald-50 text-emerald-700' };
  if (stock <= minimum * 1.5) return { speed: dailySales >= 1 ? 'Cao' : 'Trung bình', label: 'Sắp hết', tone: 'bg-orange-50 text-orange-700' };
  if (dailySales < 0.2) return { speed: 'Thấp', label: 'Tồn chậm', tone: 'bg-sky-50 text-sky-700' };
  return { speed: dailySales >= 1 ? 'Cao' : 'Trung bình', label: 'Theo dõi', tone: 'bg-gray-100 text-gray-700' };
}

function getPaginationItems(currentPage, totalPages) {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);

  if (currentPage <= 3) return [1, 2, 3, 'ellipsis-end', totalPages];
  if (currentPage >= totalPages - 2) {
    return [1, 'ellipsis-start', totalPages - 2, totalPages - 1, totalPages];
  }

  return [
    1,
    'ellipsis-start',
    currentPage - 1,
    currentPage,
    currentPage + 1,
    'ellipsis-end',
    totalPages
  ];
}

export default function Reports() {
  const defaultRange = useMemo(() => getRangeByPeriod('7days'), []);
  const [period, setPeriod] = useState('7days');
  const [dateFrom, setDateFrom] = useState(defaultRange.dateFrom);
  const [dateTo, setDateTo] = useState(defaultRange.dateTo);
  const [search, setSearch] = useState('');
  const [orderPage, setOrderPage] = useState(1);
  const [report, setReport] = useState(emptyReport);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadReport() {
    if (!dateFrom || !dateTo) {
      setError('Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc');
      return;
    }

    try {
      setIsLoading(true);
      const response = await api.get('/reports/sales', {
        params: {
          date_from: dateFrom,
          date_to: dateTo
        }
      });

      setReport(response.data);
      setError('');
    } catch (requestError) {
      setReport(emptyReport);
      setError(requestError.response?.data?.message || 'Không thể tải báo cáo doanh thu');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadReport();
  }, [dateFrom, dateTo]);

  const summary = report.summary || emptyReport.summary;
  const donutSegments = useMemo(() => getDonutSegments(report.categories || []), [report.categories]);
  const dailyChartData = useMemo(
    () => buildDailyChartData(report.daily, dateFrom, dateTo),
    [report.daily, dateFrom, dateTo]
  );

  const filteredOrders = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const orders = report.recentOrders || [];

    if (!keyword) return orders;

    return orders.filter((order) =>
      [order.order_number, order.customer_name, order.cashier_name]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(keyword))
    );
  }, [report.recentOrders, search]);
  const totalOrderPages = Math.max(1, Math.ceil(filteredOrders.length / ORDER_PAGE_SIZE));
  const visibleOrders = filteredOrders.slice((orderPage - 1) * ORDER_PAGE_SIZE, orderPage * ORDER_PAGE_SIZE);
  const paginationItems = getPaginationItems(orderPage, totalOrderPages);
  const occupiedRows = Math.max(visibleOrders.length, filteredOrders.length === 0 ? 1 : 0);
  const fillerRowCount = Math.max(0, ORDER_PAGE_SIZE - occupiedRows);

  useEffect(() => {
    setOrderPage(1);
  }, [search, dateFrom, dateTo]);

  useEffect(() => {
    if (orderPage > totalOrderPages) setOrderPage(totalOrderPages);
  }, [orderPage, totalOrderPages]);

  const hasSalesData = Number(summary.orders || 0) > 0;

  const statCards = [
    {
      title: 'Tổng doanh thu',
      value: formatCurrency(summary.revenue),
      note: `${formatPercent(summary.revenueGrowth)} so với kỳ trước`,
      icon: Banknote,
      tone: 'bg-[#c0edf7] text-[#0f3b46]'
    },
    {
      title: 'Tổng đơn hàng',
      value: Number(summary.orders || 0).toLocaleString('vi-VN'),
      note: `${formatPercent(summary.orderGrowth)} so với kỳ trước`,
      icon: ShoppingBag,
      tone: 'bg-[#f4fcfe] text-[#0f3b46]'
    },
    {
      title: 'Sản phẩm đã bán',
      value: Number(summary.soldQuantity || 0).toLocaleString('vi-VN'),
      note: hasSalesData ? 'Tính từ đơn hàng hoàn tất' : 'Chưa có đơn hoàn tất',
      icon: Package,
      tone: 'bg-[#f4fcfe] text-gray-600'
    },
    {
      title: 'Lợi nhuận gộp',
      value: formatCurrency(summary.grossProfit),
      note: 'Theo giá vốn sản phẩm',
      icon: WalletCards,
      tone: 'bg-emerald-50 text-emerald-600'
    }
  ];

  const handlePeriodChange = (value) => {
    setPeriod(value);

    if (value !== 'custom') {
      const nextRange = getRangeByPeriod(value);
      setDateFrom(nextRange.dateFrom);
      setDateTo(nextRange.dateTo);
    }
  };

  const exportReport = () => {
    const products = report.topProducts || [];
    if (products.length === 0) {
      toast.error('Chưa có dữ liệu để xuất báo cáo');
      return;
    }

    const blob = new Blob([`\ufeff${buildCsv(products)}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `bao-cao-doanh-thu-${dateFrom}-${dateTo}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success('Đã xuất báo cáo CSV');
  };

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-extrabold text-gray-950">Báo cáo tổng quan</h1>
        <p className="mt-1 text-sm font-medium text-gray-500">Phân tích doanh thu, lợi nhuận, sản phẩm và giao dịch theo từng khoảng thời gian.</p>
      </section>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      <section className="flex flex-col gap-4 rounded-lg border border-[#d7eef3] bg-white p-4 shadow-sm xl:flex-row xl:items-center">
        <div className="flex rounded-lg bg-[#f4fcfe] p-1">
          {periodOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handlePeriodChange(option.value)}
              className={`h-10 rounded-md px-4 text-sm font-semibold transition ${
                period === option.value ? 'bg-white text-[#0f3b46] shadow-sm' : 'text-gray-600 hover:bg-white'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => {
              setPeriod('custom');
              setDateFrom(event.target.value);
            }}
            className="h-10 rounded-lg border border-[#d7eef3] bg-white px-3 text-sm outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
          />
          <span className="text-sm text-gray-500">đến</span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => {
              setPeriod('custom');
              setDateTo(event.target.value);
            }}
            className="h-10 rounded-lg border border-[#d7eef3] bg-white px-3 text-sm outline-none focus:border-[#7ed5e6] focus:ring-2 focus:ring-[#c0edf7]"
          />
        </div>

        <div className="flex gap-3 xl:ml-auto">
          <button
            type="button"
            onClick={loadReport}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#c0edf7] px-4 text-sm font-bold text-[#0f3b46] transition hover:bg-[#a9e3ef]"
          >
            <Filter size={18} />
            <span>Lọc báo cáo</span>
          </button>
          <button
            type="button"
            onClick={exportReport}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d7eef3] bg-white px-4 text-sm font-bold text-gray-600 transition hover:bg-[#f4fcfe] hover:text-[#0f3b46]"
          >
            <Download size={18} />
            <span>Xuất báo cáo</span>
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;

          return (
            <div key={card.title} className="rounded-lg border border-[#d7eef3] bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-500">{card.title}</p>
                  <p className="mt-1 text-[22px] font-bold text-gray-950">{isLoading ? '...' : card.value}</p>
                  <p className="mt-3 flex items-center gap-1 text-xs font-bold text-emerald-600">
                    <TrendingUp size={15} />
                    {card.note}
                  </p>
                </div>
                <div className={`grid h-12 w-12 place-items-center rounded-lg ${card.tone}`}>
                  <Icon size={25} />
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex h-[420px] flex-col rounded-lg border border-[#d7eef3] bg-white p-5 shadow-sm">
          <div className="mb-4 shrink-0">
            <h2 className="text-base font-bold text-gray-950">Doanh thu & lợi nhuận theo ngày</h2>
            <p className="mt-1 text-xs font-medium text-gray-500">
              Dữ liệu từ đơn hàng hoàn tất trong khoảng thời gian đã chọn
            </p>
          </div>
          <div className="min-h-0 w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dailyChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e5edf2" strokeDasharray="4 4" vertical={false} />
                <XAxis
                  dataKey="label"
                  axisLine={{ stroke: '#d7e4ea' }}
                  tickLine={false}
                  minTickGap={24}
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                  dy={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  tickFormatter={formatChartAxis}
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                />
                <Tooltip
                  formatter={(value, name, item) => [
                    formatCurrency(name === 'Lợi nhuận gộp' ? item.payload.grossProfit : value),
                    name
                  ]}
                  labelFormatter={(label) => `Ngày ${label}`}
                  contentStyle={{ border: '1px solid #d7eef3', borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600, paddingTop: 12 }} />
                <Bar
                  dataKey="revenue"
                  name="Doanh thu"
                  fill="#2f8cf0"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={30}
                  animationDuration={500}
                />
                <Line
                  type="monotone"
                  dataKey="profitMarker"
                  name="Lợi nhuận gộp"
                  stroke="#0ca678"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#ffffff', stroke: '#0ca678', strokeWidth: 2 }}
                  activeDot={{ r: 5 }}
                  animationDuration={500}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex h-[420px] flex-col rounded-lg border border-[#d7eef3] bg-white p-5 shadow-sm">
          <h2 className="mb-4 shrink-0 text-base font-bold text-gray-950">Doanh thu theo danh mục</h2>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="flex flex-col items-center gap-4">
            <div className="relative h-36 w-36 shrink-0">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" fill="transparent" r="15.9" stroke="#f1f5f9" strokeWidth="4.2" />
                {donutSegments.map((category) => (
                  <circle
                    key={category.name}
                    cx="18"
                    cy="18"
                    fill="transparent"
                    r="15.9"
                    stroke={category.color}
                    strokeDasharray={`${category.percentage}, 100`}
                    strokeDashoffset={category.offset}
                    strokeWidth="4.2"
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs font-bold uppercase text-gray-500">Tổng cộng</span>
                <span className="text-2xl font-bold text-gray-950">{hasSalesData ? '100%' : '0%'}</span>
              </div>
            </div>
            <div className="w-full space-y-3">
              {!isLoading && report.categories.length === 0 && (
                <p className="text-center text-sm font-medium text-gray-500">Chưa có doanh thu theo danh mục.</p>
              )}
              {donutSegments.map((category) => (
                <div key={category.name} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                    <span className="truncate text-gray-600">{category.name}</span>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-bold text-gray-950">{category.percentage}%</div>
                    <div className="text-xs font-medium text-gray-500">{formatCurrency(category.revenue)}</div>
                  </div>
                </div>
              ))}
            </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-[#d7eef3] bg-white shadow-sm">
          <div className="border-b border-[#edf7f9] px-4 py-3">
            <h2 className="text-sm font-bold text-gray-950">Top sản phẩm</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead className="bg-[#f8fdfe] text-gray-500">
                <tr>
                  <th className="w-10 px-3 py-2.5 text-center font-bold">#</th>
                  <th className="px-3 py-2.5 font-bold">Sản phẩm</th>
                  <th className="px-3 py-2.5 font-bold">Danh mục</th>
                  <th className="px-3 py-2.5 text-right font-bold">SL bán</th>
                  <th className="px-3 py-2.5 text-right font-bold">Doanh thu</th>
                  <th className="px-3 py-2.5 text-right font-bold">Lợi nhuận</th>
                  <th className="px-3 py-2.5 text-center font-bold">Tồn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf7f9]">
                {!isLoading && report.topProducts.length === 0 && (
                  <tr><td colSpan="7" className="px-4 py-8 text-center text-gray-500">Chưa có sản phẩm bán ra trong kỳ.</td></tr>
                )}
                {report.topProducts.slice(0, 5).map((product, index) => (
                  <tr key={product.product_id} className="hover:bg-[#f8fdfe]">
                    <td className="px-3 py-2 text-center font-semibold text-gray-500">{index + 1}</td>
                    <td className="max-w-[170px] px-3 py-2 font-semibold text-gray-950"><p className="truncate">{product.name}</p></td>
                    <td className="max-w-[130px] px-3 py-2 text-gray-600"><p className="truncate">{product.category_name}</p></td>
                    <td className="px-3 py-2 text-right font-semibold">{Number(product.quantity || 0).toLocaleString('vi-VN')}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">{formatCurrency(product.revenue)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">{formatCurrency(product.gross_profit)}</td>
                    <td className="px-3 py-2 text-center font-bold text-emerald-600">{Number(product.stock_quantity || 0).toLocaleString('vi-VN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-[#d7eef3] bg-white shadow-sm">
          <div className="border-b border-[#edf7f9] px-4 py-3">
            <h2 className="text-sm font-bold text-gray-950">Sản phẩm cần chú ý</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead className="bg-[#f8fdfe] text-gray-500">
                <tr>
                  <th className="px-3 py-2.5 font-bold">Sản phẩm</th>
                  <th className="px-3 py-2.5 text-right font-bold">Đã bán</th>
                  <th className="px-3 py-2.5 text-right font-bold">Tồn kho</th>
                  <th className="px-3 py-2.5 text-center font-bold">Bán chạy</th>
                  <th className="px-3 py-2.5 text-center font-bold">Gợi ý</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf7f9]">
                {(report.attentionProducts || []).map((product) => {
                  const meta = getAttentionMeta(product, dateFrom, dateTo);
                  return (
                    <tr key={product.product_id} className="hover:bg-[#f8fdfe]">
                      <td className="max-w-[210px] px-3 py-2 font-semibold text-gray-950"><p className="truncate">{product.name}</p></td>
                      <td className="px-3 py-2 text-right font-semibold">{Number(product.sold_quantity || 0).toLocaleString('vi-VN')}</td>
                      <td className={`px-3 py-2 text-right font-bold ${Number(product.stock_quantity) <= Number(product.min_stock) ? 'text-red-600' : 'text-emerald-600'}`}>{Number(product.stock_quantity || 0).toLocaleString('vi-VN')}</td>
                      <td className="px-3 py-2 text-center text-gray-600">{meta.speed}</td>
                      <td className="px-3 py-2 text-center"><span className={`inline-flex whitespace-nowrap rounded px-2 py-1 font-bold ${meta.tone}`}>{meta.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-[#d7eef3] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#edf7f9] px-4 py-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-sm font-bold text-gray-950">Danh sách đơn hàng trong kỳ</h2>
          <div className="flex h-9 w-full items-center gap-2 rounded-lg border border-[#d7eef3] bg-white px-3 md:w-[300px]">
            <Search size={17} className="text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full text-sm outline-none"
              placeholder="Tìm mã đơn, khách hàng..."
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-xs">
            <thead className="bg-[#f8fdfe] text-gray-500">
              <tr>
                <th className="px-4 py-2.5 font-bold">Mã đơn</th>
                <th className="px-4 py-2.5 font-bold">Thời gian</th>
                <th className="px-4 py-2.5 font-bold">Khách hàng</th>
                <th className="px-4 py-2.5 font-bold">Nhân viên</th>
                <th className="px-4 py-2.5 font-bold">Thanh toán</th>
                <th className="px-4 py-2.5 text-right font-bold">Tổng tiền</th>
                <th className="px-4 py-2.5 text-right font-bold">Lợi nhuận</th>
                <th className="px-4 py-2.5 text-center font-bold">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf7f9]">
              {!isLoading && filteredOrders.length === 0 && (
                <tr>
                  <td colSpan="8" className="h-11 px-4 text-center text-sm font-medium text-gray-500">
                    Không tìm thấy đơn hàng phù hợp trong khoảng ngày này.
                  </td>
                </tr>
              )}
              {visibleOrders.map((order) => (
                <tr key={order.id} className="h-11 hover:bg-[#f8fdfe]">
                  <td className="whitespace-nowrap px-4 py-2.5 font-bold text-[#0f3b46]">{order.order_number}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">{formatTime(order.created_at)} - {formatDate(order.created_at)}</td>
                  <td className="max-w-[150px] px-4 py-2.5 text-gray-600"><p className="truncate">{order.customer_name}</p></td>
                  <td className="max-w-[160px] px-4 py-2.5 text-gray-600"><p className="truncate">{order.cashier_name}</p></td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">{paymentLabels[order.payment_method] || order.payment_method}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-bold text-gray-950">{formatCurrency(order.total)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-bold text-gray-950">{formatCurrency(order.gross_profit)}</td>
                  <td className="px-4 py-2.5 text-center"><span className="inline-flex rounded bg-emerald-50 px-2 py-1 font-bold text-emerald-700">Hoàn thành</span></td>
                </tr>
              ))}
              {Array.from({ length: fillerRowCount }, (_, index) => (
                <tr key={`empty-order-row-${index}`} aria-hidden="true" className="h-11">
                  <td colSpan="8">&nbsp;</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex min-h-12 flex-col gap-3 border-t border-[#edf7f9] px-4 py-3 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Hiển thị {filteredOrders.length ? (orderPage - 1) * ORDER_PAGE_SIZE + 1 : 0}
            {' - '}{Math.min(orderPage * ORDER_PAGE_SIZE, filteredOrders.length)} trong {filteredOrders.length.toLocaleString('vi-VN')} đơn
          </span>
          <nav className="flex items-center gap-1" aria-label="Phân trang đơn hàng">
            <button
              type="button"
              title="Trang trước"
              aria-label="Trang trước"
              disabled={orderPage === 1}
              onClick={() => setOrderPage((page) => Math.max(1, page - 1))}
              className="grid h-8 w-8 place-items-center border border-[#d7eef3] text-[#0f3b46] transition hover:bg-[#f4fcfe] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            {paginationItems.map((item) => typeof item === 'number' ? (
              <button
                key={item}
                type="button"
                onClick={() => setOrderPage(item)}
                aria-current={item === orderPage ? 'page' : undefined}
                className={`h-8 min-w-8 border px-2 font-bold transition ${
                  item === orderPage
                    ? 'border-[#5fbfd1] bg-[#c0edf7] text-[#0f3b46]'
                    : 'border-[#d7eef3] bg-white text-gray-600 hover:bg-[#f4fcfe]'
                }`}
              >
                {item}
              </button>
            ) : (
              <span key={item} className="grid h-8 w-8 place-items-center font-bold text-gray-400">…</span>
            ))}
            <button
              type="button"
              title="Trang sau"
              aria-label="Trang sau"
              disabled={orderPage === totalOrderPages}
              onClick={() => setOrderPage((page) => Math.min(totalOrderPages, page + 1))}
              className="grid h-8 w-8 place-items-center border border-[#d7eef3] text-[#0f3b46] transition hover:bg-[#f4fcfe] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </nav>
        </div>
      </section>
    </div>
  );
}
