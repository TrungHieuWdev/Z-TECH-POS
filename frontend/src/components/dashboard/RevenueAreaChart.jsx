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

const shapeValues = [0, 65000, 65000, 165000, 280000, 390000, 350000, 350000];

const periodDays = {
  today: 1,
  '7days': 7,
  '14days': 14,
  '30days': 30,
  '90days': 90
};

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatYAxis(value) {
  if (value === 0) return '0';
  return `${Math.round(value / 1000)}k`;
}

function formatDateLabel(date) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit'
  }).format(date);
}

function buildDateLabels(period) {
  const days = periodDays[period] || periodDays.today;
  const pointCount = shapeValues.length;
  const today = new Date();

  if (days === 1) {
    return shapeValues.map(() => formatDateLabel(today));
  }

  return shapeValues.map((_, index) => {
    const ratio = pointCount === 1 ? 0 : index / (pointCount - 1);
    const daysAgo = Math.round((days - 1) * (1 - ratio));
    const date = new Date(today);
    date.setDate(today.getDate() - daysAgo);
    return formatDateLabel(date);
  });
}

export default function RevenueAreaChart({
  totalRevenue = 0,
  comparisonAmount = 0,
  period = 'today',
  periodLabel = 'Hôm nay'
}) {
  const safeTotal = safeNumber(totalRevenue);
  const safeComparison = safeNumber(comparisonAmount);
  const labels = buildDateLabels(period);
  const basePeak = Math.max(...shapeValues);
  const scale = safeTotal > 0 ? Math.max(safeTotal, 376000) / basePeak : 1;
  const data = shapeValues.map((value, index) => ({
    date: labels[index],
    revenue: Math.round(value * scale)
  }));

  return (
    <article className="rounded-lg border border-[#e1e3e4] bg-white p-4 shadow-[0_1px_3px_rgba(25,28,29,0.08)]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold leading-6 text-[#191c1d]">Cơ cấu doanh thu</h2>
          <p className="mt-0.5 text-xs font-medium text-[#73777d]">Doanh thu phát sinh theo ngày</p>
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
              tick={{ fill: '#5f6b76', fontSize: 12, fontWeight: 600 }}
              dy={8}
            />
            <YAxis
              width={42}
              domain={[0, 400000]}
              ticks={[0, 100000, 200000, 300000, 400000]}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatYAxis}
              tick={{ fill: '#5f6b76', fontSize: 12, fontWeight: 600 }}
            />
            <Tooltip
              formatter={(value) => [formatCurrency(value), 'Doanh thu']}
              labelFormatter={(label) => `Ngày ${label}`}
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
