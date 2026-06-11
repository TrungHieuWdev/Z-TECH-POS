import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  BadgeCheck,
  Boxes,
  BrainCircuit,
  CalendarClock,
  ChartNoAxesCombined,
  History,
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
  { to: '/suppliers', label: 'Nhà cung cấp', icon: Truck },
  { to: '/employees', label: 'Nhân viên', icon: BadgeCheck },
  { to: '/shifts', label: 'Ca làm', icon: CalendarClock },
  { to: '/reports', label: 'Báo cáo', icon: ChartNoAxesCombined },
  { to: '/activity-logs', label: 'Nhật ký', icon: History },
  { label: 'AI gợi ý', icon: BrainCircuit }
];

function isPathActive(pathname, to) {
  if (!to) return false;
  if (to === '/') return pathname === '/';
  return pathname === to || pathname.startsWith(`${to}/`);
}

function navItemClass(isActive) {
  return [
    'group relative mx-2 flex min-h-[42px] w-[calc(100%-1rem)] items-center gap-3 overflow-hidden rounded-lg px-4 py-1.5',
    'text-left text-[15px] font-semibold outline-none',
    'transition-[color,transform,box-shadow] duration-200 ease-out',
    'will-change-transform active:scale-[0.985] focus-visible:ring-2 focus-visible:ring-brand-soft',
    isActive ? 'text-white shadow-sm' : 'text-[#191c1d] hover:text-brand-ink'
  ].join(' ');
}

function NavItemContent({ icon: Icon, label, isActive }) {
  return (
    <>
      <span
        className={[
          'absolute inset-0 rounded-lg transition-[opacity,transform,background-color] duration-200 ease-out',
          isActive
            ? 'scale-100 bg-brand opacity-100'
            : 'scale-[0.98] bg-brand-surface opacity-0 group-hover:scale-100 group-hover:opacity-100'
        ].join(' ')}
      />
      <Icon
        size={21}
        strokeWidth={2.1}
        className="relative z-10 shrink-0 transition-transform duration-200 ease-out group-hover:scale-105"
      />
      <span className="relative z-10 truncate">{label}</span>
    </>
  );
}

export default function Sidebar() {
  const location = useLocation();
  const [pendingPath, setPendingPath] = useState('');

  useEffect(() => {
    setPendingPath('');
  }, [location.pathname]);

  return (
    <aside className="fixed left-0 top-0 z-50 hidden h-screen w-[260px] flex-col border-r border-[#c3c7cd] bg-white py-3 lg:flex">
      <div className="mb-4 px-6">
        <div className="flex h-12 items-center gap-3">
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-brand-surface">
            <img
              src={ztechLogo}
              alt="Z-TECH POS logo"
              className="max-w-none -translate-x-[48px] -translate-y-[16px] object-contain"
              style={{ width: 146 }}
            />
          </div>
          <div className="flex min-w-0 flex-col justify-center">
            <div className="whitespace-nowrap text-xl font-extrabold leading-6 text-brand">Z-TECH POS</div>
            <div className="text-xs font-medium leading-4 text-[#73777d]">HỆ THỐNG QUẢN LÝ</div>
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2">
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = pendingPath
              ? pendingPath === item.to
              : isPathActive(location.pathname, item.to);

            if (!item.to) {
              return (
                <button key={item.label} type="button" className={navItemClass(false)}>
                  <NavItemContent icon={item.icon} label={item.label} isActive={false} />
                </button>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onPointerDown={() => setPendingPath(item.to)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    setPendingPath(item.to);
                  }
                }}
                className={navItemClass(isActive)}
              >
                <NavItemContent icon={item.icon} label={item.label} isActive={isActive} />
              </NavLink>
            );
          })}
        </div>
      </nav>

      <div className="px-2 pt-2">
        <button
          type="button"
          onClick={logout}
          className="mx-2 flex min-h-[38px] w-[calc(100%-1rem)] items-center justify-center gap-3 rounded-lg bg-brand-soft px-4 py-1.5 text-[15px] font-semibold text-brand-ink outline-none transition-[background-color,color,box-shadow,transform] duration-200 ease-out hover:bg-red-600 hover:text-white active:scale-[0.985] active:bg-red-700 active:text-white focus-visible:ring-2 focus-visible:ring-red-200"
        >
          <LogOut size={20} />
          <span>Đăng xuất</span>
        </button>
      </div>
    </aside>
  );
}
