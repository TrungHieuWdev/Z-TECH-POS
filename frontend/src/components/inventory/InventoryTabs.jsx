import { Boxes, History, Sparkles } from 'lucide-react';
const tabs = [{ value: 'current', label: 'Tồn kho hiện tại', icon: Boxes }, { value: 'ai', label: 'AI phân tích', icon: Sparkles }, { value: 'history', label: 'Lịch sử kho', icon: History }];
export default function InventoryTabs({ value, onChange }) {
  return <div className="flex shrink-0 justify-end whitespace-nowrap">{tabs.map(({ value: tab, label, icon: Icon }) => <button key={tab} type="button" onClick={() => onChange(tab)} className={`flex h-12 items-center gap-1.5 border-b-2 px-3 text-sm font-semibold ${value === tab ? 'border-sky-600 text-sky-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}><Icon size={15} className={value === tab ? 'text-[#398fbd]' : 'text-sky-400'} />{label}</button>)}</div>;
}
