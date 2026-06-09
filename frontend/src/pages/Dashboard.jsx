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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const [summaryRes, categoryRes, topRes, recentRes] = await Promise.all([
          api.get('/dashboard/summary'),
          api.get('/dashboard/category-share'),
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

  return (
    <div className="w-full space-y-5">
      <div>
        <h1 className="text-2xl font-semibold leading-8 text-[#191c1d]">Trang tổng quan</h1>
        <p className="mt-1 text-sm font-medium text-[#73777d]">
          Chào mừng quay trở lại, đây là hiệu suất cửa hàng hôm nay!
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <article
              key={card.label}
              className="rounded-xl border border-[#e1e3e4] bg-white p-5 shadow-[0_1px_3px_rgba(25,28,29,0.08)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-[#73777d]">{card.label}</p>
                  <p className="mt-5 text-[22px] font-bold leading-7 text-[#191c1d]">
                    {isLoading ? '...' : card.value}
                  </p>
                  <p className="mt-2 text-xs font-medium text-[#43474d]">{card.caption}</p>
                </div>
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${cardTones[card.tone]}`}>
                  <Icon size={20} />
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
        <article className="rounded-xl border border-[#e1e3e4] bg-white p-5 shadow-[0_1px_3px_rgba(25,28,29,0.08)]">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold leading-7 text-[#191c1d]">Cơ cấu doanh thu</h2>
              <p className="mt-1 text-sm font-medium text-[#73777d]">Phân bổ theo nhóm sản phẩm</p>
            </div>
            <button
              type="button"
              className="flex h-9 items-center gap-2 rounded-lg bg-brand-surface px-3 text-sm font-semibold text-brand-ink transition hover:bg-brand-soft"
            >
              Tháng này
              <ChevronDown size={16} />
            </button>
          </div>

          <div className="grid min-h-[300px] items-center gap-8 md:grid-cols-[minmax(220px,0.9fr)_minmax(240px,1fr)]">
            <div className="flex justify-center">
              <div
                className="relative grid h-56 w-56 place-items-center rounded-full"
                style={{ background: donutBackground }}
                aria-label="Cơ cấu doanh thu theo danh mục"
              >
                <div className="grid h-32 w-32 place-items-center rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(225,227,228,0.8)]">
                  <div className="text-center">
                    <div className="text-2xl font-bold leading-7 text-[#191c1d]">
                      {categoryShare.length > 0 ? '100%' : '0%'}
                    </div>
                    <div className="mt-1 text-xs font-medium text-[#73777d]">Tổng cộng</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {categoryShare.length === 0 && (
                <p className="text-sm font-medium text-[#73777d]">Chưa có doanh thu trong tháng này.</p>
              )}
              {categoryShare.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: chartColors[index % chartColors.length] }}
                    />
                    <span className="truncate text-sm font-semibold text-[#43474d]">{item.name}</span>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-bold text-[#191c1d]">{item.percentage}%</div>
                    <div className="text-[11px] font-medium text-[#73777d]">{formatCurrency(item.revenue)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="rounded-xl border border-[#e1e3e4] bg-white p-5 shadow-[0_1px_3px_rgba(25,28,29,0.08)]">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold leading-7 text-[#191c1d]">Top sản phẩm</h2>
            <Link to="/products" className="text-sm font-semibold text-brand-strong transition hover:text-brand-deep">
              Tất cả
            </Link>
          </div>

          <div className="space-y-5">
            {topProducts.length === 0 && (
              <p className="text-sm font-medium text-[#73777d]">Chưa có sản phẩm bán chạy trong 30 ngày gần đây.</p>
            )}
            {topProducts.map((product) => (
              <div key={product.product_id} className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold leading-5 text-[#191c1d]">{product.name}</p>
                  <p className="mt-1 text-xs font-medium text-[#73777d]">
                    {product.category_name} - SL {Number(product.quantity || 0).toLocaleString('vi-VN')}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-[#191c1d]">{formatCurrency(product.revenue)}</p>
                  <p className="mt-1 text-xs font-medium text-[#73777d]">giá {formatCurrency(product.price)}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="rounded-xl border border-[#e1e3e4] bg-white shadow-[0_1px_3px_rgba(25,28,29,0.08)]">
        <div className="flex items-center justify-between gap-4 border-b border-[#e1e3e4] px-5 py-4">
          <h2 className="text-xl font-semibold leading-7 text-[#191c1d]">Đơn hàng gần đây</h2>
          <Link
            to="/orders"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-strong transition hover:bg-brand-surface"
          >
            Xem tất cả
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left">
            <thead className="text-[11px] font-bold uppercase tracking-wide text-[#73777d]">
              <tr>
                <th className="px-5 py-3 font-bold">Mã đơn</th>
                <th className="px-5 py-3 font-bold">Khách hàng</th>
                <th className="px-5 py-3 font-bold">Ngày tạo</th>
                <th className="px-5 py-3 font-bold text-right">Tổng tiền</th>
                <th className="px-5 py-3 font-bold text-center">Trạng thái</th>
                <th className="px-5 py-3 font-bold text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e1e3e4]">
              {recentOrders.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-5 py-10 text-center text-sm font-medium text-[#73777d]">
                    Chưa có đơn hàng gần đây.
                  </td>
                </tr>
              )}
              {recentOrders.map((order) => (
                <tr key={order.id} className="text-sm transition hover:bg-[#f8f9fa]">
                  <td className="px-5 py-4 align-middle font-bold text-[#191c1d]">{order.order_number}</td>
                  <td className="px-5 py-4 align-middle">
                    <div className="flex items-center gap-3">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-bold text-brand-ink">
                        {getInitials(order.customer_name)}
                      </div>
                      <span className="font-medium text-[#43474d]">{order.customer_name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 align-middle text-[#43474d]">
                    <span className="font-medium">{formatTime(order.created_at)}</span>
                    <span className="ml-1 text-xs text-[#73777d]">{formatDate(order.created_at)}</span>
                  </td>
                  <td className="px-5 py-4 align-middle text-right font-bold text-[#191c1d]">
                    {formatCurrency(order.total)}
                  </td>
                  <td className="px-5 py-4 align-middle text-center">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${
                        statusStyles[order.status] || statusStyles.cancelled
                      }`}
                    >
                      {statusLabels[order.status] || order.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 align-middle">
                    <button
                      type="button"
                      className="ml-auto grid h-8 w-8 place-items-center rounded-full text-[#73777d] transition hover:bg-brand-surface hover:text-brand-strong"
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
