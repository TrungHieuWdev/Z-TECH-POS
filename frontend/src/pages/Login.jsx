import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  UserRound
} from 'lucide-react';
import api from '../api/axios';
import loginVisual from '../assets/images/login11.png';
import ztechLogo from '../assets/images/1111.png';
import { saveAuth } from '../utils/auth';

const initialForm = { employeeCode: '', password: '' };

function Brand({ compact = false }) {
  return (
    <div className={`flex items-center ${compact ? 'justify-center gap-3' : 'gap-3'}`}>
      <div
        data-preserve-radius="logo"
        className={`relative shrink-0 overflow-hidden bg-white ${compact ? 'h-[62px] w-[62px]' : 'h-[54px] w-[54px]'}`}
      >
        <img
          src={ztechLogo}
          alt="Z-TECH POS"
          className="absolute max-w-none object-contain"
          style={{
            width: compact ? 188 : 164,
            transform: compact ? 'translate(-62px, -20px)' : 'translate(-54px, -18px)'
          }}
        />
      </div>
      <div>
        <p className={`${compact ? 'text-[25px]' : 'text-[22px]'} font-extrabold leading-tight text-[#4a9ddd]`}>
          Z-TECH POS
        </p>
        <p className="text-sm font-medium text-[#26364d]">Quản lý bán hàng</p>
      </div>
    </div>
  );
}

