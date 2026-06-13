import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Check, Eye, EyeOff, LockKeyhole, LogIn, UserSquare2 } from 'lucide-react';
import api from '../api/axios';
import ztechLogo from '../assets/images/1111.png';
import { isFullAccessRole, saveAuth } from '../utils/auth';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ employeeCode: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/auth/login', {
        employeeCode: form.employeeCode.trim().toUpperCase(),
        password: form.password
      });
      const user = response.data.user;
      saveAuth(user, response.data.token, remember);
      toast.success('Đăng nhập thành công');
      navigate(isFullAccessRole(user?.role) ? '/' : '/pos');
    } catch (error) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Không thể đăng nhập';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-[#f8f9fa] font-sans text-[#191c1d] lg:flex-row">
      <section className="relative hidden min-h-screen w-1/2 items-center justify-center overflow-hidden bg-brand-soft p-8 lg:flex">
        <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(#74B8E0_0.5px,transparent_0.5px)] [background-size:24px_24px]" />
        <div className="relative z-10 flex max-w-[520px] flex-col items-center text-center">
          <div className="mb-6 h-32 w-32 overflow-hidden rounded-2xl bg-white shadow-sm">
            <img
              src={ztechLogo}
              alt="Z-TECH POS logo"
              className="max-w-none -translate-x-[128px] -translate-y-[42px] object-contain"
              style={{ width: 389 }}
            />
          </div>
          <h1 className="text-[40px] font-bold leading-[48px] text-brand">Z-TECH POS</h1>
          <p className="mt-4 max-w-[430px] text-lg leading-[26px] text-brand-ink">
            Giải pháp quản lý bán hàng thông minh, giúp chủ cửa hàng quản lý nhân viên bằng mã đăng nhập riêng.
          </p>
        </div>
      </section>

      <section className="flex min-h-screen flex-1 items-center justify-center bg-[#f8f9fa] px-4 py-10 sm:px-6 lg:min-h-0 lg:px-8">
        <div className="w-full max-w-[460px] rounded-2xl border border-[#e1e3e4] bg-white p-8 shadow-[0_16px_42px_rgba(25,28,29,0.10)] sm:p-9">
          <div className="mb-8 text-center lg:hidden">
            <div className="mx-auto mb-4 h-16 w-16 overflow-hidden rounded-xl bg-brand-soft">
              <img
                src={ztechLogo}
                alt="Z-TECH POS logo"
                className="max-w-none -translate-x-[64px] -translate-y-[21px] object-contain"
                style={{ width: 195 }}
              />
            </div>
            <p className="text-2xl font-bold text-brand">Z-TECH POS</p>
          </div>

          <div className="mb-8">
            <h2 className="text-[32px] font-semibold leading-10 text-[#191c1d]">Đăng nhập hệ thống</h2>
            <p className="mt-1 text-base leading-6 text-[#43474d]">
              CHÀO MỪNG BẠN ĐẾN VỚI Z-TECH POS
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold leading-5 text-[#43474d]">Email hoặc mã</span>
              <div className="group relative">
                <UserSquare2 className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#73777d] transition-colors group-focus-within:text-brand-strong" />
                <input
                  value={form.employeeCode}
                  onChange={(event) => setForm({ ...form, employeeCode: event.target.value.toUpperCase() })}
                  autoComplete="username"
                  className="h-12 w-full rounded-lg border border-[#c3c7cd] bg-[#f3f4f5] pl-11 pr-4 text-base leading-6 text-[#191c1d] outline-none transition-all placeholder:text-[#73777d] focus:border-brand focus:ring-2 focus:ring-brand-soft"
                  placeholder="Nhập email hoặc mã"
                  required
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold leading-5 text-[#43474d]">Mật khẩu</span>
              <div className="group relative">
                <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#73777d] transition-colors group-focus-within:text-brand-strong" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  autoComplete="current-password"
                  className="h-12 w-full rounded-lg border border-[#c3c7cd] bg-[#f3f4f5] pl-11 pr-12 text-base leading-6 text-[#191c1d] outline-none transition-all placeholder:text-[#73777d] focus:border-brand focus:ring-2 focus:ring-brand-soft"
                  placeholder="Nhập mật khẩu"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-4 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-[#73777d] transition hover:bg-brand-surface hover:text-brand-strong"
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
                    className="peer h-5 w-5 appearance-none rounded border-2 border-[#c3c7cd] bg-[#f3f4f5] transition-all checked:border-brand checked:bg-brand focus:outline-none focus:ring-2 focus:ring-brand-soft"
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
              <span className="shrink-0 text-sm font-semibold leading-5 text-brand-strong">
                Quên mật khẩu ?
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#74B8E0] px-4 text-xl font-semibold leading-7 text-white shadow-sm transition hover:bg-[#6DAFDB] active:bg-[#66A8D4] disabled:cursor-not-allowed disabled:opacity-70"
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
