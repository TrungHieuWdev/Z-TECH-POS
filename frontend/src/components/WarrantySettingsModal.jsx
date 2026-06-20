import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import Modal from './Modal';
import api from '../api/axios';
import { getWarrantySettings, saveWarrantySettings } from '../services/warrantySettingsService';
const tabs = ['Thời gian bảo hành', 'Sản phẩm áp dụng', 'Điều kiện bảo hành', 'Đổi mới', 'Nội dung phiếu', 'Phân quyền', 'Lịch sử'];
const statuses = ['Có bảo hành', 'Không bảo hành', 'Chỉ đổi lỗi ban đầu', 'Bảo hành theo nhà sản xuất'];
const input = 'h-10 w-full border border-gray-300 bg-white px-3 text-sm outline-none focus:border-brand disabled:bg-gray-100';
const area = 'min-h-24 w-full border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand disabled:bg-gray-100';
const DURATION_PAGE_SIZE = 5;
export default function WarrantySettingsModal({ isOpen, onClose, canEdit, userName }) {
  const [tab, setTab] = useState(tabs[0]); const [data, setData] = useState(null); const [categories, setCategories] = useState([]); const [showConfirm, setShowConfirm] = useState(false);
  const [durationPage, setDurationPage] = useState(1);
  useEffect(() => { if (isOpen) { setShowConfirm(false); setDurationPage(1); getWarrantySettings().then(setData); api.get('/categories').then((response) => setCategories(Array.isArray(response.data) ? response.data : [])).catch(() => setCategories([])); } }, [isOpen]);
  const durationPageCount = Math.max(1, Math.ceil((data?.durations?.length || 0) / DURATION_PAGE_SIZE));
  useEffect(() => { setDurationPage((page) => Math.min(page, durationPageCount)); }, [durationPageCount]);
  if (!data) return null;
  const pagedDurations = data.durations.slice((durationPage - 1) * DURATION_PAGE_SIZE, durationPage * DURATION_PAGE_SIZE);
  const set = (key, value) => setData({ ...data, [key]: value });
  const row = (key, id, field, value) => set(key, data[key].map((x) => x.id === id ? { ...x, [field]: value } : x));
  const del = (key, id) => set(key, data[key].filter((x) => x.id !== id));
  const save = async () => { if (!canEdit) return; setData(await saveWarrantySettings(data, userName)); setShowConfirm(false); toast.success('Đã lưu thiết lập bảo hành'); onClose(); };
  return <Modal isOpen={isOpen} onClose={onClose} title="Thiết lập bảo hành" maxWidth="max-w-7xl">
    <div className="flex gap-1 overflow-x-auto border-b">{tabs.map((x) => <button key={x} onClick={() => setTab(x)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${tab === x ? 'border-brand text-brand-deep' : 'border-transparent text-gray-600'}`}>{x}</button>)}</div>
    {!canEdit && <p className="mt-4 border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Tài khoản nhân viên chỉ được xem. Chủ cửa hàng hoặc Quản lý mới có quyền chỉnh sửa.</p>}
    <div className="min-h-[430px] py-5">
      {tab === tabs[0] && <Section title="Thời gian bảo hành" note="Thiết lập theo danh mục hoặc sản phẩm." add={() => { const next = [...data.durations, { id: Date.now(), scope: 'Danh mục', target: '', warrantyDays: '', exchangeDays: '', active: true }]; set('durations', next); setDurationPage(Math.ceil(next.length / DURATION_PAGE_SIZE)); }} disabled={!canEdit}><Table heads={['Phạm vi', 'Danh mục / sản phẩm', 'Ngày bảo hành', 'Ngày đổi lỗi', 'Áp dụng', '']} rows={pagedDurations.map((x) => [<select disabled={!canEdit} value={x.scope} onChange={(e) => row('durations', x.id, 'scope', e.target.value)} className={input}><option>Danh mục</option><option>Sản phẩm</option></select>, x.scope === 'Danh mục' ? <CategorySelect categories={categories} disabled={!canEdit} value={x.target} onChange={(value) => row('durations', x.id, 'target', value)}/> : <input disabled={!canEdit} value={x.target} onChange={(e) => row('durations', x.id, 'target', e.target.value)} placeholder="Nhập tên sản phẩm" className={input}/>, <NumberInput disabled={!canEdit} value={x.warrantyDays} onChange={(value) => row('durations', x.id, 'warrantyDays', value)}/>, <NumberInput disabled={!canEdit} value={x.exchangeDays} onChange={(value) => row('durations', x.id, 'exchangeDays', value)}/>, <Check disabled={!canEdit} label={x.active ? 'Đang bật' : 'Đang tắt'} checked={x.active} onChange={(v) => row('durations', x.id, 'active', v)}/>, <Delete disabled={!canEdit} onClick={() => del('durations', x.id)}/>])}/><Pagination page={durationPage} pageCount={durationPageCount} onChange={setDurationPage}/></Section>}
      {tab === tabs[1] && <Section title="Sản phẩm có bảo hành / không bảo hành" note="Quản lý hình thức áp dụng theo danh mục." add={() => set('products', [...data.products, { id: Date.now(), category: '', status: statuses[0] }])} disabled={!canEdit}><Table heads={['Danh mục sản phẩm', 'Chính sách áp dụng', '']} rows={data.products.map((x) => [<CategorySelect categories={categories} disabled={!canEdit} value={x.category} onChange={(value) => row('products', x.id, 'category', value)}/>, <select disabled={!canEdit} value={x.status} onChange={(e) => row('products', x.id, 'status', e.target.value)} className={input}>{statuses.map((s) => <option key={s}>{s}</option>)}</select>, <Delete disabled={!canEdit} onClick={() => del('products', x.id)}/>])}/></Section>}
      {tab === tabs[2] && <div className="grid gap-6 lg:grid-cols-2"><List title="Điều kiện được bảo hành" values={data.conditions} disabled={!canEdit} onChange={(v) => set('conditions', v)}/><List title="Lý do từ chối bảo hành" values={data.rejections} disabled={!canEdit} onChange={(v) => set('rejections', v)}/></div>}
      {tab === tabs[3] && <Section title="Điều kiện đổi mới sản phẩm"><div className="grid max-w-3xl gap-4 sm:grid-cols-2"><Field label="Số ngày đổi lỗi ban đầu"><input disabled={!canEdit} type="number" min="0" value={data.exchange.days} onChange={(e) => set('exchange', {...data.exchange, days:+e.target.value})} className={input}/></Field><div className="space-y-3 pt-7"><Check disabled={!canEdit} label="Cho phép đổi cùng sản phẩm" checked={data.exchange.same} onChange={(v) => set('exchange',{...data.exchange,same:v})}/><Check disabled={!canEdit} label="Cho phép đổi sản phẩm khác" checked={data.exchange.other} onChange={(v) => set('exchange',{...data.exchange,other:v})}/><Check disabled={!canEdit} label="Trừ tồn kho sản phẩm đổi mới" checked={data.exchange.deduct} onChange={(v) => set('exchange',{...data.exchange,deduct:v})}/></div><Field wide label="Ghi chú chính sách đổi mới"><textarea disabled={!canEdit} value={data.exchange.note} onChange={(e) => set('exchange',{...data.exchange,note:e.target.value})} className={area}/></Field></div></Section>}
      {tab === tabs[4] && <Receipt value={data.receipt} disabled={!canEdit} onChange={(v) => set('receipt',v)}/>} 
      {tab === tabs[5] && <Section title="Phân quyền chỉnh chính sách" note="Quyền được quản lý theo vai trò tài khoản."><Table heads={['Vai trò','Quyền hạn','Trạng thái']} rows={[["Chủ cửa hàng","Xem, thêm, sửa, bật/tắt chính sách","Được chỉnh sửa"],["Quản lý","Xem, thêm, sửa, bật/tắt chính sách","Được chỉnh sửa"],["Nhân viên","Xem và xử lý theo chính sách","Chỉ xem"]]}/></Section>}
      {tab === tabs[6] && <Section title="Lịch sử thay đổi chính sách" note="Lịch sử chỉ xem và không thể xóa."><Table heads={['Thời gian','Người chỉnh','Loại chính sách','Nội dung trước','Nội dung sau']} rows={data.history.length ? data.history.map((x) => [new Date(x.time).toLocaleString('vi-VN'),x.user,x.type,x.before,x.after]) : [['Chưa có thay đổi','','','','']]}/></Section>}
    </div>
    <div className="sticky -bottom-4 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t bg-white px-4 py-4 shadow-[0_-8px_20px_rgba(15,23,42,0.06)] sm:-bottom-6 sm:-mx-6 sm:px-6"><p className="hidden max-w-3xl text-xs leading-5 text-gray-600 md:block">Thiết lập mới chỉ áp dụng cho hóa đơn mới. Phiếu bảo hành và hóa đơn đã bán giữ nguyên chính sách tại thời điểm phát hành.</p><div className="grid w-full grid-cols-2 gap-2 md:flex md:w-auto"><button onClick={onClose} className="h-10 border border-gray-300 px-3 text-sm font-semibold sm:px-5">Hủy</button><button disabled={!canEdit} onClick={() => setShowConfirm(true)} className="h-10 bg-brand-strong px-3 text-sm font-semibold text-white disabled:bg-gray-300 sm:px-5">Lưu thiết lập</button></div></div>
    {showConfirm && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-950">Xác nhận lưu thiết lập</h3>
        <p className="mt-3 text-sm leading-6 text-gray-700">Bạn có chắc chắn muốn lưu các thay đổi trong chính sách bảo hành?</p>
        <div className="mt-4 border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          Chính sách mới chỉ áp dụng cho hóa đơn mới. Các hóa đơn và phiếu bảo hành đã phát hành sẽ không bị thay đổi.
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={() => setShowConfirm(false)} className="h-10 border border-gray-300 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">Quay lại chỉnh sửa</button>
          <button type="button" onClick={save} className="h-10 bg-brand-strong px-4 text-sm font-semibold text-white hover:bg-brand-deep">Xác nhận lưu</button>
        </div>
      </div>
    </div>}
  </Modal>;
}
function Receipt({value,disabled,onChange}) { const s=(k,v)=>onChange({...value,[k]:v}); return <Section title="Nội dung phiếu bảo hành" note="Thông tin hiển thị và in trên phiếu."><div className="grid gap-4 sm:grid-cols-2"><Field label="Tên cửa hàng"><input disabled={disabled} value={value.store} onChange={e=>s('store',e.target.value)} className={input}/></Field><Field label="Số điện thoại hỗ trợ"><input disabled={disabled} value={value.phone} onChange={e=>s('phone',e.target.value)} className={input}/></Field><Field wide label="Địa chỉ"><input disabled={disabled} value={value.address} onChange={e=>s('address',e.target.value)} className={input}/></Field><Field wide label="Nội dung chính sách ngắn"><textarea disabled={disabled} value={value.policy} onChange={e=>s('policy',e.target.value)} className={area}/></Field><Field wide label="Ghi chú cuối phiếu"><textarea disabled={disabled} value={value.footer} onChange={e=>s('footer',e.target.value)} className={area}/></Field><Check disabled={disabled} label="Hiển thị QR tra cứu bảo hành" checked={value.qr} onChange={v=>s('qr',v)}/></div></Section> }
function List({title,values,disabled,onChange}) { return <Section title={title}><div className="space-y-2">{values.map((x,i)=><div key={i} className="flex gap-2"><input disabled={disabled} value={x} onChange={e=>onChange(values.map((v,j)=>j===i?e.target.value:v))} className={input}/><Delete disabled={disabled} onClick={()=>onChange(values.filter((_,j)=>j!==i))}/></div>)}<button disabled={disabled} onClick={()=>onChange([...values,''])} className="inline-flex items-center gap-2 border px-3 py-2 text-sm font-semibold disabled:opacity-40"><Plus size={15}/>Thêm nội dung</button></div></Section> }
function Section({title,note,add,disabled,children}) { return <section><div className="mb-4 flex justify-between gap-3"><div><h3 className="font-semibold text-gray-950">{title}</h3>{note&&<p className="mt-1 text-sm text-gray-600">{note}</p>}</div>{add&&<button disabled={disabled} onClick={add} className="inline-flex h-9 items-center gap-2 bg-brand-strong px-3 text-sm font-semibold text-white disabled:bg-gray-300"><Plus size={15}/>Thêm chính sách</button>}</div>{children}</section> }
function Table({heads,rows}) { return <div className="overflow-x-auto border"><table className="min-w-full text-left text-sm"><thead className="bg-gray-50"><tr>{heads.map((x,i)=><th key={i} className="whitespace-nowrap px-3 py-3">{x}</th>)}</tr></thead><tbody className="divide-y">{rows.map((r,i)=><tr key={i}>{r.map((x,j)=><td key={j} className="min-w-32 px-3 py-3 text-gray-700">{x}</td>)}</tr>)}</tbody></table></div> }
function Pagination({ page, pageCount, onChange }) {
  if (pageCount <= 1) return null;
  const pages = Array.from(new Set([1, page - 1, page, page + 1, pageCount])).filter((value) => value >= 1 && value <= pageCount).sort((a, b) => a - b);
  return <div className="mt-3 flex items-center justify-end gap-1" aria-label="Phân trang thời gian bảo hành">
    <button type="button" disabled={page === 1} onClick={() => onChange(page - 1)} className="h-9 min-w-9 border border-gray-300 px-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40" aria-label="Trang trước">&lt;</button>
    {pages.map((value, index) => <span key={value} className="contents">
      {index > 0 && value - pages[index - 1] > 1 && <span className="grid h-9 min-w-7 place-items-center text-sm text-gray-500">…</span>}
      <button type="button" onClick={() => onChange(value)} className={`h-9 min-w-9 border px-3 text-sm font-semibold ${page === value ? 'border-brand-strong bg-brand-strong text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`} aria-current={page === value ? 'page' : undefined}>{value}</button>
    </span>)}
    <button type="button" disabled={page === pageCount} onClick={() => onChange(page + 1)} className="h-9 min-w-9 border border-gray-300 px-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40" aria-label="Trang sau">&gt;</button>
  </div>;
}
function Field({label,wide,children}) { return <label className={wide?'sm:col-span-2':''}><span className="mb-1 block text-sm font-medium">{label}</span>{children}</label> }
function Check({label,checked,disabled,onChange}) { return <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={disabled} checked={checked} onChange={e=>onChange(e.target.checked)} className="h-4 w-4 accent-brand"/>{label}</label> }
function Delete({disabled,onClick}) { return <button disabled={disabled} onClick={onClick} className="p-2 text-gray-500 hover:text-red-600 disabled:opacity-30"><Trash2 size={16}/></button> }
function NumberInput({ value, disabled, onChange }) {
  const handleChange = (event) => {
    const raw = event.target.value;
    if (raw === '') { onChange(''); return; }
    if (/^\d+$/.test(raw)) onChange(String(Number(raw)));
  };
  return <input disabled={disabled} type="text" inputMode="numeric" value={value ?? ''} onChange={handleChange} onBlur={() => { if (value === '') onChange(0); }} className={input}/>;
}
function CategorySelect({ categories, value, disabled, onChange }) {
  const hasCurrentValue = value && !categories.some((category) => category.name === value);
  return <select disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} className={input}>
    <option value="">Chọn danh mục</option>
    {hasCurrentValue && <option value={value}>{value}</option>}
    {categories.map((category) => <option key={category.id || category.name} value={category.name}>{category.name}</option>)}
  </select>;
}
