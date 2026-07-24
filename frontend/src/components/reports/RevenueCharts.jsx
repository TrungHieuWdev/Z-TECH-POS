import { useEffect, useRef } from 'react';
import {
  BarElement, CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale,
  LineElement, PointElement, Title, Tooltip, ArcElement
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { formatCurrency } from '../../utils/format';

const SYSTEM_BLUE = '#74B8E0';
const colors = [SYSTEM_BLUE, '#16b8cf', '#8255e8', '#14a88f', '#eea11d', '#e94d85'];
const categoryRevenueColors = [SYSTEM_BLUE, '#14b884', '#f59e0b', '#ef5350', '#8255e8', '#64748b'];
const topProductColors = [SYSTEM_BLUE, '#06b6d4', '#e84d87', '#10a88a', '#f59e0b'];
const chartFont = "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const outsideLabelsPlugin = {
  id: 'outsideLabels',
  afterDraw(chart) {
    const dataset = chart.data.datasets[0];
    if (!dataset?.outsideLabels) return;
    const values = dataset.data.map(Number);
    const total = values.reduce((sum, value) => sum + value, 0);
    if (!total) return;
    const meta = chart.getDatasetMeta(0);
    const { ctx } = chart;
    ctx.save();
    ctx.font = `700 ${chart.width < 520 ? 10 : 12}px ${chartFont}`;
    ctx.lineWidth = 1.25;
    const labels = meta.data.map((arc, index) => {
      const { x, y, startAngle, endAngle, outerRadius } = arc.getProps(['x', 'y', 'startAngle', 'endAngle', 'outerRadius'], true);
      const angle = (startAngle + endAngle) / 2;
      const direction = Math.cos(angle) >= 0 ? 1 : -1;
      return {
        index, x, y, angle, outerRadius, direction,
        targetY: y + Math.sin(angle) * (outerRadius + 30)
      };
    });
    for (const direction of [-1, 1]) {
      const side = labels.filter((item) => item.direction === direction).sort((a, b) => a.targetY - b.targetY);
      const minimumY = 18;
      const maximumY = chart.height - 18;
      const gap = chart.width < 520 ? 18 : 24;
      side.forEach((item, index) => {
        item.targetY = Math.max(item.targetY, index === 0 ? minimumY : side[index - 1].targetY + gap);
      });
      if (side.length && side.at(-1).targetY > maximumY) {
        const overflow = side.at(-1).targetY - maximumY;
        side.forEach((item) => { item.targetY -= overflow; });
      }
    }
    labels.forEach((item) => {
      const { index, x, y, angle, outerRadius, direction, targetY } = item;
      const color = dataset.backgroundColor[index];
      const percentage = Math.round(values[index] / total * 100);
      const text = `${chart.data.labels[index]} ${percentage}%`;
      const textWidth = ctx.measureText(text).width;
      const preferredTextX = direction > 0
        ? x + outerRadius + textWidth + 28
        : x - outerRadius - textWidth - 28;
      const textX = direction > 0
        ? Math.min(chart.width - 8, preferredTextX)
        : Math.max(8, preferredTextX);
      const endX = direction > 0 ? textX - textWidth - 5 : textX + textWidth + 5;
      const startX = x + Math.cos(angle) * (outerRadius + 3);
      const startY = y + Math.sin(angle) * (outerRadius + 3);
      const bendX = x + direction * (outerRadius + 18);
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(bendX, targetY);
      ctx.lineTo(endX, targetY);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.textAlign = direction > 0 ? 'right' : 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, textX, targetY);
    });
    ctx.restore();
  }
};

