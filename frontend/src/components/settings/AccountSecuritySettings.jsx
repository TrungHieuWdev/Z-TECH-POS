import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Eye, EyeOff, LoaderCircle, Lock, Save } from 'lucide-react';
import { ROLE_BADGES } from '../../constants/settingsDefaults';
import { changeCurrentPassword, getCurrentAccount } from '../../services/settingsService';
import { getRoleLabel } from '../../utils/auth';
import { Header } from './PrintSettings';

const emptyPasswordForm = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
};

export default function AccountSecuritySettings() {
  const [account, setAccount] = useState(null);
  const [form, setForm] = useState(emptyPasswordForm);
  const [visible, setVisible] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadAccount() {
      setIsLoading(true);
      try {
        const data = await getCurrentAccount();
        if (mounted) setAccount(data);
      } catch (error) {
        toast.error(error.response?.data?.message || 'Không thể tải tài khoản hiện tại');
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    loadAccount();
    return () => { mounted = false; };
  }, []);

  const updateField = (field, nextValue) => setForm((current) => ({ ...current, [field]: nextValue }));
  const toggleVisible = (field) => setVisible((current) => ({ ...current, [field]: !current[field] }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (form.newPassword.length < 6) return toast.error('Mật khẩu mới phải có ít nhất 6 ký tự');
    if (form.newPassword === form.currentPassword) return toast.error('Mật khẩu mới phải khác mật khẩu hiện tại');
    if (form.newPassword !== form.confirmPassword) return toast.error('Xác nhận mật khẩu mới không trùng khớp');

    setIsSaving(true);
    try {
      await changeCurrentPassword(form);
      setForm(emptyPasswordForm);
      setVisible({});
      toast.success('Đổi mật khẩu thành công');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể đổi mật khẩu');
    } finally {
      setIsSaving(false);
    }
  };

  const roleKey = String(account?.role || '').toLowerCase();

  return (
    <div className="space-y-5">
      <Header icon={Lock} title="Bảo mật tài khoản hiện tại" description="Xem nhanh tài khoản đang đăng nhập và đổi mật khẩu cá nhân." />

      <section className="grid gap-3 border border-[#e1e3e4] bg-[#fbfcfd] p-4 md:grid-cols-2">
        {isLoading ? (
          <p className="text-sm font-semibold text-[#66727c]">Đang tải tài khoản...</p>
        ) : (
          <>
            <Info label="Họ tên" value={account?.name || 'Chưa có'} />
            <Info label="Email hoặc mã đăng nhập" value={account?.email || account?.employeeCode || 'Chưa có'} />
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#66727c]">Vai trò</p>
              <span className={`mt-1 inline-flex px-2.5 py-1 text-xs font-extrabold ring-1 ${ROLE_BADGES[roleKey] || ROLE_BADGES.employee}`}>
                {getRoleLabel(account?.role)}
              </span>
            </div>
            <Info label="Lần đăng nhập gần nhất" value={account?.lastLoginAt ? new Date(account.lastLoginAt).toLocaleString('vi-VN') : 'Chưa có dữ liệu'} />
          </>
        )}
      </section>

      <form onSubmit={handleSubmit} className="space-y-4">
        <PasswordField label="Mật khẩu hiện tại" value={form.currentPassword} visible={visible.currentPassword} onToggle={() => toggleVisible('currentPassword')} onChange={(value) => updateField('currentPassword', value)} />
        <PasswordField label="Mật khẩu mới" value={form.newPassword} visible={visible.newPassword} onToggle={() => toggleVisible('newPassword')} onChange={(value) => updateField('newPassword', value)} />
        <PasswordField label="Xác nhận mật khẩu mới" value={form.confirmPassword} visible={visible.confirmPassword} onToggle={() => toggleVisible('confirmPassword')} onChange={(value) => updateField('confirmPassword', value)} />

        <button type="submit" disabled={isSaving} className="inline-flex h-10 items-center gap-2 bg-brand px-4 text-sm font-bold text-white transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-60">
          {isSaving ? <LoaderCircle size={17} className="animate-spin" /> : <Save size={17} />}
          Đổi mật khẩu
        </button>
      </form>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-[#66727c]">{label}</p>
      <p className="mt-1 text-sm font-extrabold text-[#191c1d]">{value}</p>
    </div>
  );
}

function PasswordField({ label, value, visible, onToggle, onChange }) {
  return (
    <label className="block max-w-xl">
      <span className="mb-1.5 block text-sm font-bold text-[#34424d]">{label}</span>
      <span className="relative block">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full border border-[#d7e2ea] bg-white px-3 pr-11 text-sm font-semibold outline-none focus:border-brand-strong focus:ring-2 focus:ring-brand-soft"
        />
        <button type="button" onClick={onToggle} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center text-[#66727c] transition hover:text-brand-strong" aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
    </label>
  );
}
