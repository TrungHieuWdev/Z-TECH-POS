import { NavLink } from 'react-router-dom';
import {
  BadgeCheck,
  Boxes,
  BrainCircuit,
  CalendarClock,
  ChartNoAxesCombined,
  LayoutDashboard,
  LogOut,
  Package,
  ReceiptText,
  ShoppingCart,
  Tags,
  Truck,
  Users
} from 'lucide-react';
import ztechLogo from '../assets/images/1111.png';
import { logout } from '../utils/auth';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/pos', label: 'Bán hàng (POS)', icon: ShoppingCart },
  { to: '/products', label: 'Sản phẩm', icon: Package },
  { to: '/categories', label: 'Danh mục', icon: Tags },
  { to: '/orders', label: 'Hóa đơn', icon: ReceiptText },
  { to: '/inventory', label: 'Kho hàng', icon: Boxes },
  { to: '/customers', label: 'Khách hàng', icon: Users },
  { label: 'Nhà cung cấp', icon: Truck },
  { label: 'Nhân viên', icon: BadgeCheck },
  { label: 'Ca làm', icon: CalendarClock },
  { label: 'Báo cáo', icon: ChartNoAxesCombined },
  { label: 'AI gợi ý', icon: BrainCircuit }
];

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-50 hidden h-screen w-[260px] flex-col border-r border-[#c3c7cd] bg-white py-4 lg:flex">
      <div className="mb-6 px-6">
        <div className="flex h-14 items-center gap-3">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-brand-surface">
            <img
              src={ztechLogo}
              alt="Z-TECH POS logo"
              className="max-w-none -translate-x-[48px] -translate-y-[16px] object-contain"
              style={{ width: 146 }}
            />
          </div>
          <div className="flex min-w-0 flex-col justify-center">
            <div className="whitespace-nowrap text-[22px] font-extrabold leading-7 text-brand">Z-TECH POS</div>
            <div className="text-xs font-medium leading-4 text-[#73777d]">Hệ thống quản lý</div>
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2">
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;

            if (!item.to) {
              return (
                <button
                  key={item.label}
                  type="button"
                  className="mx-2 flex min-h-10 w-[calc(100%-1rem)] items-center gap-3 rounded-full px-4 py-2 text-left text-[15px] font-semibold text-[#191c1d] outline-none transition-[background-color,color,box-shadow] duration-200 ease-out hover:bg-brand-surface hover:text-brand-ink focus-visible:ring-2 focus-visible:ring-brand-soft"
                >
                  <Icon size={21} strokeWidth={2} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `mx-2 flex min-h-10 items-center gap-3 rounded-full px-4 py-2 text-[15px] font-semibold outline-none transition-[background-color,color,box-shadow] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-brand-soft ${
                    isActive
                      ? 'bg-[#74B8E0] text-white'
                      : 'text-[#191c1d] hover:bg-brand-surface hover:text-brand-ink'
                  }`
                }
              >
                <Icon size={21} strokeWidth={2} />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      <div className="px-2 pt-3">
        <button
          type="button"
          onClick={logout}
          className="mx-2 flex min-h-10 w-[calc(100%-1rem)] items-center justify-center gap-3 rounded-full bg-brand-soft px-4 py-2 text-[15px] font-semibold text-brand-ink outline-none transition-[background-color,color,box-shadow] duration-200 ease-out hover:bg-red-600 hover:text-white active:bg-red-700 active:text-white focus-visible:ring-2 focus-visible:ring-red-200"
        >
          <LogOut size={20} />
          <span>Đăng xuất</span>
        </button>
      </div>
    </aside>
  );
}
