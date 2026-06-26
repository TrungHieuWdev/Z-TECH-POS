import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  MoreVertical,
  PackageCheck,
  PackageOpen,
  ReceiptText,
  TrendingUp,
  WalletCards
} from 'lucide-react';
import api from '../api/axios';
import RevenueAreaChart from '../components/dashboard/RevenueAreaChart';
import { formatCurrency, formatDate, formatTime } from '../utils/format';

const dashboardPeriodOptions = [
  { value: 'today', label: 'Hôm nay' },
  { value: '7days', label: '7 ngày' },
  { value: '14days', label: '14 ngày' },
  { value: '30days', label: '30 ngày' },
  { value: '90days', label: '90 ngày' }
];

const cardTones = {
  blue: 'bg-brand-soft text-brand-ink',
  gray: 'bg-brand-surface text-brand-strong',
  amber: 'bg-brand-muted text-brand-ink',
  slate: 'bg-[#eef7fc] text-brand-deep'
};

const statusStyles = {
  completed: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  cancelled: 'bg-rose-50 text-rose-700 ring-rose-100'
};

const statusLabels = {
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy'
};

function formatPercent(value) {
  const numberValue = Number(value || 0);
  const prefix = numberValue > 0 ? '+' : '';
  return `${prefix}${numberValue.toLocaleString('vi-VN')}%`;
}

function getTodayGrowthCaption(value) {
  if (value === null || value === undefined) return 'Hôm qua chưa có dữ liệu';

  const numberValue = safeNumber(value);
  if (numberValue === 0) return 'Bằng hôm qua';

  return `${numberValue > 0 ? 'Tăng' : 'Giảm'} ${formatPercent(Math.abs(numberValue))} so với hôm qua`;
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getRevenueCaption(currentRevenue, previousRevenue) {
  const current = safeNumber(currentRevenue);
  const previous = safeNumber(previousRevenue);

  if (previous <= 0) return current > 0 ? 'Phát sinh mới trong kỳ' : 'Kỳ trước chưa có dữ liệu';

  const delta = current - previous;
  if (delta === 0) return 'Bằng kỳ trước';
  return `${delta > 0 ? 'Tăng' : 'Giảm'} ${formatCurrency(Math.abs(delta))} so với kỳ trước`;
}

function getCountCaption(currentValue, previousValue, noun) {
  const current = Math.round(safeNumber(currentValue));
  const previous = Math.round(safeNumber(previousValue));

  if (previous === 0) return current > 0 ? 'Kỳ trước chưa có dữ liệu' : 'Bằng kỳ trước';

  const delta = current - previous;
  if (delta === 0) return 'Bằng kỳ trước';
  return `${delta > 0 ? '+' : '-'}${Math.abs(delta).toLocaleString('vi-VN')} ${noun} so với kỳ trước`;
}

function getInitials(name = '') {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return 'KL';
  }

  return words.slice(-2).map((word) => word[0]).join('').toUpperCase();
}

