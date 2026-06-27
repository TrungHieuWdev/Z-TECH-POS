import { useEffect, useState } from 'react';
import { Boxes } from 'lucide-react';
import { Header, SaveButton, Toggle } from './PrintSettings';

export default function InventorySettings({ value, onSave, isSaving }) {
  const [form, setForm] = useState(value);

  useEffect(() => setForm(value), [value]);

  const updateField = (field, nextValue) => setForm((current) => ({ ...current, [field]: nextValue }));

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave({
      ...form,
      lowStockThreshold: Math.max(0, Math.min(999, Number(form.lowStockThreshold) || 0))
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Header icon={Boxes} title="Kho hàng" description="Thiết lập cảnh báo tồn kho và hành vi bán khi sản phẩm hết hàng." />

      <label className="block max-w-xs">
        <span className="mb-1.5 block text-sm font-bold text-[#34424d]">Ngưỡng cảnh báo tồn kho thấp</span>
        <input
          type="number"
          min="0"
          max="999"
          value={form.lowStockThreshold}
          onChange={(event) => updateField('lowStockThreshold', event.target.value)}
          className="h-11 w-full border border-[#d7e2ea] bg-white px-3 text-sm font-semibold outline-none focus:border-brand-strong focus:ring-2 focus:ring-brand-soft"
        />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <Toggle label="Cho phép bán khi hết hàng" checked={form.allowOutOfStockSale} onChange={(checked) => updateField('allowOutOfStockSale', checked)} />
        <Toggle label="Bật gợi ý nhập hàng" checked={form.restockSuggestions} onChange={(checked) => updateField('restockSuggestions', checked)} />
      </div>

      <SaveButton isSaving={isSaving} label="Lưu cài đặt kho" />
    </form>
  );
}
