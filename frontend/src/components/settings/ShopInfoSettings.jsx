import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ImagePlus, LoaderCircle, Save, Store } from 'lucide-react';
import { getUploadedAssetUrl } from '../../services/settingsService';

const phonePattern = /^0\d{9}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ShopInfoSettings({ value, onSave, onUploadLogo, isSaving }) {
  const [form, setForm] = useState(value);
  const [previewLogo, setPreviewLogo] = useState('');

  useEffect(() => {
    setForm(value);
    setPreviewLogo('');
  }, [value]);

  const logoSrc = useMemo(() => previewLogo || getUploadedAssetUrl(form.logoUrl), [form.logoUrl, previewLogo]);

  const updateField = (field, nextValue) => setForm((current) => ({ ...current, [field]: nextValue }));

  const handleLogoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Vui lòng chọn file hình ảnh');

    setPreviewLogo(URL.createObjectURL(file));
    const logoUrl = await onUploadLogo(file);
    if (logoUrl) updateField('logoUrl', logoUrl);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return toast.error('Tên cửa hàng không được để trống');
    if (!phonePattern.test(form.phone.trim())) return toast.error('Số điện thoại phải gồm 10 số và bắt đầu bằng 0');
    if (form.email.trim() && !emailPattern.test(form.email.trim())) return toast.error('Email không đúng định dạng');

    await onSave({
      ...form,
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim()
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-[#e1e3e4] pb-5 md:flex-row md:items-center">
        <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden border border-[#d9e3ea] bg-[#f5f8fa]">
          {logoSrc ? <img src={logoSrc} alt="Logo cửa hàng" className="h-full w-full object-cover" /> : <Store size={32} className="text-[#7d8a94]" />}
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-[#191c1d]">Thông tin cửa hàng</h2>
          <p className="mt-1 text-sm font-medium text-[#66727c]">Thông tin này dùng cho hóa đơn, báo cáo và nhận diện cửa hàng.</p>
          <label className="mt-3 inline-flex h-10 cursor-pointer items-center gap-2 border border-[#b9d5e7] bg-white px-3 text-sm font-bold text-brand-strong transition hover:bg-brand-surface">
            <ImagePlus size={17} />
            Tải logo
            <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} disabled={isSaving} />
          </label>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Tên cửa hàng" value={form.name} onChange={(value) => updateField('name', value)} required />
        <Field label="Số điện thoại" value={form.phone} onChange={(value) => updateField('phone', value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" required />
        <Field label="Email" value={form.email} onChange={(value) => updateField('email', value)} type="email" />
        <Field label="Địa chỉ" value={form.address} onChange={(value) => updateField('address', value)} />
      </div>

      <SaveButton isSaving={isSaving} />
    </form>
  );
}

function Field({ label, value, onChange, type = 'text', required = false, inputMode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-[#34424d]">{label}</span>
      <input
        type={type}
        value={value || ''}
        required={required}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full border border-[#d7e2ea] bg-white px-3 text-sm font-semibold text-[#191c1d] outline-none transition focus:border-brand-strong focus:ring-2 focus:ring-brand-soft"
      />
    </label>
  );
}

function SaveButton({ isSaving }) {
  return (
    <button type="submit" disabled={isSaving} className="inline-flex h-10 items-center gap-2 bg-brand px-4 text-sm font-bold text-white transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-60">
      {isSaving ? <LoaderCircle size={17} className="animate-spin" /> : <Save size={17} />}
      Lưu thông tin cửa hàng
    </button>
  );
}
