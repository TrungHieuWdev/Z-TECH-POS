import { useEffect, useState } from 'react';
import { LoaderCircle, Printer, Save } from 'lucide-react';
import { PAPER_SIZE_OPTIONS } from '../../constants/settingsDefaults';

export default function PrintSettings({ value, onSave, isSaving }) {
  const [form, setForm] = useState(value);

  useEffect(() => setForm(value), [value]);

  const updateField = (field, nextValue) => setForm((current) => ({ ...current, [field]: nextValue }));

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave({
      ...form,
      copies: Math.max(1, Math.min(5, Number(form.copies) || 1))
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Header icon={Printer} title="In hóa đơn" description="Thiết lập mẫu in nhanh dùng sau khi thanh toán tại quầy." />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-[#34424d]">Khổ giấy</span>
          <select value={form.paperSize} onChange={(event) => updateField('paperSize', event.target.value)} className="h-11 w-full border border-[#d7e2ea] bg-white px-3 text-sm font-semibold outline-none focus:border-brand-strong focus:ring-2 focus:ring-brand-soft">
            {PAPER_SIZE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-[#34424d]">Số bản in</span>
          <input type="number" min="1" max="5" value={form.copies} onChange={(event) => updateField('copies', event.target.value)} className="h-11 w-full border border-[#d7e2ea] bg-white px-3 text-sm font-semibold outline-none focus:border-brand-strong focus:ring-2 focus:ring-brand-soft" />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-[#34424d]">Header hóa đơn</span>
        <input value={form.header || ''} onChange={(event) => updateField('header', event.target.value)} className="h-11 w-full border border-[#d7e2ea] bg-white px-3 text-sm font-semibold outline-none focus:border-brand-strong focus:ring-2 focus:ring-brand-soft" />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-[#34424d]">Footer hóa đơn</span>
        <textarea value={form.footer || ''} onChange={(event) => updateField('footer', event.target.value)} rows={3} className="w-full resize-none border border-[#d7e2ea] bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-brand-strong focus:ring-2 focus:ring-brand-soft" />
      </label>

      <Toggle label="Tự động mở in sau thanh toán" checked={form.autoPrintAfterPayment} onChange={(checked) => updateField('autoPrintAfterPayment', checked)} />
      <SaveButton isSaving={isSaving} label="Lưu cài đặt in" />
    </form>
  );
}

export function Header({ icon: Icon, title, description }) {
  return (
    <div className="flex items-center gap-3 border-b border-[#e1e3e4] pb-4">
      <div className="grid h-10 w-10 place-items-center bg-brand-surface text-brand-strong"><Icon size={20} /></div>
      <div>
        <h2 className="text-lg font-bold text-[#191c1d]">{title}</h2>
        <p className="text-sm font-medium text-[#66727c]">{description}</p>
      </div>
    </div>
  );
}

export function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-4 border border-[#e1e3e4] bg-[#fbfcfd] px-3 py-2">
      <span className="text-sm font-bold text-[#34424d]">{label}</span>
      <input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-brand" />
    </label>
  );
}

export function SaveButton({ isSaving, label }) {
  return (
    <button type="submit" disabled={isSaving} className="inline-flex h-10 items-center gap-2 bg-brand px-4 text-sm font-bold text-white transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-60">
      {isSaving ? <LoaderCircle size={17} className="animate-spin" /> : <Save size={17} />}
      {label}
    </button>
  );
}
