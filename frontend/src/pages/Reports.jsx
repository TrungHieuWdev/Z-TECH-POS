import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Banknote,
  Download,
  Filter,
  Package,
  Search,
  ShoppingBag,
  TrendingUp,
  WalletCards
} from 'lucide-react';
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

const emptyReport = {
  summary: {
    revenue: 0,
    orders: 0,
    soldQuantity: 0,
    grossProfit: 0,
    revenueGrowth: 0,
    orderGrowth: 0
  },
  recentOrders: [],
  categories: [],
  topProducts: []
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

export default function Reports() {
  const defaultRange = useMemo(() => getRangeByPeriod('7days'), []);
  const [period, setPeriod] = useState('7days');
  const [dateFrom, setDateFrom] = useState(defaultRange.dateFrom);
  const [dateTo, setDateTo] = useState(defaultRange.dateTo);
  const [search, setSearch] = useState('');
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

  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const products = report.topProducts || [];

    if (!keyword) {
      return products;
    }

    return products.filter((product) =>
      [product.name, product.category_name].filter(Boolean).some((value) => value.toLowerCase().includes(keyword))
    );
  }, [report.topProducts, search]);

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
    if (filteredProducts.length === 0) {
      toast.error('Chưa có dữ liệu để xuất báo cáo');
      return;
    }

    const blob = new Blob([`\ufeff${buildCsv(filteredProducts)}`], { type: 'text/csv;charset=utf-8;' });
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
        <h1 className="text-2xl font-bold text-gray-950">Báo cáo doanh thu</h1>
        <p className="mt-1 text-sm text-gray-500">
          Dữ liệu lấy trực tiếp từ đơn hàng đã bán và trạng thái hoàn tất trong MySQL.
        </p>
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
        <div className="rounded-lg border border-[#d7eef3] bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-950">Giao dịch gần đây</h2>
            <span className="text-sm font-semibold text-[#0f3b46]">
              {Number(report.recentOrders?.length || 0).toLocaleString('vi-VN')} đơn
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-[#edf7f9] text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="pb-3 font-bold">Mã đơn</th>
                  <th className="pb-3 font-bold">Thời gian</th>
                  <th className="pb-3 font-bold">Khách hàng</th>
                  <th className="pb-3 font-bold">Thanh toán</th>
                  <th className="pb-3 text-right font-bold">Tổng tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf7f9]">
                {!isLoading && report.recentOrders.length === 0 && (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-sm font-medium text-gray-500">
                      Chưa có đơn hàng hoàn tất trong khoảng ngày này.
                    </td>
                  </tr>
                )}
                {report.recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-[#f8fdfe]">
                    <td className="py-3 font-bold text-[#0f3b46]">{order.order_number}</td>
                    <td className="py-3 text-gray-600">
                      {formatTime(order.created_at)} - {formatDate(order.created_at)}
                    </td>
                    <td className="py-3 text-gray-600">{order.customer_name}</td>
                    <td className="py-3 text-gray-600">
                      {paymentLabels[order.payment_method] || order.payment_method}
                    </td>
                    <td className="py-3 text-right font-bold text-gray-950">{formatCurrency(order.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-[#d7eef3] bg-white p-5 shadow-sm">
          <h2 className="mb-6 text-base font-bold text-gray-950">Doanh thu theo danh mục</h2>
          <div className="flex flex-col items-center gap-6">
            <div className="relative h-44 w-44">
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
      </section>

      <section className="overflow-hidden rounded-lg border border-[#d7eef3] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#edf7f9] p-5 md:flex-row md:items-center md:justify-between">
          <h2 className="text-base font-bold text-gray-950">Top sản phẩm bán chạy</h2>
          <div className="flex items-center gap-3">
            <div className="flex h-10 min-w-[260px] items-center gap-2 rounded-lg border border-[#d7eef3] bg-white px-3">
              <Search size={18} className="text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full text-sm outline-none"
                placeholder="Tìm sản phẩm hoặc danh mục"
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] text-left text-sm">
            <thead className="bg-[#f4fcfe] text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-4 font-bold">Sản phẩm</th>
                <th className="px-5 py-4 font-bold">Danh mục</th>
                <th className="px-5 py-4 font-bold">Số lượng bán</th>
                <th className="px-5 py-4 font-bold">Doanh thu</th>
                <th className="px-5 py-4 text-center font-bold">Tồn kho</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf7f9]">
              {!isLoading && filteredProducts.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-5 py-10 text-center text-sm font-medium text-gray-500">
                    Chưa có sản phẩm bán ra trong khoảng ngày này.
                  </td>
                </tr>
              )}
              {filteredProducts.map((product) => (
                <tr key={product.product_id} className="hover:bg-[#f8fdfe]">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-lg border border-[#d7eef3] bg-[#f4fcfe] text-[#0f3b46]">
                        <Package size={20} />
                      </div>
                      <span className="font-semibold text-gray-950">{product.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-gray-600">{product.category_name}</td>
                  <td className="px-5 py-4 font-medium text-gray-700">
                    {Number(product.quantity || 0).toLocaleString('vi-VN')}
                  </td>
                  <td className="px-5 py-4 font-bold text-[#0f3b46]">{formatCurrency(product.revenue)}</td>
                  <td className="px-5 py-4 text-center">
                    <span
                      className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                        Number(product.stock_quantity || 0) <= 12
                          ? 'bg-orange-50 text-orange-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {Number(product.stock_quantity || 0).toLocaleString('vi-VN')} sản phẩm
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
