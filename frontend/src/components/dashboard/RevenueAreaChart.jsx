import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { formatCurrency } from '../../utils/format';

const todayHours = Array.from({ length: 14 }, (_, index) => index + 8);

const periodDays = {
  today: 1,
  '7days': 7,
  '14days': 14,
  '30days': 30,
  '90days': 90
};

const chartDisplayDays = {
  '90days': 30
};

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatMoneyYAxis(value) {
  if (value === 0) return '0';
  if (Math.abs(value) >= 1000000) {
    const millions = value / 1000000;
    return `${millions.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} triệu`;
  }
  if (Math.abs(value) >= 1000) return `${Math.round(value / 1000)}k`;
  return Math.round(value).toLocaleString('vi-VN');
}

function formatDateLabel(date) {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${day}/${month}`;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildDateEntries(period) {
  const days = chartDisplayDays[period] || periodDays[period] || periodDays.today;
  const today = new Date();

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - index));
    return {
      key: formatDateKey(date),
      label: formatDateLabel(date)
    };
  });
}

function buildChartData(chartRows, period) {
  if (period === 'today') {
    const revenueByHour = new Map(
      chartRows.map((row) => [Number(row.bucket), safeNumber(row.revenue)])
    );

    return todayHours.map((hour) => ({
      date: `${hour.toString().padStart(2, '0')}:00`,
      revenue: revenueByHour.get(hour) || 0
    }));
  }

  const revenueByDate = new Map(
    chartRows.map((row) => [String(row.bucket).slice(0, 10), safeNumber(row.revenue)])
  );

  return buildDateEntries(period).map((entry) => ({
    date: entry.label,
    revenue: revenueByDate.get(entry.key) || 0
  }));
}

function getNiceStep(value) {
  if (value <= 0) return 100000;

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const niceNormalized = normalized <= 1
    ? 1
    : normalized <= 2
      ? 2
      : normalized <= 2.5
        ? 2.5
        : normalized <= 5
          ? 5
          : 10;

  return niceNormalized * magnitude;
}

function buildYAxisConfig(data) {
  const maxRevenue = Math.max(0, ...data.map((item) => safeNumber(item.revenue)));

  if (maxRevenue === 0) {
    return {
      width: 56,
      domain: [0, 400000],
      ticks: [0, 100000, 200000, 300000, 400000],
      tickFormatter: formatMoneyYAxis
    };
  }

  const step = getNiceStep((maxRevenue * 1.15) / 4);
  const axisMax = Math.ceil((maxRevenue * 1.15) / step) * step;
  const ticks = Array.from(
    { length: Math.round(axisMax / step) + 1 },
    (_, index) => index * step
  );

  return {
    width: axisMax >= 1000000 ? 72 : 56,
    domain: [0, axisMax],
    ticks,
    tickFormatter: formatMoneyYAxis
  };
}

export default function RevenueAreaChart({
  chartRows = [],
  period = 'today',
  periodLabel = 'Hôm nay'
}) {
  const isToday = period === 'today';
  const data = buildChartData(Array.isArray(chartRows) ? chartRows : [], period);
  const shouldShowEveryDate = period === '14days' || period === '30days';
  const shouldAngleDateLabels = period === '30days';
  const xAxisTicks = period === '90days'
    ? data.filter((_, index) => index % 7 === 0 || index === data.length - 1).map((item) => item.date)
    : undefined;
  const yAxisConfig = buildYAxisConfig(data);

  return (
    <article className="flex h-full min-h-[340px] flex-col rounded-lg border border-[#e1e3e4] bg-white p-3 shadow-[0_1px_3px_rgba(25,28,29,0.08)]">
      <div className="mb-2 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold leading-6 text-[#191c1d]">Doanh thu theo thời gian</h2>
        </div>
        <span className="rounded-lg bg-brand-surface px-2.5 py-1.5 text-xs font-semibold text-brand-ink">
          {periodLabel}
        </span>
      </div>

      <div className="min-h-[220px] w-full flex-1 xl:min-h-[235px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="dashboardRevenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#74B8E0" stopOpacity={0.26} />
                <stop offset="95%" stopColor="#74B8E0" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e6edf3" strokeDasharray="4 4" vertical={false} />
            <XAxis
              dataKey="date"
              axisLine={{ stroke: '#e1e7ec' }}
              tickLine={false}
              tick={{ fill: '#5f6b76', fontSize: shouldAngleDateLabels ? 11 : 12, fontWeight: 600 }}
              ticks={xAxisTicks}
              interval={shouldShowEveryDate ? 0 : undefined}
              minTickGap={shouldShowEveryDate ? 0 : undefined}
              angle={shouldAngleDateLabels ? -35 : 0}
              textAnchor={shouldAngleDateLabels ? 'end' : 'middle'}
              height={shouldAngleDateLabels ? 58 : 30}
              dy={8}
            />
            <YAxis
              width={yAxisConfig.width}
              domain={yAxisConfig.domain}
              ticks={yAxisConfig.ticks}
              axisLine={false}
              tickLine={false}
              tickFormatter={yAxisConfig.tickFormatter}
              tick={{ fill: '#5f6b76', fontSize: 12, fontWeight: 600 }}
            />
            <Tooltip
              formatter={(value) => [formatCurrency(value), 'Doanh thu']}
              labelFormatter={(label) => `${isToday ? 'Giờ' : 'Ngày'} ${label}`}
              contentStyle={{
                border: '1px solid #dce8f0',
                borderRadius: 8,
                boxShadow: '0 10px 24px rgba(25,28,29,0.12)',
                fontSize: 12
              }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#74B8E0"
              strokeWidth={3}
              fill="url(#dashboardRevenueFill)"
              dot={{ r: 4.5, fill: '#ffffff', stroke: '#74B8E0', strokeWidth: 2.5 }}
              activeDot={{ r: 6, fill: '#ffffff', stroke: '#74B8E0', strokeWidth: 3 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

    </article>
  );
}
