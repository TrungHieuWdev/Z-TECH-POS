import { useEffect, useState } from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';

export default function NetworkStatus({ children }) {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return children;

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6">
      <section className="w-full max-w-md border border-slate-200 bg-white p-8 text-center shadow-lg">
        <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-100">
          <WifiOff size={38} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold text-slate-950">Mất kết nối mạng</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Không thể kết nối Internet. Vui lòng kiểm tra Wi-Fi hoặc dây mạng rồi thử lại.
        </p>
        <button
          type="button"
          onClick={() => navigator.onLine && window.location.reload()}
          className="mt-6 inline-flex h-11 items-center justify-center gap-2 bg-sky-600 px-5 text-sm font-bold text-white transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-300"
        >
          <RefreshCw size={18} aria-hidden="true" />
          Thử kết nối lại
        </button>
      </section>
    </main>
  );
}
