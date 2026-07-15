import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  CreditCard,
  PackageOpen,
  ReceiptText,
  RotateCcw,
  TrendingUp,
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
  blue: 'bg-blue-50 text-blue-700',
  amber: 'bg-amber-50 text-amber-700',
  cyan: 'bg-cyan-50 text-cyan-700',
  violet: 'bg-violet-50 text-violet-700',
  emerald: 'bg-emerald-50 text-emerald-700'
};

const topProductRankStyles = [
  'border-[#f4c542] bg-[#fff7d6] text-[#8a5b00] shadow-[0_5px_14px_rgba(244,197,66,0.25)]',
  'border-[#cbd5e1] bg-[#f8fafc] text-[#475569] shadow-[0_5px_14px_rgba(148,163,184,0.2)]',
  'border-[#d59a5c] bg-[#fff1e6] text-[#8b4b16] shadow-[0_5px_14px_rgba(213,154,92,0.22)]',
  'border-[#c8dff0] bg-[#eef7fc] text-brand-deep',
  'border-[#d7ece3] bg-[#effaf5] text-[#1f6f4a]'
];

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

function getChangePercent(currentValue, previousValue) {
  const current = safeNumber(currentValue);
  const previous = safeNumber(previousValue);
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function formatChangePercent(value) {
  if (value === null) return null;
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`;
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

function getRevenueCaption(currentRevenue, previousRevenue, comparisonLabel) {
  const current = safeNumber(currentRevenue);
  const previous = safeNumber(previousRevenue);

  if (previous <= 0) {
    return comparisonLabel === 'ngày trước đó'
      ? 'Chưa có dữ liệu so với ngày trước đó'
      : 'Không có dữ liệu ngày trước';
  }

  const delta = current - previous;
  if (delta === 0) return `Không đổi so với ${comparisonLabel}`;
  return `${formatCurrency(Math.abs(delta))} so với ${comparisonLabel}`;
}

function getCountCaption(currentValue, previousValue, noun, comparisonLabel) {
  const current = Math.round(safeNumber(currentValue));
  const previous = Math.round(safeNumber(previousValue));

  if (previous === 0) {
    return comparisonLabel === 'ngày trước đó'
      ? 'Chưa có dữ liệu so với ngày trước đó'
      : 'Không có dữ liệu ngày trước';
  }

  const delta = current - previous;
  if (delta === 0) return `Không đổi so với ${comparisonLabel}`;
  return `${Math.abs(delta).toLocaleString('vi-VN')} ${noun} so với ${comparisonLabel}`;
}

export default function Dashboard() {
  const [summary, setSummary] = useState({
    todayRevenue: 0,
    yesterdayRevenue: 0,
    monthRevenue: 0,
    todayOrders: 0,
    yesterdayOrders: 0,
    averageOrderValue: 0,
    previousAverageOrderValue: 0,
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
  const [operationalAlerts, setOperationalAlerts] = useState({
    lowStockProducts: 0,
    outOfStockProducts: 0,
    slowMovingProducts: 0,
    expiringWarranties: 0
  });
  const [revenueChart, setRevenueChart] = useState([]);
  const [dashboardPeriod, setDashboardPeriod] = useState('7days');
  const [dateFrom, setDateFrom] = useState(() => getLocalDateValue(new Date(Date.now() - 6 * 86400000)));
  const [dateTo, setDateTo] = useState(() => getLocalDateValue());
  const [displayedPeriod, setDisplayedPeriod] = useState('7days');
  const [displayedRange, setDisplayedRange] = useState({ from: '', to: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;

    async function fetchDashboard() {
      setIsLoading(true);

      try {
        const params = { period: dashboardPeriod, date_from: dateFrom, date_to: dateTo };
        const [summaryRes, topRes, recentRes, chartRes, alertsRes] = await Promise.all([
          api.get('/dashboard/summary', { params }),
          api.get('/dashboard/top-products', { params }),
          api.get('/dashboard/recent-orders', { params }),
          api.get('/dashboard/revenue-chart', { params }).catch(() => ({ data: [] })),
          api.get('/dashboard/operational-alerts', { cache: false }).catch(() => ({ data: null }))
        ]);

        if (requestId !== requestIdRef.current) return;

        setSummary(summaryRes.data && typeof summaryRes.data === 'object' ? summaryRes.data : {});
        setTopProducts(Array.isArray(topRes.data) ? topRes.data : []);
        setRecentOrders(Array.isArray(recentRes.data) ? recentRes.data : []);
        setRevenueChart(Array.isArray(chartRes.data) ? chartRes.data : []);
        setOperationalAlerts(alertsRes.data && typeof alertsRes.data === 'object'
          ? alertsRes.data
          : {
              lowStockProducts: safeNumber(summaryRes.data?.lowStockCount),
              outOfStockProducts: 0,
              slowMovingProducts: 0,
              expiringWarranties: 0
            });
        setDisplayedPeriod(dashboardPeriod);
        setDisplayedRange({ from: dateFrom, to: dateTo });
        setError('');
      } catch (requestError) {
        if (requestId !== requestIdRef.current) return;
        setError(requestError.response?.data?.message || 'Không thể tải dữ liệu dashboard');
      } finally {
        if (requestId === requestIdRef.current) setIsLoading(false);
      }
    }

    fetchDashboard();
  }, [dashboardPeriod, dateFrom, dateTo]);

  const dashboardPeriodLabel = useMemo(() => {
    if (displayedRange.from && displayedRange.to) {
      return `${new Intl.DateTimeFormat('vi-VN').format(new Date(`${displayedRange.from}T00:00:00`))} - ${new Intl.DateTimeFormat('vi-VN').format(new Date(`${displayedRange.to}T00:00:00`))}`;
    }
    return dashboardPeriodOptions.find((option) => option.value === displayedPeriod)?.label || dashboardPeriodOptions[0].label;
  }, [displayedRange, displayedPeriod]);

  const comparisonDays = displayedRange.from && displayedRange.to
    ? Math.round((new Date(`${displayedRange.to}T00:00:00`) - new Date(`${displayedRange.from}T00:00:00`)) / 86400000) + 1
    : Number.parseInt(displayedPeriod, 10) || 1;
  const comparisonLabel = displayedPeriod === 'yesterday'
    ? 'ngày trước đó'
    : displayedPeriod === 'today'
      ? 'hôm qua'
      : `${comparisonDays} ngày trước`;

  const cards = [
    {
      id: 'revenue',
      label: 'Doanh thu',
      value: formatCurrency(summary.todayRevenue),
      caption: getRevenueCaption(summary.todayRevenue, summary.yesterdayRevenue, comparisonLabel),
      change: getChangePercent(summary.todayRevenue, summary.yesterdayRevenue),
      icon: WalletCards,
      tone: 'blue'
    },
    {
      id: 'orders',
      label: 'Đơn hàng',
      value: safeNumber(summary.todayOrders).toLocaleString('vi-VN'),
      caption: getCountCaption(summary.todayOrders, summary.yesterdayOrders, 'đơn', comparisonLabel),
      change: getChangePercent(summary.todayOrders, summary.yesterdayOrders),
      icon: ReceiptText,
      tone: 'amber'
    },
    {
      id: 'average-order-value',
      label: 'Giá trị đơn trung bình',
      value: formatCurrency(summary.averageOrderValue),
      caption: getRevenueCaption(summary.averageOrderValue, summary.previousAverageOrderValue, comparisonLabel),
      change: getChangePercent(summary.averageOrderValue, summary.previousAverageOrderValue),
      icon: CreditCard,
      tone: 'cyan'
    },
    {
      id: 'products-sold',
      label: 'Sản phẩm đã bán',
      value: safeNumber(summary.productsSold).toLocaleString('vi-VN'),
      caption: getCountCaption(summary.productsSold, summary.previousProductsSold, 'sản phẩm', comparisonLabel),
      change: getChangePercent(summary.productsSold, summary.previousProductsSold),
      icon: PackageOpen,
      tone: 'violet'
    },
    {
      id: 'profit',
      label: 'Lợi nhuận tạm tính',
      value: formatCurrency(summary.estimatedProfit),
      caption: getRevenueCaption(summary.estimatedProfit, summary.previousEstimatedProfit, comparisonLabel),
      change: getChangePercent(summary.estimatedProfit, summary.previousEstimatedProfit),
      icon: TrendingUp,
      tone: 'emerald'
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

  const paymentChart = useMemo(() => {
    const cashAngle = paymentStats.cashPercent * 3.6;
    const cashConnectorAngle = cashAngle > 0 ? cashAngle / 2 : 18;
    const transferConnectorAngle = cashAngle + ((360 - cashAngle) / 2);
    const centerX = 210;
    const centerY = 95;
    const outerRadius = 62;
    const innerRadius = 34;

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
        label: 'Tiền mặt',
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
        label: 'Chuyển khoản',
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
                const period = event.target.value;
                const days = Number.parseInt(period, 10);
                setDashboardPeriod(period);
                if (Number.isFinite(days)) {
                  setDateTo(getLocalDateValue());
                  setDateFrom(getLocalDateValue(new Date(Date.now() - (days - 1) * 86400000)));
                } else {
                  setDateFrom('');
                  setDateTo('');
                }
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
            <span className="sr-only">Từ ngày</span>
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-strong" size={16} />
            <input
              type="date"
              value={dateFrom}
              max={dateTo || getLocalDateValue()}
              onChange={(event) => setDateFrom(event.target.value)}
              className="h-9 w-full border border-[#b9d5e7] bg-white pl-9 pr-2 text-sm font-semibold text-brand-ink outline-none transition hover:border-brand-strong focus:border-brand-strong focus:ring-2 focus:ring-brand-soft"
              title="Từ ngày"
            />
          </label>
          <label className="relative min-w-[172px] flex-1 sm:flex-none">
            <span className="sr-only">Đến ngày</span>
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-strong" size={16} />
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              max={getLocalDateValue()}
              onChange={(event) => setDateTo(event.target.value)}
              className="h-9 w-full border border-[#b9d5e7] bg-white pl-9 pr-2 text-sm font-semibold text-brand-ink outline-none transition hover:border-brand-strong focus:border-brand-strong focus:ring-2 focus:ring-brand-soft"
              title="Đến ngày"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setDashboardPeriod('today');
              setDateFrom('');
              setDateTo('');
            }}
            className="grid h-9 w-9 shrink-0 place-items-center border border-[#b9d5e7] bg-white text-brand-strong transition hover:border-brand-strong hover:bg-brand-soft"
            title="Xóa khoảng ngày đã chọn"
            aria-label="Đặt lại bộ lọc thời gian"
          >
            <RotateCcw size={17} />
          </button>
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
          const changeText = formatChangePercent(card.change);
          const changeTone = card.change > 0
            ? 'bg-emerald-50 text-emerald-700'
            : card.change < 0
              ? 'bg-rose-50 text-rose-700'
              : 'bg-slate-100 text-slate-600';

          return (
            <CardWrapper
              key={card.id}
              to={card.to}
              title={card.caption}
              className={`border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${
                card.to ? 'block' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 truncate pt-1 text-xs font-extrabold uppercase tracking-wide text-slate-500">{card.label}</p>
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${cardTones[card.tone]}`}>
                  <Icon size={18} strokeWidth={1.8} />
                </span>
              </div>
              <p className="mt-3 truncate text-2xl font-black text-slate-950">{card.value}</p>
              <div className="mt-2 flex min-h-6 flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                {changeText === null ? (
                  <span className="font-semibold text-slate-500">Chưa có dữ liệu kỳ trước</span>
                ) : (
                  <>
                    <span className={`inline-flex px-2 py-0.5 text-xs font-bold ${changeTone}`}>{changeText}</span>
                    <span className="text-slate-500">so với {comparisonLabel}</span>
                  </>
                )}
              </div>
            </CardWrapper>
          );
        })}
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
        <RevenueAreaChart
          chartRows={revenueChart}
          period={displayedPeriod}
          periodLabel={dashboardPeriodLabel}
        />

        <article className="rounded-lg border border-[#e1e3e4] bg-white p-3 shadow-[0_1px_3px_rgba(25,28,29,0.08)]">
          <div className="mb-2 flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold leading-6 text-[#191c1d]">Top sản phẩm bán chạy</h2>
            <Link to={`/products?view=top-products&period=${displayedPeriod}`} className="text-sm font-semibold text-brand-strong transition hover:text-brand-deep">
              Tất cả
            </Link>
          </div>

          <div className="space-y-1">
            {topProducts.length === 0 && (
              <p className="text-sm font-medium text-[#73777d]">Chưa có sản phẩm bán chạy trong kỳ này.</p>
            )}
            {topProducts.slice(0, 5).map((product, index) => (
              <div key={product.product_id} className="flex items-start justify-between gap-4 rounded-md px-1 py-1">
                <div className="flex min-w-0 items-start gap-2.5">
                  <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-extrabold ${topProductRankStyles[index] || topProductRankStyles[4]}`}>
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold leading-5 text-[#191c1d]">{product.name}</p>
                    <p className="mt-0.5 text-xs font-medium text-[#73777d]">
                      {product.category_name} - SL {Number(product.quantity || 0).toLocaleString('vi-VN')}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-[#191c1d]">{formatCurrency(product.revenue)}</p>
                  <p className="mt-0.5 text-xs font-medium text-[#73777d]">Doanh thu:  {formatCurrency(product.price)}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-3 xl:grid-cols-3">
        <article className="flex min-h-[220px] flex-col rounded-lg border border-[#e1e3e4] bg-white p-3 shadow-[0_1px_3px_rgba(25,28,29,0.08)]">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold leading-5 text-[#191c1d]">Phương thức thanh toán</h2>
            <CreditCard size={18} className="text-brand-strong" />
          </div>

          <div className="min-h-[176px] flex-1 overflow-hidden">
            <svg viewBox="0 0 420 190" className="h-full w-full" role="img" aria-label="Biểu đồ phương thức thanh toán">
              {paymentStats.total > 0 ? (
                <>
                  <defs>
                    <mask id="payment-donut-reveal">
                      <rect width="420" height="190" fill="#000000" />
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

        <article className="min-h-[220px] rounded-lg border border-[#e1e3e4] bg-white p-3 shadow-[0_1px_3px_rgba(25,28,29,0.08)]">
          <div className="mb-2.5 flex items-center gap-3">
            <h2 className="text-sm font-black uppercase leading-5 tracking-[0.2em] text-[#172033]">Cảnh báo vận hành</h2>
          </div>

          <div className="grid gap-2.5">
            <div className="min-h-[72px] border border-rose-200 bg-rose-50 px-3 py-2.5 text-rose-700">
              <div className="min-w-0">
                <p className="text-xs font-black leading-4">Khẩn cấp</p>
                <div className="mt-1.5 space-y-1 text-[11px] font-bold leading-4">
                  <div className="flex items-center justify-between gap-3">
                    <p><strong className="mr-1 text-base font-black">{safeNumber(operationalAlerts.lowStockProducts).toLocaleString('vi-VN')}</strong> sản phẩm sắp hết hàng</p>
                    <Link to="/products?stock=low" className="shrink-0 border border-rose-300 bg-white px-2 py-0.5 text-[11px] font-black text-rose-700 transition hover:bg-rose-100">Xem</Link>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p><strong className="mr-1 text-base font-black">{safeNumber(operationalAlerts.outOfStockProducts).toLocaleString('vi-VN')}</strong> sản phẩm hết hàng</p>
                    <Link to="/products?stock=out" className="shrink-0 border border-rose-300 bg-white px-2 py-0.5 text-[11px] font-black text-rose-700 transition hover:bg-rose-100">Xem</Link>
                  </div>
                </div>
              </div>
            </div>

            <div className="min-h-[72px] border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-800">
              <div className="min-w-0">
                <p className="text-xs font-black leading-4">Cần theo dõi</p>
                <div className="mt-1.5 space-y-1 text-[11px] font-bold leading-4">
                  <div className="flex items-center justify-between gap-3">
                    <p><strong className="mr-1 text-base font-black">{safeNumber(operationalAlerts.slowMovingProducts).toLocaleString('vi-VN')}</strong> sản phẩm bán chậm</p>
                    <Link to="/products?view=slow-moving" className="shrink-0 border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-black text-amber-800 transition hover:bg-amber-100">Xem</Link>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p><strong className="mr-1 text-base font-black">{safeNumber(operationalAlerts.expiringWarranties).toLocaleString('vi-VN')}</strong> phiếu bảo hành sắp đến hạn</p>
                    <Link to="/warranties?view=expiring" className="shrink-0 border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-black text-amber-800 transition hover:bg-amber-100">Xem</Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </article>

        <article className="min-h-[220px] rounded-lg border border-[#e1e3e4] bg-white p-3 shadow-[0_1px_3px_rgba(25,28,29,0.08)]">
          <div className="mb-2 flex items-center justify-between gap-4">
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