const centerLabelPlugin = {
  id: 'centerLabel',
  afterDraw(chart) {
    const dataset = chart.data.datasets[0];
    if (!dataset?.centerLabel) return;
    const total = dataset.data.reduce((sum, value) => sum + Number(value || 0), 0);
    if (total <= 0) return;

    const firstArc = chart.getDatasetMeta(0)?.data?.[0];
    if (!firstArc) return;

    const { x, y, innerRadius } = firstArc.getProps(['x', 'y', 'innerRadius'], true);
    const fontSize = Math.max(17, Math.min(24, innerRadius * 0.42));
    const { ctx } = chart;
    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.font = `800 ${fontSize}px ${chartFont}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(dataset.centerLabel, x, y);
    ctx.restore();
  }
};

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Title, Filler, outsideLabelsPlugin, centerLabelPlugin);
const moneyAxis = (value) => {
  const number = Number(value || 0);
  const compactNumber = (amount) => amount.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  if (Math.abs(number) >= 1000000000) return `${compactNumber(number / 1000000000)} tỷ`;
  if (Math.abs(number) >= 1000000) return `${compactNumber(number / 1000000)} triệu`;
  if (Math.abs(number) >= 1000) return `${compactNumber(number / 1000)} nghìn`;
  return String(number);
};

const tooltipStyle = {
  backgroundColor: '#ffffff',
  titleColor: '#0f172a',
  bodyColor: '#334155',
  borderColor: '#dbe4ee',
  borderWidth: 1,
  padding: 11,
  cornerRadius: 8,
  displayColors: true,
  boxPadding: 4,
  titleFont: { family: chartFont, size: 12, weight: '700' },
  bodyFont: { family: chartFont, size: 12, weight: '600' }
};

const axisTicks = { color: '#64748b', font: { family: chartFont, size: 11, weight: '500' } };
const gridStyle = { color: '#e8eef5', borderDash: [4, 4], drawTicks: false };

const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 450, easing: 'easeOutQuart' },
  interaction: { mode: 'index', intersect: false },
  layout: { padding: { top: 4 } },
  plugins: {
    legend: { position: 'bottom', labels: { color: '#475569', usePointStyle: true, pointStyle: 'circle', boxWidth: 7, boxHeight: 7, padding: 18, font: { family: chartFont, size: 11, weight: '600' } } },
    tooltip: { ...tooltipStyle, callbacks: { label: (context) => `${context.dataset.label}: ${formatCurrency(context.parsed.y ?? context.parsed.x ?? context.parsed)}` } }
  },
  scales: {
    x: { border: { display: false }, grid: { display: false }, ticks: { ...axisTicks, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
    y: { beginAtZero: true, border: { display: false }, grid: gridStyle, ticks: { ...axisTicks, padding: 8, callback: moneyAxis } }
  }
};

function withMotion(animation) {
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  return animation;
}

function AnimatedDoughnut({ data, options }) {
  const chartRef = useRef(null);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || chart.options.animation === false) return undefined;
    chart.stop();
    chart.reset();
    const frame = window.requestAnimationFrame(() => chart.update());
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return <Doughnut ref={chartRef} data={data} options={options} />;
}

function growFromZero(axis, entranceDelay, itemDelay = 90) {
  return withMotion({
    [axis]: {
      type: 'number',
      duration: 900,
      easing: 'easeOutQuart',
      from: (context) => context.chart.scales[axis].getPixelForValue(0),
      delay: (context) => entranceDelay + context.dataIndex * itemDelay
    }
  });
}

function drawLineProgressively(pointCount, entranceDelay) {
  const pointDelay = Math.max(45, Math.min(110, Math.round(1050 / Math.max(1, pointCount))));
  const previousPointY = (context) => {
    if (context.index === 0) return context.chart.scales.y.getPixelForValue(0);
    const previousPoint = context.chart.getDatasetMeta(context.datasetIndex).data[context.index - 1];
    return previousPoint?.getProps(['y'], true).y ?? context.chart.scales.y.getPixelForValue(0);
  };
  return withMotion({
    x: {
      type: 'number',
      duration: pointDelay,
      easing: 'linear',
      from: Number.NaN,
      delay: (context) => entranceDelay + context.index * pointDelay
    },
    y: {
      type: 'number',
      duration: pointDelay * 1.8,
      easing: 'easeOutCubic',
      from: previousPointY,
      delay: (context) => entranceDelay + context.index * pointDelay
    }
  });
}

function compactDateLabel(label) {
  const parts = String(label || '').split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  if (parts.length === 2) return `${parts[1]}/${parts[0]}`;
  return label;
}

export function DailyRevenueChart({ trend }) {
  const points = trend?.points || [];
  const values = points.map((item) => Number(item.netRevenue || 0));
  const peak = Math.max(...values, 0);
  const data = {
    labels: points.map((item) => compactDateLabel(item.label)),
    datasets: [{
      label: 'Doanh thu thuần',
      data: values,
      backgroundColor: values.map((value, index) => value === peak && peak > 0 ? SYSTEM_BLUE : colors[(index + 1) % colors.length]),
      hoverBackgroundColor: SYSTEM_BLUE,
      borderRadius: 0,
      borderSkipped: false,
      maxBarThickness: 42
    }]
  };
  return <Bar data={data} options={{
    ...baseOptions,
    animation: withMotion({ duration: 950, easing: 'easeOutQuart', delay: 180 }),
    animations: growFromZero('y', 180, 75),
    plugins: { ...baseOptions.plugins, legend: { display: false } }
  }} />;
}

export function GrossProfitChart({ trend }) {
  const points = trend?.points || [];
  const values = points.map((item) => Number(item.grossProfit || 0));
  const labels = points.map((item) => compactDateLabel(item.label));

  const data = {
    labels,
    datasets: [{
      label: 'Lợi nhuận gộp',
      data: values,
      borderColor: '#8255e8',
      backgroundColor: 'rgba(130, 85, 232, 0.10)',
      borderWidth: 2.5,
      pointRadius: 3,
      pointHoverRadius: 6,
      pointStyle: 'circle',
      pointBackgroundColor: '#ffffff',
      pointBorderColor: '#8255e8',
      pointBorderWidth: 2,
      tension: 0,
      cubicInterpolationMode: 'default',
      fill: true
    }]
  };
  return <Line data={data} options={{
    ...baseOptions,
    animation: withMotion({ duration: 1050, easing: 'easeOutCubic', delay: 300 }),
    animations: drawLineProgressively(labels.length, 300),
    plugins: { ...baseOptions.plugins, legend: { display: false } }
  }} />;
}

export function CategoryRevenueChart({ items = [] }) {
  const sliceColors = items.map((_, index) => categoryRevenueColors[index % categoryRevenueColors.length]);
  const data = {
    labels: items.map((item) => item.name),
    datasets: [{
      label: 'Doanh thu',
      data: items.map((item) => item.netRevenue),
      centerLabel: '100%',
      backgroundColor: sliceColors,
      hoverBackgroundColor: sliceColors,
      borderColor: '#ffffff',
      hoverBorderColor: '#ffffff',
      borderWidth: 4,
      hoverBorderWidth: 4,
      hoverOffset: 0
    }]
  };
  return (
    <div className="grid h-full grid-cols-[minmax(0,1.08fr)_minmax(145px,0.72fr)] items-center gap-2">
      <div className="h-full min-h-0 min-w-0">
        <AnimatedDoughnut data={data} options={{
          responsive: true,
          maintainAspectRatio: false,
          animation: withMotion({
            duration: 1100,
            easing: 'easeOutQuart',
            delay: (context) => context.type === 'data' ? 80 + context.dataIndex * 70 : 80,
            animateRotate: true,
            animateScale: false
          }),
          cutout: '64%',
          radius: '88%',
          layout: { padding: 4 },
          plugins: {
            legend: { display: false },
            tooltip: { ...tooltipStyle, callbacks: { label: (context) => {
              const item = items[context.dataIndex];
              return `${context.label}: ${formatCurrency(item.netRevenue)} (${item.percentage}%)`;
            } } }
          }
        }} />
      </div>
      <ul className="min-w-0 space-y-2 pr-1 text-xs">
        {items.map((item, index) => (
          <li key={`${item.name}-${index}`} className="flex min-w-0 items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: sliceColors[index] }} />
            <span className="min-w-0 flex-1 truncate font-semibold text-slate-600" title={item.name}>{item.name}</span>
            <span className="shrink-0 font-extrabold text-slate-800">{Number(item.percentage || 0).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TopProductsChart({ items = [] }) {
  const palette = ['#8255e8', '#16b8cf', '#e94d85', '#14a88f', '#eea11d'];
  const shortenedLabels = items.map((item) => {
    const name = String(item.name || 'Chưa có tên');
    return name.length > 24 ? `${name.slice(0, 24)}…` : name;
  });
  const data = {
    labels: shortenedLabels,
    datasets: [{
      label: 'Doanh thu thuần',
      data: items.map((item) => item.netRevenue),
      backgroundColor: items.map((_, index) => palette[index % palette.length]),
      borderRadius: 0,
      borderSkipped: false,
      maxBarThickness: 28
    }]
  };
  return <Bar data={data} options={{
    ...baseOptions,
    animation: withMotion({ duration: 950, easing: 'easeOutQuart', delay: 440 }),
    animations: growFromZero('x', 440, 110),
    indexAxis: 'y',
    interaction: { mode: 'nearest', axis: 'y', intersect: false },
    plugins: {
      ...baseOptions.plugins,
      legend: { display: false },
      tooltip: { ...tooltipStyle, callbacks: {
        title: (contexts) => items[contexts[0]?.dataIndex]?.name || '',
        label: (context) => `Doanh thu: ${formatCurrency(context.raw)}`
      } }
    },
    scales: {
      x: { beginAtZero: true, border: { display: false }, grid: gridStyle, ticks: { ...axisTicks, callback: moneyAxis } },
      y: { border: { display: false }, grid: { display: false }, ticks: { ...axisTicks, autoSkip: false } }
    }
  }} />;
}

export function TrendChart({ trend }) {
  const actual = trend?.points || [];
  const forecast = trend?.forecast?.points || [];
  const labels = [...actual.map((item) => item.label), ...forecast.map((item) => item.date)];
  const data = {
    labels,
    datasets: [
      {
        type: 'bar', label: 'Doanh thu thuần', backgroundColor: '#8bd5df', borderColor: '#138496',
        borderWidth: 1, data: [...actual.map((item) => item.netRevenue), ...forecast.map(() => null)]
      },
      {
        type: 'line', label: 'Lợi nhuận gộp', borderColor: '#16803a', backgroundColor: '#16803a',
        pointRadius: 2, tension: 0.25, data: [...actual.map((item) => item.grossProfit), ...forecast.map(() => null)]
      },
      {
        type: 'line', label: 'AI dự báo', borderColor: '#d97706', backgroundColor: '#d97706',
        borderDash: [6, 4], pointRadius: 2, tension: 0.25,
        data: [...actual.map(() => null), ...forecast.map((item) => item.value)]
      }
    ]
  };
  return <Bar data={data} options={baseOptions} />;
}

export function CategoryChart({ items = [] }) {
  const data = {
    labels: items.map((item) => `${item.name} (${item.percentage}%)`),
    datasets: [
      { label: 'Doanh thu', data: items.map((item) => item.netRevenue), backgroundColor: '#52b8c7', xAxisID: 'x' },
      { label: 'Số lượng', data: items.map((item) => item.soldQuantity), backgroundColor: SYSTEM_BLUE, xAxisID: 'quantity' }
    ]
  };
  const options = {
    ...baseOptions,
    indexAxis: 'y',
    plugins: {
      ...baseOptions.plugins,
      tooltip: { callbacks: { label: (context) => context.dataset.xAxisID === 'quantity'
        ? `${context.dataset.label}: ${Number(context.raw).toLocaleString('vi-VN')}`
        : `${context.dataset.label}: ${formatCurrency(context.raw)}` } }
    },
    scales: {
      y: { grid: { display: false } },
      x: { beginAtZero: true, position: 'bottom', ticks: { callback: moneyAxis }, grid: { color: '#e5e7eb' } },
      quantity: { beginAtZero: true, position: 'top', grid: { display: false }, ticks: { precision: 0 } }
    }
  };
  return <Bar data={data} options={options} />;
}

export function PaymentChart({ items = [], labels = {} }) {
  const paymentColors = colors.slice(0, items.length);
  const data = {
    labels: items.map((item) => labels[item.paymentMethod] || item.paymentMethod),
    datasets: [{
      data: items.map((item) => item.transactionCount), centerLabel: '100%', backgroundColor: paymentColors, hoverBackgroundColor: paymentColors,
      borderColor: '#fff', hoverBorderColor: '#fff', borderWidth: 4, hoverBorderWidth: 4, hoverOffset: 0, outsideLabels: true
    }]
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: withMotion({
      duration: 1200,
      easing: 'easeOutExpo',
      delay: (context) => context.type === 'data' ? 560 + context.dataIndex * 130 : 560,
      animateRotate: true,
      animateScale: false
    }),
    cutout: '64%', radius: '76%', layout: { padding: { top: 20, right: 34, bottom: 20, left: 34 } },
    plugins: {
      legend: { display: false },
      tooltip: { ...tooltipStyle, callbacks: { label: (context) => {
        const item = items[context.dataIndex];
        return `${context.label}: ${item.transactionCount.toLocaleString('vi-VN')} giao dịch · ${formatCurrency(item.amount)} (${item.percentage}%)`;
      } } }
    }
  };
  return <AnimatedDoughnut data={data} options={options} />;
}

export function HourlyChart({ items = [], peakHour }) {
  const data = {
    labels: items.map((item) => `${String(item.hour).padStart(2, '0')}:00`),
    datasets: [{
      label: 'Doanh thu thuần', data: items.map((item) => item.netRevenue),
      backgroundColor: items.map((item) => item.hour === peakHour ? SYSTEM_BLUE : '#16b8cf'),
      hoverBackgroundColor: '#16b8cf',
      borderRadius: 6,
      borderSkipped: false,
      maxBarThickness: 36
    }]
  };
  return <Bar data={data} options={{ ...baseOptions, plugins: { ...baseOptions.plugins, legend: { display: false } } }} />;
}

export function AiReportChart({ spec, revealIndex = 0 }) {
  const isNumber = spec.valueFormat === 'number';
  const isHorizontalBar = spec.type === 'bar' && (spec.orientation === 'horizontal' || (spec.labels || []).length > 6);
  const isBusinessTrend = spec.id === 'ai_business_trend';
  const isTopProducts = spec.id === 'ai_top_products';
  const entranceDelay = 180 + revealIndex * 160;
  const revealAnimation = {
    duration: 1050,
    easing: 'easeOutQuart',
    delay: (context) => context.type === 'data'
      ? entranceDelay + context.datasetIndex * 100 + context.dataIndex * 55
      : entranceDelay
  };
  const palette = ['#138496', '#16803a', '#d97706', '#64748b', '#7c3aed'];
  const chartLabels = isBusinessTrend
    ? (spec.labels || []).map((label) => compactDateLabel(label))
    : spec.labels || [];
  const data = {
    labels: chartLabels,
    datasets: (spec.datasets || []).map((dataset, index) => {
      const values = isBusinessTrend
        ? (dataset.data || []).map((value) => Math.max(0, Number(value) || 0))
        : dataset.data;
      const itemColors = isTopProducts
        ? (values || []).map((_, itemIndex) => topProductColors[itemIndex % topProductColors.length])
        : null;
      return {
        label: dataset.label,
        data: values,
        borderColor: itemColors || dataset.color || palette[index % palette.length],
        backgroundColor: spec.type === 'line'
          ? `${dataset.color || palette[index % palette.length]}22`
          : itemColors || dataset.color || palette[index % palette.length],
        hoverBackgroundColor: itemColors || undefined,
        borderDash: dataset.dashed ? [6, 4] : undefined,
        borderWidth: isTopProducts ? 0 : 2,
        pointRadius: spec.type === 'line' ? 3 : undefined,
        pointHoverRadius: spec.type === 'line' ? 5 : undefined,
        pointStyle: spec.type === 'line' ? 'rect' : undefined,
        pointBorderWidth: spec.type === 'line' ? 0 : undefined,
        tension: 0,
        cubicInterpolationMode: 'default',
        fill: false
      };
    })
  };
  const tooltipLabel = (context) => `${context.dataset.label}: ${isNumber
    ? Number(context.raw || 0).toLocaleString('vi-VN')
    : formatCurrency(context.raw)}`;
  if (spec.type === 'doughnut') {
    const isCategoryRevenue = spec.id === 'category_revenue';
    const hasCategoryCenter = isCategoryRevenue || spec.id === 'ai_category_mix';
    const doughnutData = {
      ...data,
      datasets: data.datasets.map((dataset) => ({
        ...dataset,
        centerLabel: hasCategoryCenter ? '100%' : dataset.centerLabel,
        backgroundColor: (spec.labels || []).map((_, index) => (
          hasCategoryCenter
            ? categoryRevenueColors[index % categoryRevenueColors.length]
            : palette[index % palette.length]
        )),
        hoverBackgroundColor: (spec.labels || []).map((_, index) => (
          hasCategoryCenter
            ? categoryRevenueColors[index % categoryRevenueColors.length]
            : palette[index % palette.length]
        )),
        borderColor: '#fff',
        hoverBorderColor: '#fff',
        borderWidth: isCategoryRevenue ? 5 : 2,
        hoverBorderWidth: isCategoryRevenue ? 5 : 2,
        hoverOffset: 0,
        outsideLabels: isCategoryRevenue
      }))
    };
    return <AnimatedDoughnut data={doughnutData} options={{
      responsive: true,
      maintainAspectRatio: false,
      animation: revealAnimation && {
        duration: 1250,
        easing: 'easeOutQuart',
        delay: (context) => context.type === 'data'
          ? entranceDelay + context.dataIndex * 85
          : entranceDelay,
        animateRotate: true,
        animateScale: false
      },
      cutout: isCategoryRevenue ? '58%' : '60%',
      radius: isCategoryRevenue ? '72%' : '90%',
      layout: isCategoryRevenue ? { padding: { top: 22, right: 24, bottom: 22, left: 24 } } : undefined,
      plugins: {
        outsideLabels: { enabled: isCategoryRevenue },
        legend: isCategoryRevenue ? { display: false } : { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } },
        tooltip: { callbacks: { label: (context) => {
          const total = context.dataset.data.reduce((sum, value) => sum + Number(value || 0), 0);
          const percentage = total > 0 ? Math.round(Number(context.raw || 0) / total * 100) : 0;
          return `${context.label}: ${formatCurrency(context.raw)} (${percentage}%)`;
        } } }
      }
    }} />;
  }
  const pointCount = Math.max(1, chartLabels.length);
  const pointDelay = Math.max(38, Math.min(95, Math.round(1250 / pointCount)));
  const previousPointY = (context) => {
    if (context.index === 0) return context.chart.scales.y.getPixelForValue(0);
    const previousPoint = context.chart.getDatasetMeta(context.datasetIndex).data[context.index - 1];
    return previousPoint?.getProps(['y'], true).y ?? context.chart.scales.y.getPixelForValue(0);
  };
  const progressiveLineAnimations = {
    x: {
      type: 'number',
      easing: 'linear',
      duration: pointDelay,
      from: Number.NaN,
      delay: (context) => entranceDelay + context.datasetIndex * 100 + context.index * pointDelay
    },
    y: {
      type: 'number',
      easing: 'easeOutCubic',
      duration: pointDelay * 1.8,
      from: previousPointY,
      delay: (context) => entranceDelay + context.datasetIndex * 100 + context.index * pointDelay
    }
  };
  const growingBarAnimations = isHorizontalBar ? {
    x: {
      type: 'number',
      duration: 900,
      easing: 'easeOutQuart',
      from: (context) => context.chart.scales.x.getPixelForValue(0),
      delay: (context) => entranceDelay + context.datasetIndex * 100 + context.index * 110
    }
  } : {
    y: {
      type: 'number',
      duration: 900,
      easing: 'easeOutQuart',
      from: (context) => context.chart.scales.y.getPixelForValue(0),
      delay: (context) => entranceDelay + context.datasetIndex * 100 + context.index * 110
    }
  };
  const options = {
    ...baseOptions,
    animation: revealAnimation,
    animations: spec.type === 'line' ? progressiveLineAnimations : growingBarAnimations,
    indexAxis: isHorizontalBar ? 'y' : 'x',
    layout: isTopProducts
      ? { padding: { top: 8, right: 8, bottom: 8, left: 0 } }
      : baseOptions.layout,
    interaction: isTopProducts
      ? { mode: 'nearest', axis: 'y', intersect: true }
      : baseOptions.interaction,
    plugins: {
      ...baseOptions.plugins,
      legend: isTopProducts ? { display: false } : baseOptions.plugins.legend,
      tooltip: {
        ...tooltipStyle,
        callbacks: {
          title: isTopProducts ? (contexts) => contexts[0]?.label || '' : undefined,
          label: tooltipLabel
        }
      }
    },
    scales: isHorizontalBar ? {
      x: { beginAtZero: true, grid: { color: '#e5e7eb' }, ticks: { callback: isNumber ? undefined : moneyAxis } },
      y: { grid: { display: false }, ticks: { autoSkip: false } }
    } : {
      x: {
        grid: { display: false },
        ticks: isBusinessTrend
          ? { autoSkip: false, minRotation: 45, maxRotation: 45, font: { size: 10 } }
          : { autoSkip: true, maxTicksLimit: 12 }
      },
      y: {
        beginAtZero: true,
        min: isBusinessTrend ? 0 : undefined,
        grid: { color: '#e5e7eb' },
        ticks: { callback: isNumber ? undefined : moneyAxis }
      }
    }
  };
  return spec.type === 'line' ? <Line data={data} options={options} /> : <Bar data={data} options={options} />;
}
