import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Menu, Search, Settings } from 'lucide-react';
import Sidebar from './Sidebar';
import SettingsModal from './SettingsModal';
import NotificationCenter from './NotificationCenter';
import { getUser, isFullAccessRole } from '../utils/auth';

export default function Layout() {
  const user = getUser();
  const hasFullAccess = isFullAccessRole(user?.role);
  const navigate = useNavigate();
  const location = useLocation();
  const [quickSearch, setQuickSearch] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const posSearch = location.pathname === '/pos' ? searchParams.get('search') || '' : '';
    setQuickSearch(posSearch);
  }, [location.pathname, location.search]);

  const handleQuickSearch = (event) => {
    event.preventDefault();

    // Thanh tim nhanh tren header luon dua nguoi dung ve POS de loc san pham ngay.
    const keyword = quickSearch.trim();
    navigate(keyword ? `/pos?search=${encodeURIComponent(keyword)}` : '/pos');
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] font-sans text-[#191c1d]">
      <Sidebar isMobileOpen={isMobileNavOpen} onMobileClose={() => setIsMobileNavOpen(false)} />
      <div className="min-h-screen lg:pl-[260px]">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-[#c3c7cd] bg-white px-4 shadow-sm md:px-5 lg:px-6 xl:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-2">
          <button type="button" onClick={() => setIsMobileNavOpen(true)} className="grid h-10 w-10 shrink-0 place-items-center text-[#43474d] lg:hidden" aria-label="Mở menu"><Menu size={22} /></button>
          <form onSubmit={handleQuickSearch} className="relative min-w-0 w-full max-w-[260px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#73777d]" />
            <input
              type="search"
              value={quickSearch}
              onChange={(event) => setQuickSearch(event.target.value)}
              placeholder="Tìm kiếm nhanh..."
              className="h-9 w-full rounded-lg border-0 bg-[#f3f4f5] pl-10 pr-3 text-sm font-medium text-[#191c1d] outline-none ring-1 ring-transparent transition placeholder:text-[#73777d] focus:bg-white focus:ring-2 focus:ring-brand-soft"
            />
          </form>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsNotificationsOpen(true)}
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-[#43474d] transition hover:bg-brand-surface hover:text-brand-strong"
              title="Thông báo"
              aria-label="Thông báo"
            >
              <Bell size={20} />
              {notificationCount > 0 && <span className="absolute left-[23px] top-0 text-[11px] font-extrabold leading-none text-red-600">{notificationCount > 99 ? '99+' : notificationCount}</span>}
            </button>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              style={{ display: hasFullAccess ? undefined : 'none' }}
              className="hidden h-9 w-9 items-center justify-center rounded-full text-[#43474d] transition hover:bg-brand-surface hover:text-brand-strong sm:flex"
              title="Cài đặt"
              aria-label="Cài đặt"
            >
              <Settings size={20} />
            </button>
            <div className="flex items-center gap-2">
              <div className="hidden text-right sm:block">
                <p className="text-xs font-semibold leading-none text-[#191c1d]">{user?.name || 'Admin'}</p>
              </div>
              <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand-ink ring-2 ring-white">
                {(user?.name || 'Admin').slice(0, 1).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <main className="min-w-0 px-3 py-3 sm:px-4 md:px-5 lg:px-6 lg:py-4 xl:px-8">
          <Outlet />
        </main>
      </div>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <NotificationCenter isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} onCountChange={setNotificationCount} />
    </div>
  );
}
