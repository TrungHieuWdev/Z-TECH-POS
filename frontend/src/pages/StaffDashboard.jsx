import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Clock3,
  PackageSearch,
  ReceiptText,
  ShoppingCart,
  Users
} from 'lucide-react';

const quickActions = [
  {
    to: '/pos',
    label: 'Bán hàng',
    description: 'Tạo đơn hàng, chọn khách và thực hiện thanh toán tại quầy.',
    action: 'Mở màn hình bán hàng',
    icon: ShoppingCart,
    tone: 'bg-sky-50 text-sky-700'
  },
  {
    to: '/shifts',
    label: 'Ca làm của tôi',
    description: 'Xem lịch được phân công, giờ làm và số liệu đối soát ca.',
    action: 'Xem ca làm',
    icon: Clock3,
    tone: 'bg-emerald-50 text-emerald-700'
  },
  {
    to: '/orders',
    label: 'Hóa đơn của tôi',
    description: 'Tra cứu các hóa đơn do bạn phụ trách và in lại khi cần.',
    action: 'Xem hóa đơn',
    icon: ReceiptText,
    tone: 'bg-amber-50 text-amber-700'
  },
  {
    to: '/products',
    label: 'Tra cứu sản phẩm',
    description: 'Kiểm tra giá bán, tồn kho và thông tin sản phẩm.',
    action: 'Xem sản phẩm',
    icon: PackageSearch,
    tone: 'bg-violet-50 text-violet-700'
  },
  {
    to: '/customers',
    label: 'Khách hàng',
    description: 'Tìm kiếm, thêm mới hoặc cập nhật thông tin khách hàng.',
    action: 'Quản lý khách hàng',
    icon: Users,
    tone: 'bg-cyan-50 text-cyan-700'
  },
  {
    to: '/warranties',
    label: 'Bảo hành',
    description: 'Tra cứu chính sách và tiếp nhận yêu cầu bảo hành.',
    action: 'Mở bảo hành',
    icon: BadgeCheck,
    tone: 'bg-rose-50 text-rose-700'
  }
];

export default function StaffDashboard() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold text-gray-950">Thao tác nhanh</h1>
        <p className="mt-1 text-sm font-medium text-gray-500">
          Chọn chức năng bạn cần để bắt đầu công việc trong ca hôm nay.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {quickActions.map(({ to, label, description, action, icon: Icon, tone }) => (
          <Link
            key={to}
            to={to}
            className="group flex min-h-48 flex-col justify-between border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#74B8E0] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c0edf7]"
          >
            <div>
              <span className={`grid h-11 w-11 place-items-center ${tone}`}>
                <Icon size={22} strokeWidth={2} />
              </span>
              <h2 className="mt-4 text-lg font-extrabold text-gray-950">{label}</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-gray-500">{description}</p>
            </div>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#398fbd]">
              {action}
              <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
