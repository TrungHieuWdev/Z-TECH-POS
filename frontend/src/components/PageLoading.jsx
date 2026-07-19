import { LoaderCircle } from 'lucide-react';

export default function PageLoading({ message = 'Đang tải dữ liệu trang', fullScreen = false }) {
  return (
    <div
      className={`grid place-items-center bg-slate-50/95 px-6 ${fullScreen ? 'min-h-screen' : 'min-h-[420px]'}`}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="flex flex-col items-center text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-sky-50 ring-1 ring-sky-100">
          <LoaderCircle className="animate-spin text-sky-600 motion-reduce:animate-none" size={36} strokeWidth={2.2} aria-hidden="true" />
        </span>
        <p className="mt-4 text-sm font-semibold text-slate-700">{message}</p>
        <p className="mt-1 text-xs text-slate-500">Vui lòng chờ trong giây lát</p>
      </div>
    </div>
  );
}
