import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { CreditCard } from 'lucide-react';
import { PAYMENT_METHODS } from '../../constants/settingsDefaults';
import { Header, SaveButton, Toggle } from './PrintSettings';

export default function PaymentSettings({ value, onSave, isSaving }) {
  const [form, setForm] = useState(value);

  useEffect(() => setForm(value), [value]);

  const enabledMethods = useMemo(() => PAYMENT_METHODS.filter((method) => form.methods?.[method.value]), [form.methods]);
  const updatePayment = (patch) => setForm((current) => ({ ...current, ...patch }));
  const updateMethod = (method, checked) => {
    setForm((current) => {
      const nextMethods = { ...current.methods, [method]: checked };
      const nextEnabled = PAYMENT_METHODS.filter((item) => nextMethods[item.value]);
      return {
        ...current,
        methods: nextMethods,
        defaultMethod: nextMethods[current.defaultMethod] ? current.defaultMethod : nextEnabled[0]?.value || current.defaultMethod
      };
    });
  };
  const updateVietQr = (field, nextValue) => setForm((current) => ({ ...current, vietQr: { ...current.vietQr, [field]: nextValue } }));
  const updateVat = (field, nextValue) => setForm((current) => ({ ...current, vat: { ...current.vat, [field]: nextValue } }));

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!enabledMethods.length) return toast.error('Cần bật ít nhất một phương thức thanh toán');
    if (!form.methods[form.defaultMethod]) return toast.error('Phương thức mặc định phải là phương thức đang bật');
    if ((form.methods.transfer || form.methods.qr) && (!form.vietQr.bankId || !form.vietQr.accountNo || !form.vietQr.accountName)) {
      return toast.error('Vui lòng nhập đầy đủ thông tin VietQR');
    }
    if (form.vat.enabled && (Number(form.vat.rate) < 0 || Number(form.vat.rate) > 100)) {
      return toast.error('Phần trăm VAT phải từ 0 đến 100');
    }
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Header icon={CreditCard} title="Thanh toán" description="Quản lý phương thức thanh toán, VietQR và VAT hiển thị khi bán hàng." />

      <div className="grid gap-3 md:grid-cols-3">
        {PAYMENT_METHODS.map((method) => (
          <Toggle key={method.value} label={method.label} checked={form.methods?.[method.value]} onChange={(checked) => updateMethod(method.value, checked)} />
        ))}
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-[#34424d]">Phương thức thanh toán mặc định</span>
        <select value={form.defaultMethod} onChange={(event) => updatePayment({ defaultMethod: event.target.value })} className="h-11 w-full border border-[#d7e2ea] bg-white px-3 text-sm font-semibold outline-none focus:border-brand-strong focus:ring-2 focus:ring-brand-soft">
          {enabledMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
        </select>
      </label>

      <div className="border border-[#e1e3e4] p-4">
        <h3 className="text-sm font-extrabold text-[#191c1d]">Cấu hình VietQR</h3>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <Field label="Ngân hàng / mã BIN" value={form.vietQr.bankId} onChange={(value) => updateVietQr('bankId', value.replace(/\D/g, '').slice(0, 6))} />
          <Field label="Số tài khoản" value={form.vietQr.accountNo} onChange={(value) => updateVietQr('accountNo', value.replace(/\D/g, '').slice(0, 20))} />
          <Field label="Tên chủ tài khoản" value={form.vietQr.accountName} onChange={(value) => updateVietQr('accountName', value.toUpperCase())} />
          <Field label="Nội dung chuyển khoản mặc định" value={form.vietQr.memo} onChange={(value) => updateVietQr('memo', value)} />
        </div>
      </div>

      <Toggle label="Bật VAT" checked={form.vat.enabled} onChange={(checked) => updateVat('enabled', checked)} />
      {form.vat.enabled && (
        <label className="block max-w-xs">
          <span className="mb-1.5 block text-sm font-bold text-[#34424d]">Phần trăm VAT</span>
          <input type="number" min="0" max="100" value={form.vat.rate} onChange={(event) => updateVat('rate', event.target.value)} className="h-11 w-full border border-[#d7e2ea] bg-white px-3 text-sm font-semibold outline-none focus:border-brand-strong focus:ring-2 focus:ring-brand-soft" />
        </label>
      )}

      <div className="flex h-11 items-center justify-between border border-[#e1e3e4] bg-[#fbfcfd] px-3">
        <span className="text-sm font-bold text-[#34424d]">Đơn vị tiền tệ</span>
        <span className="text-sm font-extrabold text-[#191c1d]">{form.currency}</span>
      </div>

      <SaveButton isSaving={isSaving} label="Lưu cài đặt thanh toán" />
    </form>
  );
}

function Field({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-[#34424d]">{label}</span>
      <input value={value || ''} onChange={(event) => onChange(event.target.value)} className="h-11 w-full border border-[#d7e2ea] bg-white px-3 text-sm font-semibold outline-none focus:border-brand-strong focus:ring-2 focus:ring-brand-soft" />
    </label>
  );
}
