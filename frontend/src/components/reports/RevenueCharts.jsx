import {
  BarElement, CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale,
  LineElement, PointElement, Title, Tooltip, ArcElement
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { formatCurrency } from '../../utils/format';

const colors = ['#138496', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#64748b'];
const categoryRevenueColors = ['#7C3AED', '#DB2777', '#0891B2', '#475569', '#A855F7', '#0E7490'];

const categoryOutsideLabels = {
  id: 'categoryOutsideLabels',
  afterDraw(chart) {
    const dataset = chart.data.datasets[0];
    if (!dataset?.categoryRevenue) return;
    const values = dataset.data.map(Number);
    const total = values.reduce((sum, value) => sum + value, 0);
    if (!total) return;
    const meta = chart.getDatasetMeta(0);
    const { ctx } = chart;
    ctx.save();
    ctx.font = `700 ${chart.width < 520 ? 11 : 13}px Arial, sans-serif`;
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
      const textX = direction > 0 ? chart.width - 12 : 12;
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

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Title, Filler, categoryOutsideLabels);
const moneyAxis = (value) => {
  const number = Number(value || 0);
  if (Math.abs(number) >= 1000000000) return `${(number / 1000000000).toFixed(1)} tỷ`;
  if (Math.abs(number) >= 1000000) return `${(number / 1000000).toFixed(1)} tr`;
  if (Math.abs(number) >= 1000) return `${Math.round(number / 1000)}k`;
  return String(number);
};

const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 250 },
  plugins: {
    legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, padding: 16 } },
    tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${formatCurrency(context.parsed.y ?? context.parsed)}` } }
  },
  scales: {
    x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
    y: { beginAtZero: true, grid: { color: '#e5e7eb' }, ticks: { callback: moneyAxis } }
  }
};

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
      { label: 'Số lượng', data: items.map((item) => item.soldQuantity), backgroundColor: '#a7c7e7', xAxisID: 'quantity' }
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
  const data = {
    labels: items.map((item) => labels[item.paymentMethod] || item.paymentMethod),
    datasets: [{
      data: items.map((item) => item.amount), backgroundColor: colors.slice(0, items.length),
      borderColor: '#fff', borderWidth: 2
    }]
  };
  const options = {
    responsive: true, maintainAspectRatio: false, cutout: '62%',
    plugins: {
      legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } },
      tooltip: { callbacks: { label: (context) => {
        const item = items[context.dataIndex];
        return `${context.label}: ${formatCurrency(item.amount)} (${item.percentage}%)`;
      } } }
    }
  };
  return <Doughnut data={data} options={options} />;
}

export function HourlyChart({ items = [], peakHour }) {
  const data = {
    labels: items.map((item) => `${String(item.hour).padStart(2, '0')}:00`),
    datasets: [{
      label: 'Doanh thu thuần', data: items.map((item) => item.netRevenue),
      backgroundColor: items.map((item) => item.hour === peakHour ? '#0f766e' : '#8bd5df')
    }]
  };
  return <Bar data={data} options={{ ...baseOptions, plugins: { ...baseOptions.plugins, legend: { display: false } } }} />;
}

export function AiReportChart({ spec }) {
  const isNumber = spec.valueFormat === 'number';
  const palette = ['#138496', '#16803a', '#d97706', '#64748b', '#7c3aed'];
  const data = {
    labels: spec.labels || [],
    datasets: (spec.datasets || []).map((dataset, index) => ({
      label: dataset.label,
      data: dataset.data,
      borderColor: dataset.color || palette[index % palette.length],
      backgroundColor: spec.type === 'line' ? `${dataset.color || palette[index % palette.length]}22` : dataset.color || palette[index % palette.length],
      borderDash: dataset.dashed ? [6, 4] : undefined,
      borderWidth: 2,
      pointRadius: spec.type === 'line' ? 2 : undefined,
      tension: 0.25,
      fill: false
    }))
  };
  const tooltipLabel = (context) => `${context.dataset.label}: ${isNumber
    ? Number(context.raw || 0).toLocaleString('vi-VN')
    : formatCurrency(context.raw)}`;
  if (spec.type === 'doughnut') {
    const isCategoryRevenue = spec.id === 'category_revenue';
    const doughnutData = {
      ...data,
      datasets: data.datasets.map((dataset) => ({
        ...dataset,
        backgroundColor: (spec.labels || []).map((_, index) => (
          isCategoryRevenue
            ? categoryRevenueColors[index % categoryRevenueColors.length]
            : palette[index % palette.length]
        )),
        borderColor: '#fff',
        borderWidth: isCategoryRevenue ? 5 : 2,
        hoverOffset: 5,
        categoryRevenue: isCategoryRevenue
      }))
    };
    return <Doughnut data={doughnutData} options={{
      responsive: true,
      maintainAspectRatio: false,
      cutout: isCategoryRevenue ? '58%' : '60%',
      radius: isCategoryRevenue ? '72%' : '90%',
      layout: isCategoryRevenue ? { padding: { top: 22, right: 24, bottom: 22, left: 24 } } : undefined,
      plugins: {
        categoryOutsideLabels: { enabled: isCategoryRevenue },
        legend: isCategoryRevenue ? { display: false } : { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } },
        tooltip: { callbacks: { label: (context) => {
          const total = context.dataset.data.reduce((sum, value) => sum + Number(value || 0), 0);
          const percentage = total > 0 ? Math.round(Number(context.raw || 0) / total * 100) : 0;
          return `${context.label}: ${formatCurrency(context.raw)} (${percentage}%)`;
        } } }
      }
    }} />;
  }
  const options = {
    ...baseOptions,
    indexAxis: spec.type === 'bar' && (spec.labels || []).length > 6 ? 'y' : 'x',
    plugins: { ...baseOptions.plugins, tooltip: { callbacks: { label: tooltipLabel } } },
    scales: spec.type === 'bar' && (spec.labels || []).length > 6 ? {
      x: { beginAtZero: true, grid: { color: '#e5e7eb' }, ticks: { callback: isNumber ? undefined : moneyAxis } },
      y: { grid: { display: false }, ticks: { autoSkip: false } }
    } : {
      x: { grid: { display: false }, ticks: { autoSkip: true, maxTicksLimit: 12 } },
      y: { beginAtZero: true, grid: { color: '#e5e7eb' }, ticks: { callback: isNumber ? undefined : moneyAxis } }
    }
  };
  return spec.type === 'line' ? <Line data={data} options={options} /> : <Bar data={data} options={options} />;
}
