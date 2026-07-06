import { Boxes, ClipboardCheck, History, PackagePlus } from 'lucide-react';

const tabs = [
  { value: 'current', label: 'Tồn kho', icon: Boxes },
  { value: 'receiving', label: 'Nhập hàng', icon: PackagePlus },
  { value: 'history', label: 'Biến động kho', icon: History },
  { value: 'adjustment', label: 'Điều chỉnh & Kiểm kê', icon: ClipboardCheck }
];

export default function InventoryTabs({ value, onChange }) {
  return (
    <div className="flex shrink-0 justify-end overflow-x-auto whitespace-nowrap">
      {tabs.map(({ value: tab, label, icon: Icon }) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          className={`flex h-12 items-center gap-1.5 border-b-2 px-3 text-sm font-semibold ${value === tab ? 'border-sky-600 text-sky-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
        >
          <Icon size={15} className={value === tab ? 'text-[#398fbd]' : 'text-sky-400'} />
          {label}
        </button>
      ))}
    </div>
  );
}
