import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarCheck,
  ChevronDown,
  CreditCard,
  PackageCheck,
  PackageOpen,
  ReceiptText,
  TrendingUp,
  UsersRound,
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

function formatPercent(value) {
  const numberValue = Number(value || 0);
  const cappedValue = Math.max(-100, Math.min(100, numberValue));
  const prefix = cappedValue > 0 ? '+' : '';
  return `${prefix}${cappedValue.toLocaleString('vi-VN')}%`;
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

function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;

  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians)
  };
}

function describeDonutSegment(centerX, centerY, outerRadius, innerRadius, startAngle, endAngle) {
  const sweepAngle = endAngle - startAngle;
  if (sweepAngle <= 0) return '';
  if (sweepAngle >= 359.99) {
    const topOuter = polarToCartesian(centerX, centerY, outerRadius, 0);
    const bottomOuter = polarToCartesian(centerX, centerY, outerRadius, 180);
    const topInner = polarToCartesian(centerX, centerY, innerRadius, 0);
    const bottomInner = polarToCartesian(centerX, centerY, innerRadius, 180);

    return [
      `M ${topOuter.x} ${topOuter.y}`,
      `A ${outerRadius} ${outerRadius} 0 1 1 ${bottomOuter.x} ${bottomOuter.y}`,
      `A ${outerRadius} ${outerRadius} 0 1 1 ${topOuter.x} ${topOuter.y}`,
      `L ${topInner.x} ${topInner.y}`,
      `A ${innerRadius} ${innerRadius} 0 1 0 ${bottomInner.x} ${bottomInner.y}`,
      `A ${innerRadius} ${innerRadius} 0 1 0 ${topInner.x} ${topInner.y}`,
      'Z'
    ].join(' ');
  }

  const outerStart = polarToCartesian(centerX, centerY, outerRadius, endAngle);
  const outerEnd = polarToCartesian(centerX, centerY, outerRadius, startAngle);
  const innerStart = polarToCartesian(centerX, centerY, innerRadius, startAngle);
  const innerEnd = polarToCartesian(centerX, centerY, innerRadius, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 0 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 1 ${innerEnd.x} ${innerEnd.y}`,
    'Z'
  ].join(' ');
}

function getConnectorPoints(centerX, centerY, radius, angle, side = 'right') {
  const start = polarToCartesian(centerX, centerY, radius - 4, angle);
  const elbow = polarToCartesian(centerX, centerY, radius + 20, angle);
  const end = {
    x: elbow.x + (side === 'right' ? 28 : -28),
    y: elbow.y
  };

  return `${start.x},${start.y} ${elbow.x},${elbow.y} ${end.x},${end.y}`;
}

function getConnectorLabelPoint(centerX, centerY, radius, angle, side = 'right') {
  const elbow = polarToCartesian(centerX, centerY, radius + 20, angle);
  const endX = elbow.x + (side === 'right' ? 28 : -28);

  return {
    x: endX + (side === 'right' ? 8 : -8),
    y: elbow.y
  };
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
    paymentCash: 0,
    paymentTransfer: 0,
    revenueGrowth: 0,
    orderGrowth: 0,
    productsSoldGrowth: 0,
    estimatedProfitGrowth: 0
  });
  const [topProducts, setTopProducts] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [revenueChart, setRevenueChart] = useState([]);
  const [dashboardPeriod, setDashboardPeriod] = useState('today');
  const [displayedPeriod, setDisplayedPeriod] = useState('today');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;

    async function fetchDashboard() {
      setIsLoading(true);

      try {
        const params = { period: dashboardPeriod };
        const [summaryRes, topRes, recentRes, chartRes] = await Promise.all([
          api.get('/dashboard/summary', { params }),
          api.get('/dashboard/top-products', { params }),
          api.get('/dashboard/recent-orders', { params }),
          api.get('/dashboard/revenue-chart', { params }).catch(() => ({ data: [] }))
        ]);

        if (requestId !== requestIdRef.current) return;

        setSummary(summaryRes.data);
        setTopProducts(topRes.data);
        setRecentOrders(recentRes.data);
        setRevenueChart(Array.isArray(chartRes.data) ? chartRes.data : []);
        setDisplayedPeriod(dashboardPeriod);
        setError('');
      } catch (requestError) {
        if (requestId !== requestIdRef.current) return;
        setError(requestError.response?.data?.message || 'Không thể tải dữ liệu dashboard');
      } finally {
        if (requestId === requestIdRef.current) setIsLoading(false);
      }
    }

    fetchDashboard();
  }, [dashboardPeriod]);

  const dashboardPeriodLabel = useMemo(() => {
    return dashboardPeriodOptions.find((option) => option.value === displayedPeriod)?.label || dashboardPeriodOptions[0].label;
  }, [displayedPeriod]);

  const revenueComparisonAmount = safeNumber(summary.todayRevenue) - safeNumber(summary.yesterdayRevenue);

  const cards = [
    {
      id: 'revenue',
      label: `Doanh thu - ${dashboardPeriodLabel}`,
      value: formatCurrency(summary.todayRevenue),
      caption: displayedPeriod === 'today'
        ? getTodayGrowthCaption(summary.revenueGrowth)
        : getRevenueCaption(summary.todayRevenue, summary.yesterdayRevenue),
      icon: WalletCards,
      tone: 'blue'
    },
    {
      id: 'orders',
      label: `Đơn hàng - ${dashboardPeriodLabel}`,
      value: safeNumber(summary.todayOrders).toLocaleString('vi-VN'),
      caption: displayedPeriod === 'today'
        ? getTodayGrowthCaption(summary.orderGrowth)
        : getCountCaption(summary.todayOrders, summary.yesterdayOrders, 'đơn'),
      icon: ReceiptText,
      tone: 'gray'
    },
    {
      id: 'low-stock',
      label: 'Sắp hết hàng',
      value: `${safeNumber(summary.lowStockCount).toLocaleString('vi-VN')} sản phẩm`,
      caption: summary.lowStockCount > 0 ? 'Dưới mức tồn tối thiểu' : 'Kho đang ổn định',
      icon: PackageCheck,
      tone: 'amber',
      to: '/products?lowStock=1'
    },
    {
      id: 'products-sold',
      label: `Sản phẩm đã bán - ${dashboardPeriodLabel}`,
      value: safeNumber(summary.productsSold).toLocaleString('vi-VN'),
      caption: displayedPeriod === 'today'
        ? getTodayGrowthCaption(summary.productsSoldGrowth)
        : getCountCaption(summary.productsSold, summary.previousProductsSold, 'sản phẩm'),
      icon: PackageOpen,
      tone: 'slate'
    },
    {
      id: 'profit',
      label: `Lợi nhuận tạm tính - ${dashboardPeriodLabel}`,
      value: formatCurrency(summary.estimatedProfit),
      caption: displayedPeriod === 'today'
        ? getTodayGrowthCaption(summary.estimatedProfitGrowth)
        : getRevenueCaption(summary.estimatedProfit, summary.previousEstimatedProfit),
      icon: TrendingUp,
      tone: 'gray'
    }
  ];

  const paymentStats = useMemo(() => {
    const totals = {
      cash: safeNumber(summary.paymentCash),
      transfer: safeNumber(summary.paymentTransfer)
    };
    const total = totals.cash + totals.transfer;
    const cashPercent = total > 0 ? Math.round((totals.cash / total) * 100) : 0;
    const transferPercent = total > 0 ? 100 - cashPercent : 0;

    return {
      ...totals,
      total,
      cashPercent,
      transferPercent
    };
  }, [summary.paymentCash, summary.paymentTransfer]);

  const staffStats = useMemo(() => {
    const totals = recentOrders.reduce((map, order) => {
      const key = order.cashier_name || 'Nhân viên';
      const normalizedName = key.trim().toLowerCase();
      if (['quản lý', 'quan ly', 'admin', 'administrator'].includes(normalizedName)) {
        return map;
      }

      const current = map.get(key) || { name: key, total: 0, count: 0 };
      current.total += safeNumber(order.total);
      current.count += 1;
      map.set(key, current);
      return map;
    }, new Map());

    return Array.from(totals.values()).sort((a, b) => b.total - a.total).slice(0, 3);
  }, [recentOrders]);

  const paymentChart = useMemo(() => {
    const cashAngle = paymentStats.cashPercent * 3.6;
    const cashConnectorAngle = cashAngle > 0 ? cashAngle / 2 : 18;
    const transferConnectorAngle = cashAngle + ((360 - cashAngle) / 2);

    return {
      cashEnd: cashAngle,
      transferStart: cashAngle,
      cashConnectorAngle,
      transferConnectorAngle,
      cashLabel: getConnectorLabelPoint(150, 86, 58, cashConnectorAngle, 'right'),
      transferLabel: getConnectorLabelPoint(150, 86, 58, transferConnectorAngle, 'left')
    };
  }, [paymentStats.cashPercent]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-950">Dashboard</h1>
          <p className="mt-1 text-sm font-medium text-gray-500">
            Theo dõi doanh thu, đơn hàng, tồn kho và hiệu suất bán hàng.
          </p>
        </div>
        <label className="relative w-full sm:w-[180px]">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#557084]">Thời gian báo cáo</span>
          <select
            value={dashboardPeriod}
            onChange={(event) => setDashboardPeriod(event.target.value)}
            className="h-11 w-full appearance-none border border-[#b9d5e7] bg-white pl-3 pr-10 text-sm font-bold text-brand-ink outline-none transition hover:border-brand-strong focus:border-brand-strong focus:ring-2 focus:ring-brand-soft"
          >
            {dashboardPeriodOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute bottom-3 right-3 text-brand-ink" size={18} />
        </label>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      <div
        aria-busy={isLoading}
        className={`space-y-4 transition-opacity duration-200 motion-reduce:transition-none ${isLoading ? 'opacity-60' : 'opacity-100'}`}
      >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;
          const CardWrapper = card.to ? Link : 'article';

          return (
            <CardWrapper
              key={card.id}
              to={card.to}
              className={`rounded-lg border bg-white p-4 shadow-[0_1px_3px_rgba(25,28,29,0.08)] ${card.tone === 'amber' && summary.lowStockCount > 0 ? 'border-red-500' : 'border-[#e1e3e4]'} ${
                card.to ? 'block transition hover:border-[#c8dff0] hover:shadow-[0_8px_24px_rgba(116,184,224,0.18)]' : ''
              }`}
            >
              <div className="flex min-h-[92px] items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`truncate text-sm font-semibold ${card.tone === 'amber' && summary.lowStockCount > 0 ? 'text-red-700' : 'text-[#73777d]'}`}>{card.label}</p>
                  <p className="mt-3 min-h-7 text-xl font-bold leading-7 text-[#191c1d]">{card.value}</p>
                  <p className="mt-1.5 line-clamp-2 text-sm font-medium leading-5 text-[#43474d]">{card.caption}</p>
                </div>
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${cardTones[card.tone]}`}>
                  <Icon size={20} />
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
          chartRows={revenueChart}
          period={displayedPeriod}
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

      <section className="grid gap-4 xl:grid-cols-3">
        <article className="rounded-lg border border-[#e1e3e4] bg-white p-4 shadow-[0_1px_3px_rgba(25,28,29,0.08)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold leading-5 text-[#191c1d]">Phương thức thanh toán</h2>
            <CreditCard size={18} className="text-brand-strong" />
          </div>

          <div className="min-h-[142px]">
            <svg viewBox="0 0 300 170" className="h-[170px] w-full overflow-visible" role="img" aria-label="Biểu đồ phương thức thanh toán">
              {paymentStats.total > 0 ? (
                <>
                  <path
                    d={describeDonutSegment(150, 86, 58, 27, 0, paymentChart.cashEnd)}
                    fill="#2f8cf0"
                    stroke="#ffffff"
                    strokeWidth="3"
                  />
                  <path
                    d={describeDonutSegment(150, 86, 58, 27, paymentChart.transferStart, 360)}
                    fill="#f59e0b"
                    stroke="#ffffff"
                    strokeWidth="3"
                  />
                  <polyline
                    points={getConnectorPoints(150, 86, 58, paymentChart.cashConnectorAngle, 'right')}
                    fill="none"
                    stroke="#2f8cf0"
                    strokeWidth="1.4"
                  />
                  <polyline
                    points={getConnectorPoints(150, 86, 58, paymentChart.transferConnectorAngle, 'left')}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="1.4"
                  />
                  <text x={paymentChart.cashLabel.x} y={paymentChart.cashLabel.y - 4} className="fill-[#191c1d] text-[12px] font-semibold">Tiền mặt</text>
                  <text x={paymentChart.cashLabel.x} y={paymentChart.cashLabel.y + 11} className="fill-[#73777d] text-[11px] font-bold">{paymentStats.cashPercent}%</text>
                  <text x={paymentChart.transferLabel.x} y={paymentChart.transferLabel.y - 4} textAnchor="end" className="fill-[#191c1d] text-[12px] font-semibold">Chuyển khoản</text>
                  <text x={paymentChart.transferLabel.x} y={paymentChart.transferLabel.y + 11} textAnchor="end" className="fill-[#73777d] text-[11px] font-bold">{paymentStats.transferPercent}%</text>
                </>
              ) : (
                <>
                  <circle cx="150" cy="86" r="58" fill="#edf2f5" />
                  <circle cx="150" cy="86" r="27" fill="#ffffff" />
                  <text x="150" y="91" textAnchor="middle" className="fill-[#73777d] text-[12px] font-semibold">Chưa có dữ liệu</text>
                </>
              )}
            </svg>
          </div>
        </article>

        <article className="rounded-lg border border-[#e1e3e4] bg-white p-4 shadow-[0_1px_3px_rgba(25,28,29,0.08)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold leading-5 text-[#191c1d]">Hiệu suất bán hàng nhân viên</h2>
            <UsersRound size={18} className="text-brand-strong" />
          </div>

          <div className="space-y-3">
            {staffStats.length === 0 && (
              <p className="py-5 text-sm font-medium text-[#73777d]">Chưa có dữ liệu nhân viên.</p>
            )}
            {staffStats.map((staff) => (
              <div key={staff.name} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium text-[#43474d]">{staff.name}</span>
                <span className="shrink-0 text-xs font-semibold text-[#191c1d]">
                  {staff.count} đơn - {formatCurrency(staff.total)}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-lg border border-[#e1e3e4] bg-white p-4 shadow-[0_1px_3px_rgba(25,28,29,0.08)]">
          <div className="mb-3 flex items-center justify-between gap-4 border-b border-[#e1e3e4] pb-3">
            <h2 className="text-sm font-bold leading-5 text-[#191c1d]">Đơn hàng gần đây</h2>
          </div>

          <div className="divide-y divide-[#eef1f3]">
            {recentOrders.length === 0 && (
              <p className="py-8 text-center text-sm font-medium text-[#73777d]">
                Chưa có đơn hàng gần đây.
              </p>
            )}
            {recentOrders.slice(0, 2).map((order) => (
              <div key={order.id} className="grid grid-cols-[28px_minmax(0,1fr)_minmax(82px,0.65fr)_auto] items-center gap-2.5 py-2.5">
                <div className="grid h-6 w-6 place-items-center rounded bg-brand-surface text-brand-strong">
                  <CalendarCheck size={14} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-brand-strong">{order.order_number}</p>
                  <p className="mt-0.5 text-[11px] font-medium text-[#73777d]">
                    {formatTime(order.created_at)} {formatDate(order.created_at)}
                  </p>
                </div>
                <p className="truncate text-xs font-medium text-[#43474d]">{order.customer_name}</p>
                <p className="whitespace-nowrap text-right text-xs font-bold text-[#191c1d]">{formatCurrency(order.total)}</p>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <Link
              to="/orders"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-strong transition hover:text-brand-deep"
            >
              <span>Xem tất cả</span>
              <ArrowRight size={15} />
            </Link>
          </div>
        </article>
      </section>
      </div>
    </div>
  );
}
