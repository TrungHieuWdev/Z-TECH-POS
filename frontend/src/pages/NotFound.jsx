import { ArrowLeft, FileQuestion, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getToken } from '../utils/auth';

export default function NotFound() {
  const navigate = useNavigate();
  const homePath = getToken() ? '/' : '/login';

  return (
    <div className="grid min-h-[70vh] place-items-center px-4 py-12">
      <section className="w-full max-w-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm sm:px-10">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-cyan-50 text-cyan-700">
          <FileQuestion size={32} strokeWidth={1.8} />
        </div>
        <p className="mt-6 text-7xl font-black tracking-tight text-slate-950">404</p>
        <h1 className="mt-3 text-2xl font-extrabold text-slate-900">Không tìm thấy trang</h1>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="inline-flex h-11 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
            <ArrowLeft size={17} /> Quay lại
          </button>
          <button type="button" onClick={() => navigate(homePath, { replace: true })} className="inline-flex h-11 items-center gap-2 bg-cyan-700 px-4 text-sm font-bold text-white hover:bg-cyan-800">
            <Home size={17} /> {getToken() ? 'Về trang tổng quan' : 'Về trang đăng nhập'}
          </button>
        </div>
      </section>
    </div>
  );
}
