import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  MoreVertical,
  PackageCheck,
  ReceiptText,
  Users,
  WalletCards
} from 'lucide-react';
import api from '../api/axios';
import { formatCurrency, formatDate, formatTime } from '../utils/format';

const chartColors = ['#74B8E0', '#BFE3F5', '#3F90BD', '#DFF2FB', '#9FD4EE'];

const categoryPeriodOptions = [
  { value: 'today', label: 'Hôm nay' },
  { value: 'week', label: '7 ngày' },
  { value: 'month', label: 'Tháng này' },
  { value: 'year', label: 'Năm nay' },
  { value: 'all', label: 'Tất cả' }
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

function formatDeltaCount(value, noun) {
  return `${Math.abs(Number(value || 0)).toLocaleString('vi-VN')} ${noun}`;
}

function getRevenueCaption(todayRevenue, revenueGrowth) {
  if (Number(todayRevenue || 0) <= 0) {
    return 'Chưa có đơn hàng hôm nay';
  }

  return `${formatPercent(revenueGrowth)} so với hôm qua`;
}

function getOrderCaption(todayOrders, orderGrowth) {
  const growth = Number(orderGrowth || 0);

  if (Number(todayOrders || 0) <= 0) {
    return 'Chưa có đơn hàng mới hôm nay';
  }

  if (growth > 0) {
    return `+${formatDeltaCount(growth, 'đơn')} so với hôm qua`;
  }

  if (growth < 0) {
    return `Giảm ${formatDeltaCount(growth, 'đơn')} so với hôm qua`;
  }

  return 'Bằng hôm qua';
}

function getCustomerCaption(newCustomers, customerGrowth) {
  const growth = Number(customerGrowth || 0);

  if (Number(newCustomers || 0) <= 0) {
    return 'Chưa có khách mới hôm nay';
  }

  if (growth > 0) {
    return `+${formatDeltaCount(growth, 'khách')} so với hôm qua`;
  }

  if (growth < 0) {
    return `Giảm ${formatDeltaCount(growth, 'khách')} so với hôm qua`;
  }

  return 'Bằng hôm qua';
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
    monthRevenue: 0,
    todayOrders: 0,
    lowStockCount: 0,
    newCustomers: 0,
    revenueGrowth: 0,
    orderGrowth: 0,
    customerGrowth: 0
  });
  const [categoryShare, setCategoryShare] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [categoryPeriod, setCategoryPeriod] = useState('month');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const [summaryRes, categoryRes, topRes, recentRes] = await Promise.all([
          api.get('/dashboard/summary'),
          api.get('/dashboard/category-share', { params: { period: categoryPeriod } }),
          api.get('/dashboard/top-products'),
          api.get('/dashboard/recent-orders')
        ]);

        setSummary(summaryRes.data);
        setCategoryShare(categoryRes.data);
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
  }, []);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    api
      .get('/dashboard/category-share', { params: { period: categoryPeriod } })
      .then((response) => {
        setCategoryShare(response.data);
        setError('');
      })
      .catch((requestError) => {
        setError(requestError.response?.data?.message || 'KhÃ´ng thá»ƒ táº£i dá»¯ liá»‡u dashboard');
      });
  }, [categoryPeriod, isLoading]);

  const donutBackground = useMemo(() => {
    if (categoryShare.length === 0) {
      return '#f3f4f5';
    }

    let cursor = 0;
    const segments = categoryShare.map((item, index) => {
      const start = cursor;
      const end = Math.min(cursor + Number(item.percentage || 0), 100);
      cursor = end;
      return `${chartColors[index % chartColors.length]} ${start}% ${end}%`;
    });

    if (cursor < 100) {
      segments.push(`#f3f4f5 ${cursor}% 100%`);
    }

    return `conic-gradient(${segments.join(', ')})`;
  }, [categoryShare]);

  const categoryRevenueTotal = useMemo(() => {
    return categoryShare.reduce((sum, item) => sum + Number(item.revenue || 0), 0);
  }, [categoryShare]);

  const revenueSparkline = {
    hasData: false,
    total: 0,
    bars: []
  };

  const categoryPeriodLabel = useMemo(() => {
    return categoryPeriodOptions.find((option) => option.value === categoryPeriod)?.label || 'Tháng này';
  }, [categoryPeriod]);

  const cards = [
    {
      label: 'Doanh thu hôm nay',
      value: formatCurrency(summary.todayRevenue),
      caption: `${formatPercent(summary.revenueGrowth)} so với hôm qua`,
      icon: WalletCards,
      tone: 'blue'
    },
    {
      label: 'Đơn hàng mới',
      value: summary.todayOrders.toLocaleString('vi-VN'),
      caption: `${formatPercent(summary.orderGrowth)} so với hôm qua`,
      icon: ReceiptText,
      tone: 'gray'
    },
    {
      label: 'Sắp hết hàng',
      value: summary.lowStockCount.toLocaleString('vi-VN'),
      caption: summary.lowStockCount > 0 ? 'Cần nhập thêm' : 'Kho đang ổn định',
      icon: PackageCheck,
      tone: 'amber'
    },
    {
      label: 'Khách hàng mới',
      value: summary.newCustomers.toLocaleString('vi-VN'),
      caption: `${formatPercent(summary.customerGrowth)} so với hôm qua`,
      icon: Users,
      tone: 'slate'
    }
  ];

  const dashboardCards = cards.map((card, index) => {
    if (index === 0) {
      return {
        ...card,
        caption: getRevenueCaption(summary.todayRevenue, summary.revenueGrowth)
      };
    }

    if (index === 1) {
      return {
        ...card,
        caption: getOrderCaption(summary.todayOrders, summary.orderGrowth)
      };
    }

    if (index === 2) {
      return {
        ...card,
        to: '/products?lowStock=1'
      };
    }

    if (index === 3) {
      return {
        ...card,
        caption: getCustomerCaption(summary.newCustomers, summary.customerGrowth)
      };
    }

    return card;
  });

  return (
    <div className="space-y-6">

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {dashboardCards.map((card) => {
          const Icon = card.icon;
          const CardWrapper = card.to ? Link : 'article';

          return (
            <CardWrapper
              key={card.label}
              to={card.to}
              className={`rounded-lg border border-[#e1e3e4] bg-white p-4 shadow-[0_1px_3px_rgba(25,28,29,0.08)] ${
                card.to ? 'block transition hover:border-[#c8dff0] hover:shadow-[0_8px_24px_rgba(116,184,224,0.18)]' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[#73777d]">{card.label}</p>
                  <p className="mt-3 text-xl font-bold leading-6 text-[#191c1d]">
                    {isLoading ? '...' : card.value}
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-[#43474d]">{card.caption}</p>
                </div>
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${cardTones[card.tone]}`}>
                  <Icon size={18} />
                </div>
              </div>
            </CardWrapper>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
        <article className="rounded-lg border border-[#e1e3e4] bg-white p-4 shadow-[0_1px_3px_rgba(25,28,29,0.08)]">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold leading-6 text-[#191c1d]">Cơ cấu doanh thu</h2>
              <p className="mt-0.5 text-xs font-medium text-[#73777d]">Phân bổ theo nhóm sản phẩm</p>
            </div>
            <label className="relative">
              <span className="sr-only">Lọc thời gian cơ cấu doanh thu</span>
              <select
                value={categoryPeriod}
                onChange={(event) => setCategoryPeriod(event.target.value)}
                className="h-9 appearance-none rounded-lg bg-brand-surface pl-3 pr-8 text-base font-semibold text-brand-ink outline-none transition hover:bg-brand-soft focus:ring-2 focus:ring-brand-soft"
              >
                {categoryPeriodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-brand-ink" size={16} />
            </label>
            <button
              type="button"
              className="hidden h-8 items-center gap-2 rounded-lg bg-brand-surface px-3 text-xs font-semibold text-brand-ink transition hover:bg-brand-soft"
            >
              Tháng này
              <ChevronDown size={16} />
            </button>
          </div>

          <div className="grid min-h-[230px] items-center gap-8 md:grid-cols-[minmax(240px,0.95fr)_minmax(260px,0.72fr)]">
            <div className="flex justify-center">
              <div
                className="relative grid h-48 w-48 place-items-center rounded-full"
                data-preserve-radius="circle"
                style={{ background: donutBackground }}
                aria-label="Cơ cấu doanh thu theo danh mục"
              >
                <div className="grid h-28 w-28 place-items-center rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(225,227,228,0.8)]" data-preserve-radius="circle">
                  <div className="text-center [&>div:last-child]:hidden">
                    <div className="px-2 text-[13px] font-bold leading-tight text-[#191c1d]">
                      {categoryRevenueTotal > 0 ? formatCurrency(categoryRevenueTotal) : '0 đ'}
                    </div>
                    <div className="mt-1 text-xs font-medium text-[#73777d]">{categoryPeriodLabel}</div>
                    <div className="mt-1 text-xs font-medium text-[#73777d]">Tổng cộng</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="hidden mx-auto w-full max-w-[170px]">
              <div className="mb-2 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase text-[#73777d]">Xu hướng</p>
                  <p className="mt-0.5 text-xs font-bold text-[#191c1d]">
                    {revenueSparkline.hasData ? formatCurrency(revenueSparkline.total) : '0 đ'}
                  </p>
                </div>
              </div>
              <svg
                viewBox="0 0 132 46"
                className="h-[46px] w-full overflow-visible"
                role="img"
                aria-label="Biểu đồ nhỏ doanh thu theo danh mục"
              >
                <line x1="5" y1="41" x2="127" y2="41" stroke="#e1e3e4" strokeWidth="1" />
                {revenueSparkline.hasData ? (
                  <>
                    {revenueSparkline.bars.map((bar, index) => {
                      const barWidth = 12;
                      const gap = revenueSparkline.bars.length > 1 ? (122 - barWidth * revenueSparkline.bars.length) / (revenueSparkline.bars.length - 1) : 0;
                      const x = 5 + index * (barWidth + Math.max(gap, 6));
                      const y = 41 - bar.height;

                      return <rect key={`${bar.value}-${index}`} x={x} y={y} width={barWidth} height={bar.height} rx="4" fill={bar.color} />;
                    })}
                  </>
                ) : (
                  [0, 1, 2, 3].map((item) => (
                    <rect key={item} x={10 + item * 28} y="30" width="12" height="11" rx="4" fill="#dfe3e6" />
                  ))
                )}
              </svg>
            </div>

            <div className="ml-auto w-full max-w-[320px] space-y-1.5">
              {categoryShare.length === 0 && (
                <p className="text-sm font-medium text-[#73777d]">Chưa có doanh thu trong tháng này.</p>
              )}
              {categoryShare.map((item, index) => (
                <div key={item.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-0.5 py-1">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: chartColors[index % chartColors.length] }}
                    />
                    <span className="truncate text-sm font-semibold text-[#43474d]">{item.name}</span>
                  </div>
                  <div className="shrink-0 text-right leading-tight">
                    <div className="text-sm font-bold text-[#191c1d]">{item.percentage}%</div>
                    <div className="mt-0.5 text-xs font-medium text-[#73777d]">{formatCurrency(item.revenue)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="rounded-lg border border-[#e1e3e4] bg-white p-4 shadow-[0_1px_3px_rgba(25,28,29,0.08)]">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold leading-6 text-[#191c1d]">Top sản phẩm</h2>
            <Link to="/products" className="text-sm font-semibold text-brand-strong transition hover:text-brand-deep">
              Tất cả
            </Link>
          </div>

          <div className="space-y-3">
            {topProducts.length === 0 && (
              <p className="text-sm font-medium text-[#73777d]">Chưa có sản phẩm bán chạy trong 30 ngày gần đây.</p>
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