export default function Dashboard() {
  const [summary, setSummary] = useState({
    todayRevenue: 0,
    yesterdayRevenue: 0,
    monthRevenue: 0,
    todayOrders: 0,
    yesterdayOrders: 0,
    lowStockCount: 0,
    productsSold: 0,
    previousProductsSold: 0,
    estimatedProfit: 0,
    previousEstimatedProfit: 0,
    revenueGrowth: 0,
    orderGrowth: 0,
    productsSoldGrowth: 0,
    estimatedProfitGrowth: 0
  });
  const [topProducts, setTopProducts] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [dashboardPeriod, setDashboardPeriod] = useState('today');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchDashboard() {
      setIsLoading(true);

      try {
        const params = { period: dashboardPeriod };
        const [summaryRes, topRes, recentRes] = await Promise.all([
          api.get('/dashboard/summary', { params }),
          api.get('/dashboard/top-products', { params }),
          api.get('/dashboard/recent-orders', { params })
        ]);

        setSummary(summaryRes.data);
        setTopProducts(topRes.data);
        setRecentOrders(recentRes.data);
        setError('');
      } catch (requestError) {
        setError(requestError.response?.data?.message || 'Không thể tải dữ liệu dashboard');
      } finally {
        setIsLoading(false);
      }
    }

    fetchDashboard();
  }, [dashboardPeriod]);

  const dashboardPeriodLabel = useMemo(() => {
    return dashboardPeriodOptions.find((option) => option.value === dashboardPeriod)?.label || dashboardPeriodOptions[0].label;
  }, [dashboardPeriod]);

  const revenueComparisonAmount = safeNumber(summary.todayRevenue) - safeNumber(summary.yesterdayRevenue);

  const cards = [
    {
      label: `Doanh thu - ${dashboardPeriodLabel}`,
      value: formatCurrency(summary.todayRevenue),
      caption: dashboardPeriod === 'today'
        ? getTodayGrowthCaption(summary.revenueGrowth)
        : getRevenueCaption(summary.todayRevenue, summary.yesterdayRevenue),
      icon: WalletCards,
      tone: 'blue'
    },
    {
      label: `Đơn hàng - ${dashboardPeriodLabel}`,
      value: safeNumber(summary.todayOrders).toLocaleString('vi-VN'),
      caption: dashboardPeriod === 'today'
        ? getTodayGrowthCaption(summary.orderGrowth)
        : getCountCaption(summary.todayOrders, summary.yesterdayOrders, 'đơn'),
      icon: ReceiptText,
      tone: 'gray'
    },
    {
      label: 'Sắp hết hàng',
      value: `${safeNumber(summary.lowStockCount).toLocaleString('vi-VN')} sản phẩm`,
      caption: summary.lowStockCount > 0 ? 'Dưới mức tồn tối thiểu' : 'Kho đang ổn định',
      icon: PackageCheck,
      tone: 'amber',
      to: '/products?lowStock=1'
    },
    {
      label: `Sản phẩm đã bán - ${dashboardPeriodLabel}`,
      value: safeNumber(summary.productsSold).toLocaleString('vi-VN'),
      caption: dashboardPeriod === 'today'
        ? getTodayGrowthCaption(summary.productsSoldGrowth)
        : getCountCaption(summary.productsSold, summary.previousProductsSold, 'sản phẩm'),
      icon: PackageOpen,
      tone: 'slate'
    },
    {
      label: `Lợi nhuận tạm tính - ${dashboardPeriodLabel}`,
      value: formatCurrency(summary.estimatedProfit),
      caption: dashboardPeriod === 'today'
        ? getTodayGrowthCaption(summary.estimatedProfitGrowth)
        : getRevenueCaption(summary.estimatedProfit, summary.previousEstimatedProfit),
      icon: TrendingUp,
      tone: 'gray'
    }
  ];

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 rounded-lg border border-[#dce8f0] bg-gradient-to-r from-white to-[#f3f9fd] p-4 shadow-[0_1px_3px_rgba(25,28,29,0.06)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#191c1d]">Tổng quan cửa hàng</h1>
          <p className="mt-1 text-sm font-medium text-[#73777d]">
            Toàn bộ số liệu đang hiển thị theo kỳ: {dashboardPeriodLabel.toLowerCase()}
          </p>
        </div>
        <label className="relative w-full sm:w-[180px]">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#557084]">Thời gian báo cáo</span>
          <select
            value={dashboardPeriod}
            onChange={(event) => setDashboardPeriod(event.target.value)}
            className="h-11 w-full appearance-none rounded-lg border border-[#b9d5e7] bg-white pl-3 pr-10 text-sm font-bold text-brand-ink outline-none transition hover:border-brand-strong focus:border-brand-strong focus:ring-2 focus:ring-brand-soft"
          >
            {dashboardPeriodOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute bottom-3 right-3 text-brand-ink" size={18} />
        </label>
      </section>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;
          const CardWrapper = card.to ? Link : 'article';

          return (
            <CardWrapper
              key={card.label}
              to={card.to}
              className={`rounded-lg border bg-white p-3 shadow-[0_1px_3px_rgba(25,28,29,0.08)] ${card.tone === 'amber' && summary.lowStockCount > 0 ? 'border-red-500' : 'border-[#e1e3e4]'} ${
                card.to ? 'block transition hover:border-[#c8dff0] hover:shadow-[0_8px_24px_rgba(116,184,224,0.18)]' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={`truncate text-xs font-semibold ${card.tone === 'amber' && summary.lowStockCount > 0 ? 'text-red-700' : 'text-[#73777d]'}`}>{card.label}</p>
                  <p className="mt-2 text-lg font-bold leading-6 text-[#191c1d]">
                    {isLoading ? '...' : card.value}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs font-medium leading-4 text-[#43474d]">{card.caption}</p>
                </div>
                <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${cardTones[card.tone]}`}>
                  <Icon size={17} />
                </div>
              </div>
            </CardWrapper>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
        <RevenueAreaChart
          totalRevenue={summary.todayRevenue}
          comparisonAmount={revenueComparisonAmount}
          period={dashboardPeriod}
          periodLabel={dashboardPeriodLabel}
        />

        <article className="rounded-lg border border-[#e1e3e4] bg-white p-4 shadow-[0_1px_3px_rgba(25,28,29,0.08)]">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold leading-6 text-[#191c1d]">Top sản phẩm bán chạy</h2>
            <Link to="/products" className="text-sm font-semibold text-brand-strong transition hover:text-brand-deep">
              Tất cả
            </Link>
          </div>

          <div className="space-y-3">
            {topProducts.length === 0 && (
              <p className="text-sm font-medium text-[#73777d]">Chưa có sản phẩm bán chạy trong kỳ này.</p>
            )}
            {topProducts.slice(0, 5).map((product) => (
              <div key={product.product_id} className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold leading-5 text-[#191c1d]">{product.name}</p>
                  <p className="mt-1 text-sm font-medium text-[#73777d]">
                    {product.category_name} - SL {Number(product.quantity || 0).toLocaleString('vi-VN')}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-base font-bold text-[#191c1d]">{formatCurrency(product.revenue)}</p>
                  <p className="mt-1 text-sm font-medium text-[#73777d]">giá {formatCurrency(product.price)}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="rounded-lg border border-[#e1e3e4] bg-white shadow-[0_1px_3px_rgba(25,28,29,0.08)]">
        <div className="flex items-center justify-between gap-4 border-b border-[#e1e3e4] px-4 py-3">
          <h2 className="text-lg font-semibold leading-6 text-[#191c1d]">Đơn hàng gần đây</h2>
          <Link
            to="/orders"
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-brand-strong transition hover:bg-brand-surface"
          >
            Xem tất cả
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left">
            <thead className="text-sm font-bold uppercase tracking-wide text-[#73777d]">
              <tr>
                <th className="px-4 py-2.5 font-bold">Mã đơn</th>
                <th className="px-4 py-2.5 font-bold">Khách hàng</th>
                <th className="px-4 py-2.5 font-bold">Ngày tạo</th>
                <th className="px-4 py-2.5 font-bold text-right">Tổng tiền</th>
                <th className="px-4 py-2.5 font-bold text-center">Trạng thái</th>
                <th className="px-4 py-2.5 font-bold text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e1e3e4]">
              {recentOrders.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-sm font-medium text-[#73777d]">
                    Chưa có đơn hàng gần đây.
                  </td>
                </tr>
              )}
              {recentOrders.slice(0, 4).map((order) => (
                <tr key={order.id} className="text-base transition hover:bg-[#f8f9fa]">
                  <td className="px-4 py-2.5 align-middle font-bold text-[#191c1d]">{order.order_number}</td>
                  <td className="px-4 py-2.5 align-middle">
                    <div className="flex items-center gap-3">
                      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-soft text-[10px] font-bold text-brand-ink">
                        {getInitials(order.customer_name)}
                      </div>
                      <span className="font-medium text-[#43474d]">{order.customer_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 align-middle text-[#43474d]">
                    <span className="font-medium">{formatTime(order.created_at)}</span>
                    <span className="ml-1 text-xs text-[#73777d]">{formatDate(order.created_at)}</span>
                  </td>
                  <td className="px-4 py-2.5 align-middle text-right font-bold text-[#191c1d]">
                    {formatCurrency(order.total)}
                  </td>
                  <td className="px-4 py-2.5 align-middle text-center">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${
                        statusStyles[order.status] || statusStyles.cancelled
                      }`}
                    >
                      {statusLabels[order.status] || order.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 align-middle">
                    <button
                      type="button"
                      className="ml-auto grid h-7 w-7 place-items-center rounded-full text-[#73777d] transition hover:bg-brand-surface hover:text-brand-strong"
                      title="Thao tác"
                      aria-label="Thao tác"
                    >
                      <MoreVertical size={18} />
                    </button>
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
