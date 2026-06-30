import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarCheck,
  CalendarDays,
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
  { value: 'yesterday', label: 'Hôm qua' },
  { value: '7days', label: '7 ngày' },
  { value: '14days', label: '14 ngày' },
  { value: '30days', label: '30 ngày' },
  { value: '90days', label: '90 ngày' }
];

function getLocalDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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

function getTodayGrowthCaption(value, comparisonLabel = 'hôm qua') {
  if (value === null || value === undefined) return `${comparisonLabel.charAt(0).toUpperCase()}${comparisonLabel.slice(1)} chưa có dữ liệu`;

  const numberValue = safeNumber(value);
  if (numberValue === 0) return `Bằng ${comparisonLabel}`;

  return `${numberValue > 0 ? 'Tăng' : 'Giảm'} ${formatPercent(Math.abs(numberValue))} so với ${comparisonLabel}`;
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
  const elbow = polarToCartesian(centerX, centerY, radius + 16, angle);
  const end = {
    x: elbow.x + (side === 'right' ? 24 : -24),
    y: elbow.y
  };

  return `${start.x},${start.y} ${elbow.x},${elbow.y} ${end.x},${end.y}`;
}

function getConnectorLabelPoint(centerX, centerY, radius, angle, side = 'right') {
  const elbow = polarToCartesian(centerX, centerY, radius + 16, angle);
  const endX = elbow.x + (side === 'right' ? 24 : -24);

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
    paymentCashCount: 0,
    paymentTransferCount: 0,
    revenueGrowth: 0,
    orderGrowth: 0,
    productsSoldGrowth: 0,
    estimatedProfitGrowth: 0
  });
  const [topProducts, setTopProducts] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [staffPerformance, setStaffPerformance] = useState([]);
  const [revenueChart, setRevenueChart] = useState([]);
  const [dashboardPeriod, setDashboardPeriod] = useState('today');
  const [selectedDate, setSelectedDate] = useState('');
  const [displayedPeriod, setDisplayedPeriod] = useState('today');
  const [displayedDate, setDisplayedDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;

    async function fetchDashboard() {
      setIsLoading(true);

      try {
        const params = { period: dashboardPeriod, ...(selectedDate ? { date: selectedDate } : {}) };
        const [summaryRes, topRes, recentRes, chartRes, staffRes] = await Promise.all([
          api.get('/dashboard/summary', { params }),
          api.get('/dashboard/top-products', { params }),
          api.get('/dashboard/recent-orders', { params }),
          api.get('/dashboard/revenue-chart', { params }).catch(() => ({ data: [] })),
          api.get('/dashboard/staff-performance', { params }).catch(() => ({ data: [] }))
        ]);

        if (requestId !== requestIdRef.current) return;

        setSummary(summaryRes.data && typeof summaryRes.data === 'object' ? summaryRes.data : {});
        setTopProducts(Array.isArray(topRes.data) ? topRes.data : []);
        setRecentOrders(Array.isArray(recentRes.data) ? recentRes.data : []);
        setRevenueChart(Array.isArray(chartRes.data) ? chartRes.data : []);
        setStaffPerformance(Array.isArray(staffRes.data) ? staffRes.data : []);
        setDisplayedPeriod(dashboardPeriod);
        setDisplayedDate(selectedDate);
        setError('');
      } catch (requestError) {
        if (requestId !== requestIdRef.current) return;
        setError(requestError.response?.data?.message || 'Không thể tải dữ liệu dashboard');
      } finally {
        if (requestId === requestIdRef.current) setIsLoading(false);
      }
    }

    fetchDashboard();
  }, [dashboardPeriod, selectedDate]);

  const dashboardPeriodLabel = useMemo(() => {
    if (displayedDate) {
      return new Intl.DateTimeFormat('vi-VN').format(new Date(`${displayedDate}T00:00:00`));
    }
    return dashboardPeriodOptions.find((option) => option.value === displayedPeriod)?.label || dashboardPeriodOptions[0].label;
  }, [displayedDate, displayedPeriod]);

  const revenueComparisonAmount = safeNumber(summary.todayRevenue) - safeNumber(summary.yesterdayRevenue);
  const dailyComparisonLabel = displayedPeriod === 'today' && !displayedDate ? 'hôm qua' : 'ngày trước';

  const cards = [
    {
      id: 'revenue',
      label: 'Doanh thu',
      value: formatCurrency(summary.todayRevenue),
      caption: ['today', 'yesterday'].includes(displayedPeriod) || displayedDate
        ? getTodayGrowthCaption(summary.revenueGrowth, dailyComparisonLabel)
        : getRevenueCaption(summary.todayRevenue, summary.yesterdayRevenue),
      icon: WalletCards,
      tone: 'blue'
    },
    {
      id: 'orders',
      label: 'Đơn hàng',
      value: safeNumber(summary.todayOrders).toLocaleString('vi-VN'),
      caption: ['today', 'yesterday'].includes(displayedPeriod) || displayedDate
        ? getTodayGrowthCaption(summary.orderGrowth, dailyComparisonLabel)
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
      label: 'Sản phẩm đã bán',
      value: safeNumber(summary.productsSold).toLocaleString('vi-VN'),
      caption: ['today', 'yesterday'].includes(displayedPeriod) || displayedDate
        ? getTodayGrowthCaption(summary.productsSoldGrowth, dailyComparisonLabel)
        : getCountCaption(summary.productsSold, summary.previousProductsSold, 'sản phẩm'),
      icon: PackageOpen,
      tone: 'slate'
    },
    {
      id: 'profit',
      label: 'Lợi nhuận tạm tính',
      value: formatCurrency(summary.estimatedProfit),
      caption: ['today', 'yesterday'].includes(displayedPeriod) || displayedDate
        ? getTodayGrowthCaption(summary.estimatedProfitGrowth, dailyComparisonLabel)
        : getRevenueCaption(summary.estimatedProfit, summary.previousEstimatedProfit),
      icon: TrendingUp,
      tone: 'gray'
    }
  ];

  const paymentStats = useMemo(() => {
    const totals = {
      cash: safeNumber(summary.paymentCashCount),
      transfer: safeNumber(summary.paymentTransferCount)
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
  }, [summary.paymentCashCount, summary.paymentTransferCount]);

  const staffStats = useMemo(() => {
    return staffPerformance
      .map((staff) => ({
        ...staff,
        count: safeNumber(staff.count),
        total: safeNumber(staff.total)
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [staffPerformance]);

  const paymentChart = useMemo(() => {
    const cashAngle = paymentStats.cashPercent * 3.6;
    const cashConnectorAngle = cashAngle > 0 ? cashAngle / 2 : 18;
    const transferConnectorAngle = cashAngle + ((360 - cashAngle) / 2);
    const centerX = 160;
    const centerY = 102;
    const outerRadius = 60;
    const innerRadius = 32;

    return {
      centerX,
      centerY,
      outerRadius,
      innerRadius,
      cashEnd: cashAngle,
      transferStart: cashAngle,
      cashConnectorAngle,
      transferConnectorAngle,
      cashLabel: paymentStats.cashPercent > 0 ? getConnectorLabelPoint(centerX, centerY, outerRadius, cashConnectorAngle, 'right') : { x: -999, y: -999 },
      transferLabel: paymentStats.transferPercent > 0 ? getConnectorLabelPoint(centerX, centerY, outerRadius, transferConnectorAngle, 'left') : { x: -999, y: -999 }
    };
  }, [paymentStats.cashPercent, paymentStats.transferPercent]);

  const paymentSegments = useMemo(() => {
    const segments = [];

    if (paymentStats.cashPercent > 0) {
      const endAngle = paymentStats.cashPercent >= 100 ? 360 : paymentChart.cashEnd;
      const connectorAngle = paymentStats.cashPercent >= 100 ? 180 : paymentChart.cashConnectorAngle;
      segments.push({
        id: 'cash',
        label: 'Tiá»n máº·t',
        percent: paymentStats.cashPercent,
        color: '#74B8E0',
        startAngle: 0,
        endAngle,
        connectorAngle,
        side: 'right',
        labelPoint: getConnectorLabelPoint(paymentChart.centerX, paymentChart.centerY, paymentChart.outerRadius, connectorAngle, 'right')
      });
    }

    if (paymentStats.transferPercent > 0) {
      const startAngle = paymentStats.transferPercent >= 100 ? 0 : paymentChart.transferStart;
      const connectorAngle = paymentStats.transferPercent >= 100 ? 180 : paymentChart.transferConnectorAngle;
      segments.push({
        id: 'transfer',
        label: 'Chuyá»ƒn khoáº£n',
        percent: paymentStats.transferPercent,
        color: '#7FAF9B',
        startAngle,
        endAngle: 360,
        connectorAngle,
        side: 'left',
        labelPoint: getConnectorLabelPoint(paymentChart.centerX, paymentChart.centerY, paymentChart.outerRadius, connectorAngle, 'left')
      });
    }

    return segments;
  }, [paymentChart, paymentStats.cashPercent, paymentStats.transferPercent]);

  const isFullPaymentDonut = paymentSegments.length === 1 && paymentSegments[0].percent >= 100;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-950">Dashboard</h1>
          <p className="mt-1 text-sm font-medium text-gray-500">Theo dõi nhanh doanh thu, đơn hàng, tồn kho và hiệu quả bán hàng của cửa hàng.</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <label className="relative min-w-[138px] flex-1 sm:flex-none">
            <span className="sr-only">Lọc theo khoảng thời gian</span>
            <select
              value={dashboardPeriod}
              onChange={(event) => {
                setDashboardPeriod(event.target.value);
                setSelectedDate('');
              }}
              className="h-9 w-full appearance-none border border-[#b9d5e7] bg-white pl-3 pr-8 text-sm font-bold text-brand-ink outline-none transition hover:border-brand-strong focus:border-brand-strong focus:ring-2 focus:ring-brand-soft"
            >
              {dashboardPeriodOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-ink" size={16} />
          </label>

          <label className="relative min-w-[172px] flex-1 sm:flex-none">
            <span className="sr-only">Lọc theo ngày cụ thể</span>
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-strong" size={16} />
            <input
              type="date"
              value={selectedDate}
              max={getLocalDateValue()}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="h-9 w-full border border-[#b9d5e7] bg-white pl-9 pr-2 text-sm font-semibold text-brand-ink outline-none transition hover:border-brand-strong focus:border-brand-strong focus:ring-2 focus:ring-brand-soft"
              title="Chọn ngày cụ thể"
            />
          </label>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      <div
        aria-busy={isLoading}
        className={`space-y-3 transition-opacity duration-200 motion-reduce:transition-none ${isLoading ? 'opacity-60' : 'opacity-100'}`}
      >
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;
          const CardWrapper = card.to ? Link : 'article';

          return (
            <CardWrapper
              key={card.id}
              to={card.to}
              className={`rounded-lg border bg-white p-3 shadow-[0_1px_3px_rgba(25,28,29,0.08)] ${card.tone === 'amber' && summary.lowStockCount > 0 ? 'border-red-500' : 'border-[#e1e3e4]'} ${
                card.to ? 'block transition hover:border-[#c8dff0] hover:shadow-[0_8px_24px_rgba(116,184,224,0.18)]' : ''
              }`}
            >
              <div className="flex min-h-[76px] items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`truncate text-[13px] font-bold leading-4 ${card.tone === 'amber' && summary.lowStockCount > 0 ? 'text-red-700' : 'text-[#4f5459]'}`}>{card.label}</p>
                  <p className="mt-2 min-h-6 text-lg font-bold leading-6 text-[#191c1d]">{card.value}</p>
                  <p className="mt-1 line-clamp-1 text-xs font-medium leading-4 text-[#43474d]">{card.caption}</p>
                </div>
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${cardTones[card.tone]}`}>
                  <Icon size={18} />
                </div>
              </div>
            </CardWrapper>
          );
        })}
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
        <RevenueAreaChart
          totalRevenue={summary.todayRevenue}
          comparisonAmount={revenueComparisonAmount}
          chartRows={revenueChart}
          period={displayedDate || displayedPeriod === 'yesterday' ? 'today' : displayedPeriod}
          periodLabel={dashboardPeriodLabel}
        />

        <article className="rounded-lg border border-[#e1e3e4] bg-white p-3 shadow-[0_1px_3px_rgba(25,28,29,0.08)]">
          <div className="mb-2 flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold leading-6 text-[#191c1d]">Top sản phẩm bán chạy</h2>
            <Link to={`/products?view=top-products&period=${displayedPeriod}`} className="text-sm font-semibold text-brand-strong transition hover:text-brand-deep">
              Tất cả
            </Link>
          </div>

          <div className="space-y-2">
            {topProducts.length === 0 && (
              <p className="text-sm font-medium text-[#73777d]">Chưa có sản phẩm bán chạy trong kỳ này.</p>
            )}
            {topProducts.slice(0, 4).map((product) => (
              <div key={product.product_id} className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold leading-5 text-[#191c1d]">{product.name}</p>
                  <p className="mt-0.5 text-xs font-medium text-[#73777d]">
                    {product.category_name} - SL {Number(product.quantity || 0).toLocaleString('vi-VN')}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-[#191c1d]">{formatCurrency(product.revenue)}</p>
                  <p className="mt-0.5 text-xs font-medium text-[#73777d]">giá {formatCurrency(product.price)}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-3 xl:grid-cols-3">
        <article className="min-h-[260px] rounded-lg border border-[#e1e3e4] bg-white p-3 shadow-[0_1px_3px_rgba(25,28,29,0.08)]">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold leading-5 text-[#191c1d]">Phương thức thanh toán</h2>
            <CreditCard size={18} className="text-brand-strong" />
          </div>

          <div className="min-h-[216px] overflow-hidden">
            <svg viewBox="0 0 320 220" className="h-[220px] w-full" role="img" aria-label="Biểu đồ phương thức thanh toán">
              {paymentStats.total > 0 ? (
                <>
                  <defs>
                    <mask id="payment-donut-reveal">
                      <rect width="320" height="220" fill="#000000" />
                      <circle
                        className="payment-donut-reveal"
                        cx={paymentChart.centerX}
                        cy={paymentChart.centerY}
                        r={(paymentChart.outerRadius + paymentChart.innerRadius) / 2}
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth={paymentChart.outerRadius - paymentChart.innerRadius + 4}
                        pathLength="1"
                        strokeDasharray="1"
                      />
                    </mask>
                  </defs>
                  {isFullPaymentDonut ? (
                    <>
                      <circle
                        cx={paymentChart.centerX}
                        cy={paymentChart.centerY}
                        r={paymentChart.outerRadius}
                        fill={paymentSegments[0].color}
                      />
                      <circle
                        cx={paymentChart.centerX}
                        cy={paymentChart.centerY}
                        r={paymentChart.innerRadius}
                        fill="#ffffff"
                      />
                    </>
                  ) : (
                    <g mask="url(#payment-donut-reveal)">
                      {paymentSegments.map((segment) => (
                        <path
                          key={segment.id}
                          d={describeDonutSegment(paymentChart.centerX, paymentChart.centerY, paymentChart.outerRadius, paymentChart.innerRadius, segment.startAngle, segment.endAngle)}
                          fill={segment.color}
                          stroke="#ffffff"
                          strokeWidth="3"
                        />
                      ))}
                    </g>
                  )}
                  <g className="payment-chart-details">
                    {paymentSegments.map((segment) => (
                      <polyline
                        key={`${segment.id}-connector`}
                        points={getConnectorPoints(paymentChart.centerX, paymentChart.centerY, paymentChart.outerRadius, segment.connectorAngle, segment.side)}
                        fill="none"
                        stroke={segment.color}
                        strokeWidth="1.4"
                      />
                    ))}
                    <text x={paymentChart.centerX} y={paymentChart.centerY - 2} textAnchor="middle" dominantBaseline="middle" className="fill-[#191c1d] text-[17px] font-extrabold">100%</text>
                    <text x={paymentChart.centerX} y={paymentChart.centerY + 17} textAnchor="middle" dominantBaseline="middle" className="fill-[#73777d] text-[10px] font-bold">tổng</text>
                    <text x={paymentChart.cashLabel.x} y={paymentChart.cashLabel.y - 4} className="fill-[#191c1d] text-[12px] font-semibold">Tiền mặt</text>
                    <text x={paymentChart.cashLabel.x} y={paymentChart.cashLabel.y + 11} className="fill-[#73777d] text-[11px] font-bold">{paymentStats.cashPercent}%</text>
                    <text x={paymentChart.transferLabel.x} y={paymentChart.transferLabel.y - 4} textAnchor="end" className="fill-[#191c1d] text-[12px] font-semibold">Chuyển khoản</text>
                    <text x={paymentChart.transferLabel.x} y={paymentChart.transferLabel.y + 11} textAnchor="end" className="fill-[#73777d] text-[11px] font-bold">{paymentStats.transferPercent}%</text>
                  </g>
                </>
              ) : (
                <>
                  <circle cx={paymentChart.centerX} cy={paymentChart.centerY} r={paymentChart.outerRadius} fill="#edf2f5" />
                  <circle cx={paymentChart.centerX} cy={paymentChart.centerY} r={paymentChart.innerRadius} fill="#ffffff" />
                  <text x={paymentChart.centerX} y={paymentChart.centerY + 4} textAnchor="middle" className="fill-[#73777d] text-[12px] font-semibold">Chưa có dữ liệu</text>
                </>
              )}
            </svg>
          </div>
        </article>

        <article className="min-h-[260px] rounded-lg border border-[#e1e3e4] bg-white p-3 shadow-[0_1px_3px_rgba(25,28,29,0.08)]">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold leading-5 text-[#191c1d]">Hiệu suất bán hàng của nhân viên</h2>
            <UsersRound size={18} className="text-brand-strong" />
          </div>

          <div className="space-y-3">
            {staffStats.length === 0 && (
              <p className="py-3 text-sm font-medium text-[#73777d]">Chưa có dữ liệu nhân viên.</p>
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

        <article className="min-h-[260px] rounded-lg border border-[#e1e3e4] bg-white p-3 shadow-[0_1px_3px_rgba(25,28,29,0.08)]">
          <div className="mb-2 flex items-center justify-between gap-4 border-b border-[#e1e3e4] pb-2">
            <h2 className="text-sm font-bold leading-5 text-[#191c1d]">Đơn hàng gần đây</h2>
            <Link
              to="/orders"
              className="text-sm font-semibold text-[#191c1d] transition hover:text-[#43474d]"
            >
              Tất cả
            </Link>
          </div>

          <div className="divide-y divide-[#eef1f3]">
            {recentOrders.length === 0 && (
              <p className="py-4 text-center text-sm font-medium text-[#73777d]">
                Chưa có đơn hàng gần đây.
              </p>
            )}
            {recentOrders.slice(0, 4).map((order) => (
              <div key={order.id} className="grid grid-cols-[28px_minmax(0,1fr)_minmax(82px,0.65fr)_auto] items-center gap-2.5 py-2">
                <div className="grid h-6 w-6 place-items-center rounded bg-brand-surface text-brand-strong">
                  <CalendarCheck size={14} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-[#191c1d]">{order.order_number}</p>
                  <p className="mt-0.5 text-[11px] font-medium text-[#73777d]">
                    {formatTime(order.created_at)} {formatDate(order.created_at)}
                  </p>
                </div>
                <p className="truncate text-xs font-medium text-[#43474d]">{order.customer_name}</p>
                <p className="whitespace-nowrap text-right text-xs font-bold text-[#191c1d]">{formatCurrency(order.total)}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
      </div>
    </div>
  );
}
