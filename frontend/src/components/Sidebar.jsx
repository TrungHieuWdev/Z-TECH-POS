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
import { getUser, isFullAccessRole, logout } from '../utils/auth';

const primaryItems = [
  { to: '/', label: 'Tổng quan', icon: LayoutDashboard },
  { to: '/pos', label: 'Bán hàng', icon: ShoppingCart },
  { to: '/products', label: 'Sản phẩm', icon: Package },
  { to: '/inventory', label: 'Kho hàng', icon: Boxes },
  { to: '/customers', label: 'Khách hàng', icon: Users },
  { to: '/orders', label: 'Hóa đơn', icon: ReceiptText },
  { to: '/reports', label: 'Báo cáo', icon: ChartNoAxesCombined }
];

const extraItems = [
  { to: '/categories', label: 'Danh mục', icon: Tags },
  { to: '/suppliers', label: 'Nhà cung cấp', icon: Truck },
  { to: '/employees', label: 'Nhân viên', icon: BadgeCheck },
  { to: '/shifts', label: 'Ca làm', icon: CalendarClock },
  { to: '/promotions', label: 'Khuyến mãi', icon: Tags },
  { to: '/warranties', label: 'Bảo hành', icon: BadgeCheck },
  { to: '/activity-logs', label: 'Nhật ký hoạt động', icon: History },
  { label: 'AI gợi ý', icon: BrainCircuit }
];

const employeeAllowedPaths = new Set(['/', '/pos', '/orders', '/products', '/inventory', '/customers', '/shifts', '/promotions', '/warranties']);

function isAllowed(item, hasFullAccess) {
  return hasFullAccess || (item.to && employeeAllowedPaths.has(item.to)) || item.label.includes('AI');
}

function isPathActive(pathname, to) {
  if (!to) return false;
  if (to === '/') return pathname === '/';
  return pathname === to || pathname.startsWith(`${to}/`);
}

function navItemClass(isActive, isCompact = false) {
  return [
    'group relative flex w-full items-center overflow-hidden rounded-lg text-left font-semibold outline-none',
    'transition-[color,transform,box-shadow] duration-200 ease-out',
    'will-change-transform active:scale-[0.985] focus-visible:ring-2 focus-visible:ring-brand-soft',
    isCompact ? 'min-h-[38px] gap-3 px-4 py-1 text-[15px]' : 'min-h-[38px] gap-3 px-4 py-1 text-[15px]',
    isActive ? 'text-white shadow-sm' : 'text-[#191c1d] hover:text-brand-ink'
  ].join(' ');
}

function NavItemContent({ icon: Icon, label, isActive, isCompact = false }) {
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
        size={isCompact ? 20 : 20}
        strokeWidth={2.1}
        className="relative z-10 shrink-0 transition-transform duration-200 ease-out group-hover:scale-105"
      />
      <span className="relative z-10 truncate">{label}</span>
    </>
  );
}

export default function Sidebar({ isMobileOpen = false, onMobileClose = () => {} }) {
  const location = useLocation();
  const user = getUser();
  const hasFullAccess = isFullAccessRole(user?.role);
  const [pendingPath, setPendingPath] = useState('');

  const visiblePrimaryItems = primaryItems.filter((item) => isAllowed(item, hasFullAccess));
  const visibleExtraItems = extraItems.filter((item) => isAllowed(item, hasFullAccess));

  useEffect(() => {
    setPendingPath('');
    onMobileClose();
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileOpen) return undefined;
    const scrollY = window.scrollY;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousOverflow = document.body.style.overflow;
    const previousPosition = document.body.style.position;
    const previousTop = document.body.style.top;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousOverflow;
      document.body.style.position = previousPosition;
      document.body.style.top = previousTop;
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
    };
  }, [isMobileOpen]);

  const renderNavItem = (item, isCompact = false) => {
    const isActive = pendingPath ? pendingPath === item.to : isPathActive(location.pathname, item.to);

    if (!item.to) {
      return (
        <button
          key={item.label}
          type="button"
          className={`${navItemClass(false, isCompact)} cursor-not-allowed opacity-55`}
        >
          <NavItemContent icon={item.icon} label={item.label} isActive={false} isCompact={isCompact} />
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
        className={navItemClass(isActive, isCompact)}
      >
        <NavItemContent icon={item.icon} label={item.label} isActive={isActive} isCompact={isCompact} />
      </NavLink>
    );
  };

  return (<>
    {isMobileOpen && <button type="button" className="fixed inset-0 z-50 bg-black/45 lg:hidden" onClick={onMobileClose} aria-label="Đóng menu" />}
    <aside className={`fixed left-0 top-0 z-[51] flex h-dvh w-[min(86vw,300px)] flex-col border-r border-[#c3c7cd] bg-white py-2 transition-transform duration-200 lg:z-50 lg:h-screen lg:w-[260px] lg:translate-x-0 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="mb-5 px-4">
        <div className="flex h-14 items-center gap-3">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-brand-surface" data-preserve-radius="logo">
            <img
              src={ztechLogo}
              alt="Z-TECH POS logo"
              className="max-w-none -translate-x-[59px] -translate-y-[19px] object-contain"
              style={{ width: 180 }}
            />
          </div>
          <div className="flex min-w-0 flex-col justify-center">
            <div
              className="whitespace-nowrap text-xl font-black leading-6 text-brand"
              style={{ WebkitTextStroke: '0.8px currentColor', textShadow: '0.25px 0 currentColor' }}
            >
              Z-TECH POS
            </div>
            <p className="hidden text-xs text-gray-1000 sm:block">Quản lý bán hàng</p>
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3">
        <div className="space-y-0.5">
          {visiblePrimaryItems.map((item) => renderNavItem(item))}
        </div>

        {visibleExtraItems.length > 0 && (
          <div className="space-y-0.5 pt-2">
            <div className="px-3 text-[10px] font-extrabold uppercase tracking-wide text-[#8b929a]">
              Quản lý thêm
            </div>
            {visibleExtraItems.map((item) => renderNavItem(item))}
          </div>
        )}
      </nav>

      <div className="px-3 pt-2">
        <button
          type="button"
          onClick={logout}
          className="flex min-h-[36px] w-full items-center justify-center gap-3 rounded-lg bg-brand-soft px-4 py-1.5 text-[14px] font-semibold text-brand-ink outline-none transition-[background-color,color,box-shadow,transform] duration-200 ease-out hover:bg-red-600 hover:text-white active:scale-[0.985] active:bg-red-700 active:text-white focus-visible:ring-2 focus-visible:ring-red-200"
        >
          <LogOut size={18} />
          <span>Đăng xuất</span>
        </button>
      </div>
    </aside>
  </>);
}