function Field({ label, icon: Icon, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-[#162238]">{label}</span>
      <div className="group relative">
        <Icon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8190a8] group-focus-within:text-[#4a9ddd]" />
        {children}
      </div>
    </label>
  );
}

function LoginCard({
  form,
  loading,
  remember,
  showPassword,
  errorMessage,
  mfaChallenge,
  mfaCode,
  onMfaCodeChange,
  onFormChange,
  onRememberChange,
  onPasswordToggle,
  onSubmit
}) {
  const inputClass = 'h-[54px] w-full border border-[#d8e0eb] bg-white pl-12 pr-4 text-[15px] font-medium text-[#17233a] outline-none transition placeholder:text-[#9aa6b8] focus:border-[#5ba9e7] focus:ring-2 focus:ring-[#d9efff]';

  return (
    <div
      className="w-full max-w-[462px] border border-white/80 bg-white/95 px-5 py-6 shadow-[0_24px_70px_rgba(55,119,169,0.14)] backdrop-blur sm:px-8 sm:py-8 xl:px-9 xl:py-9"
    >
      <Brand compact />

      <div className="mb-6 mt-5 text-center sm:mb-7 sm:mt-6">
        <h1 className="text-2xl font-extrabold tracking-[-0.02em] text-[#132039] sm:text-[26px]">Đăng nhập hệ thống</h1>
        <p className="mt-2 text-sm font-medium text-[#708097]">Vui lòng đăng nhập để tiếp tục</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 sm:space-y-5">
        {!mfaChallenge && <Field label="Mã đăng nhập hoặc email" icon={UserRound}>
          <input
            value={form.employeeCode}
            onChange={(event) => onFormChange('employeeCode', event.target.value.toUpperCase())}
            autoComplete="username"
            className={inputClass}
            placeholder="Nhập mã đăng nhập hoặc email"
            required
          />
        </Field>}

        {!mfaChallenge && <Field label="Mật khẩu" icon={LockKeyhole}>
          <input
            type={showPassword ? 'text' : 'password'}
            value={form.password}
            onChange={(event) => onFormChange('password', event.target.value)}
            autoComplete="current-password"
            className={`${inputClass} pr-12`}
            placeholder="Nhập mật khẩu"
            required
          />
          <button
            type="button"
            onClick={onPasswordToggle}
            className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center text-[#8190a8] transition hover:text-[#4a9ddd]"
            aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </Field>}

        {mfaChallenge && <Field label="Mã xác thực hoặc mã khôi phục" icon={LockKeyhole}>
          <input
            value={mfaCode}
            onChange={(event) => onMfaCodeChange(event.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10))}
            autoComplete="one-time-code"
            className={`${inputClass} text-center text-lg font-extrabold tracking-[0.35em]`}
            placeholder="000000"
            minLength={6}
            maxLength={10}
            required
            autoFocus
          />
        </Field>}

        {errorMessage && (
          <div className="border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        )}

        {!mfaChallenge && <div className="flex items-center justify-between gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[#26364d]">
            <span className="relative grid h-[18px] w-[18px] place-items-center">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => onRememberChange(event.target.checked)}
                className="peer h-[18px] w-[18px] appearance-none border border-[#b9c6d8] bg-white checked:border-[#58a9e8] checked:bg-[#58a9e8] focus:outline-none focus:ring-2 focus:ring-[#d9efff]"
              />
              <Check size={13} strokeWidth={3} className="pointer-events-none absolute text-white opacity-0 peer-checked:opacity-100" />
            </span>
            Ghi nhớ đăng nhập
          </label>
          <span className="text-sm font-medium text-[#4a9ddd]">Quên mật khẩu?</span>
        </div>}

        <button
          type="submit"
          disabled={loading}
          className="flex h-[54px] w-full items-center justify-center gap-3 bg-gradient-to-r from-[#55a7e7] to-[#65b6ef] px-5 text-base font-semibold text-white shadow-[0_10px_24px_rgba(77,164,226,0.22)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <span>{loading ? 'Đang xác thực...' : mfaChallenge ? 'Xác nhận mã bảo mật' : 'Đăng nhập'}</span>
        </button>
      </form>
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [mfaChallenge, setMfaChallenge] = useState('');
  const [mfaCode, setMfaCode] = useState('');

  const updateForm = (field, value) => {
    setErrorMessage('');
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      const response = mfaChallenge
        ? await api.post('/auth/mfa/verify-login', { challengeToken: mfaChallenge, code: mfaCode })
        : await api.post('/auth/login', {
            employeeCode: form.employeeCode.trim().toUpperCase(),
            password: form.password,
            remember
          });
      if (response.data.mfaRequired) {
        setMfaChallenge(response.data.challengeToken);
        setMfaCode('');
        toast.success('Vui lòng nhập mã từ ứng dụng xác thực');
        return;
      }
      const user = response.data.user;

      saveAuth(user, null, remember);
      toast.success('Đăng nhập thành công');
      navigate('/dashboard');
    } catch (error) {
      const message = error.response?.status === 401
        ? 'Mật khẩu hoặc mã đăng nhập bạn nhập bị sai'
        : error.code === 'ECONNABORTED'
          ? 'Máy chủ phản hồi quá chậm. Vui lòng kiểm tra backend đang chạy.'
          : !error.response
            ? 'Không kết nối được máy chủ. Vui lòng kiểm tra backend và kết nối mạng.'
            : error.response?.data?.error || error.response?.data?.message || 'Không thể đăng nhập';
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-[#edf7ff] font-sans text-[#17233a] lg:grid-cols-[minmax(0,1.8fr)_minmax(400px,1fr)] xl:grid-cols-[minmax(0,2fr)_minmax(440px,1fr)]">
      <section className="relative hidden min-h-screen overflow-hidden border-r border-[#d9e7f4] lg:block">
        <img src={loginVisual} alt="" className="absolute inset-0 h-full w-full object-cover object-center xl:object-center" />
      </section>

      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_35%_30%,#ffffff_0%,#f4faff_48%,#e9f5ff_100%)] px-4 py-6 sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute inset-0 opacity-45 [background-image:radial-gradient(#b8dcf6_1px,transparent_1px)] [background-size:24px_24px] [mask-image:linear-gradient(to_bottom,black,transparent_72%)]" />
        <div className="relative z-10 flex w-full justify-center lg:justify-start">
          <LoginCard
            form={form}
            loading={loading}
            remember={remember}
            showPassword={showPassword}
        errorMessage={errorMessage}
        mfaChallenge={mfaChallenge}
        mfaCode={mfaCode}
        onMfaCodeChange={setMfaCode}
            onFormChange={updateForm}
            onRememberChange={setRemember}
            onPasswordToggle={() => setShowPassword((current) => !current)}
            onSubmit={handleSubmit}
          />
        </div>
        <footer className="relative z-10 mt-5 w-full max-w-[462px] text-center text-xs font-medium leading-5 text-[#718198] sm:mt-7 sm:leading-6 lg:self-start">
          <p>© 2026 Z-TECH POS</p>
          <p>Phiên bản 1.0.0</p>
        </footer>
      </section>
    </main>
  );
}
