import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Check, Eye, EyeOff, LockKeyhole, LogIn, ReceiptText, User } from 'lucide-react';
import api from '../api/axios';
import { saveAuth } from '../utils/auth';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/auth/login', form);
      saveAuth(response.data.user, response.data.token);
      toast.success('Đăng nhập thành công');
      navigate('/');
    } catch (error) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Không thể đăng nhập';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-[#f8f9fa] font-sans text-[#191c1d] lg:flex-row">
      <section className="relative hidden min-h-screen w-1/2 items-center justify-center overflow-hidden bg-[#c6e2ff] p-8 lg:flex">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(#466179_0.5px,transparent_0.5px)] [background-size:24px_24px]" />
        <div className="relative z-10 flex max-w-[520px] flex-col items-center text-center">
          <div className="mb-6 grid h-32 w-32 place-items-center rounded-full bg-white shadow-sm">
            <ReceiptText size={64} strokeWidth={1.8} className="text-[#466179]" />
          </div>
          <h1 className="text-[40px] font-bold leading-[48px] text-[#466179]">Z-TECH POS</h1>
          <p className="mt-4 max-w-[430px] text-lg font-normal leading-[26px] text-[#4a657d]">
            Giải pháp quản lý bán hàng thông minh, tối ưu hóa quy trình vận hành cho doanh nghiệp của bạn.
          </p>
        </div>
      </section>

      <section className="flex min-h-screen flex-1 items-center justify-center bg-[#f8f9fa] px-4 py-10 sm:px-6 lg:min-h-0 lg:px-8">
        <div className="w-full max-w-[440px]">
          <div className="mb-8 text-center lg:hidden">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-[#c6e2ff]">
              <ReceiptText size={32} className="text-[#466179]" />
            </div>
            <p className="text-2xl font-bold text-[#466179]">Z-TECH POS</p>
          </div>

          <div className="mb-8">
            <h2 className="text-[32px] font-semibold leading-10 text-[#191c1d]">Đăng nhập hệ thống</h2>
            <p className="mt-1 text-base font-normal leading-6 text-[#43474d]">
              Vui lòng điền thông tin để bắt đầu
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold leading-5 text-[#43474d]">
                Tên đăng nhập hoặc Email
              </span>
              <div className="group relative">
                <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#73777d] transition-colors group-focus-within:text-[#466179]" />
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  autoComplete="email"
                  className="h-12 w-full rounded-lg border border-[#c3c7cd] bg-[#f3f4f5] pl-11 pr-4 text-base leading-6 text-[#191c1d] outline-none transition-all placeholder:text-[#73777d] focus:border-[#466179] focus:ring-2 focus:ring-[#c6e2ff]"
                  placeholder="admin@pos.com"
                  required
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold leading-5 text-[#43474d]">Mật khẩu</span>
              <div className="group relative">
                <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#73777d] transition-colors group-focus-within:text-[#466179]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  autoComplete="current-password"
                  className="h-12 w-full rounded-lg border border-[#c3c7cd] bg-[#f3f4f5] pl-11 pr-12 text-base leading-6 text-[#191c1d] outline-none transition-all placeholder:text-[#73777d] focus:border-[#466179] focus:ring-2 focus:ring-[#c6e2ff]"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-4 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-[#73777d] transition hover:bg-[#e7e8e9] hover:text-[#43474d]"
                  title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            <div className="flex items-center justify-between gap-4 py-1">
              <label className="group flex cursor-pointer items-center gap-2">
                <span className="relative grid h-5 w-5 place-items-center">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                    className="peer h-5 w-5 appearance-none rounded border-2 border-[#c3c7cd] bg-[#f3f4f5] transition-all checked:border-[#466179] checked:bg-[#466179] focus:outline-none focus:ring-2 focus:ring-[#c6e2ff]"
                  />
                  <Check
                    size={15}
                    strokeWidth={3}
                    className="pointer-events-none absolute text-white opacity-0 transition-opacity peer-checked:opacity-100"
                  />
                </span>
                <span className="text-sm font-semibold leading-5 text-[#43474d] transition group-hover:text-[#191c1d]">
                  Ghi nhớ đăng nhập
                </span>
              </label>
              <button
                type="button"
                className="shrink-0 text-sm font-semibold leading-5 text-[#466179] transition hover:underline"
              >
                Quên mật khẩu?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#466179] px-4 text-xl font-semibold leading-7 text-white shadow-sm transition hover:bg-[#3d566c] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span>{loading ? 'Đang đăng nhập...' : 'Đăng nhập'}</span>
              <LogIn size={22} />
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
