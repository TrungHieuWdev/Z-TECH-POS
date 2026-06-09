import { Outlet } from 'react-router-dom';
import { Bell, Search, Settings } from 'lucide-react';
import Sidebar from './Sidebar';
import { getUser } from '../utils/auth';

export default function Layout() {
  const user = getUser();

  return (
    <div className="min-h-screen bg-[#f8f9fa] font-sans text-[#191c1d]">
      <Sidebar />
      <div className="min-h-screen lg:pl-[260px]">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[#c3c7cd] bg-white px-4 shadow-sm md:px-6 lg:px-8 xl:px-10">
          <div className="relative w-full max-w-[260px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#73777d]" />
            <input
              type="search"
              placeholder="Tìm kiếm nhanh..."
              className="h-10 w-full rounded-lg border-0 bg-[#f3f4f5] pl-10 pr-3 text-sm font-medium text-[#191c1d] outline-none ring-1 ring-transparent transition placeholder:text-[#73777d] focus:bg-white focus:ring-2 focus:ring-[#c6e2ff]"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="hidden h-10 w-10 items-center justify-center rounded-full text-[#43474d] transition hover:bg-[#e7e8e9] sm:flex"
              title="Thông báo"
              aria-label="Thông báo"
            >
              <Bell size={20} />
            </button>
            <button
              type="button"
              className="hidden h-10 w-10 items-center justify-center rounded-full text-[#43474d] transition hover:bg-[#e7e8e9] sm:flex"
              title="Cài đặt"
              aria-label="Cài đặt"
            >
              <Settings size={20} />
            </button>
            <div className="flex items-center gap-2">
              <div className="hidden text-right sm:block">
                <p className="text-xs font-semibold leading-none text-[#191c1d]">{user?.name || 'Admin'}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#73777d]">
                  {user?.role || 'Manager'}
                </p>
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-full bg-[#c6e2ff] text-sm font-bold text-[#2e4961] ring-2 ring-white">
                {(user?.name || 'Admin').slice(0, 1).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <main className="min-w-0 px-4 py-4 md:px-6 lg:px-8 lg:py-5 xl:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
