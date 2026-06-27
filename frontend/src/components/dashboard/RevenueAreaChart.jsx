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

const periodYAxisConfigs = {
  '7days': {
    max: 50000000,
    step: 10000000
  },
  '14days': {
    max: 100000000,
    step: 20000000
  },
  '30days': {
    max: 200000000,
    step: 50000000
  },
  '90days': {
    max: 200000000,
    step: 50000000
  }
};

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatYAxis(value) {
  if (value === 0) return '0';
  return `${Math.round(value / 1000)}k`;
}

function formatMillionYAxis(value) {
  if (value === 0) return '0';
  return `${Math.round(value / 1000000)} triệu`;
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

function buildPeriodYAxisConfig(period) {
  const config = periodYAxisConfigs[period];

  if (!config) {
    return {
      width: 42,
      domain: [0, 400000],
      ticks: [0, 100000, 200000, 300000, 400000],
      tickFormatter: formatYAxis
    };
  }

  const ticks = [];
  for (let value = 0; value <= config.max; value += config.step) {
    ticks.push(value);
  }

  return {
    width: 72,
    domain: [0, config.max],
    ticks,
    tickFormatter: formatMillionYAxis
  };
}

export default function RevenueAreaChart({
  totalRevenue = 0,
  comparisonAmount = 0,
  chartRows = [],
  period = 'today',
  periodLabel = 'Hôm nay'
}) {
  const safeTotal = safeNumber(totalRevenue);
  const safeComparison = safeNumber(comparisonAmount);
  const isToday = period === 'today';
  const data = buildChartData(Array.isArray(chartRows) ? chartRows : [], period);
  const shouldShowEveryDate = period === '14days' || period === '30days';
  const shouldAngleDateLabels = period === '30days';
  const xAxisTicks = period === '90days'
    ? data.filter((_, index) => index % 7 === 0 || index === data.length - 1).map((item) => item.date)
    : undefined;
  const yAxisConfig = isToday
    ? {
        width: 64,
        domain: [0, 10000000],
        ticks: [0, 2500000, 5000000, 7500000, 10000000],
        tickFormatter: formatMillionYAxis
      }
    : buildPeriodYAxisConfig(period);

  return (
    <article className="rounded-lg border border-[#e1e3e4] bg-white p-4 shadow-[0_1px_3px_rgba(25,28,29,0.08)]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold leading-6 text-[#191c1d]">Cơ cấu doanh thu</h2>
          <p className="mt-0.5 text-xs font-medium text-[#73777d]">
            {isToday ? 'Doanh thu phát sinh theo giờ' : 'Doanh thu phát sinh theo ngày'}
          </p>
        </div>
        <span className="rounded-lg bg-brand-surface px-3 py-2 text-sm font-semibold text-brand-ink">
          {periodLabel}
        </span>
      </div>

      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="dashboardRevenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1f86f2" stopOpacity={0.26} />
                <stop offset="95%" stopColor="#1f86f2" stopOpacity={0.04} />
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
              stroke="#1f86f2"
              strokeWidth={3}
              fill="url(#dashboardRevenueFill)"
              dot={{ r: 4.5, fill: '#ffffff', stroke: '#1f86f2', strokeWidth: 2.5 }}
              activeDot={{ r: 6, fill: '#ffffff', stroke: '#1f86f2', strokeWidth: 3 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex items-end justify-between border-t border-[#e1e3e4] pt-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#73777d]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#1f86f2]" />
            Tổng doanh thu
          </div>
          <p className="mt-1 text-lg font-bold text-[#191c1d]">{formatCurrency(safeTotal)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-emerald-600">↑ {formatCurrency(Math.abs(safeComparison))}</p>
          <p className="mt-1 text-xs font-semibold text-[#73777d]">so với kỳ trước</p>
        </div>
      </div>
    </article>
  );
}
