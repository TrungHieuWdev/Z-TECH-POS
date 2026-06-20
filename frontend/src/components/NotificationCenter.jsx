import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Boxes, Clock3, RefreshCw } from 'lucide-react';
import api from '../api/axios';
import Modal from './Modal';
import { formatDate, formatTime } from '../utils/format';

export default function NotificationCenter({ isOpen, onClose, onCountChange }) {
  const [products, setProducts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const [productResult, activityResult] = await Promise.allSettled([
      api.get('/products'), api.get('/activity-logs', { params: { limit: 15 } })
    ]);
    if (productResult.status === 'fulfilled') setProducts(productResult.value.data || []);
    if (activityResult.status === 'fulfilled') setActivities(activityResult.value.data || []);
    setLoading(false);
  }

  useEffect(() => { load(); const timer = setInterval(load, 60000); return () => clearInterval(timer); }, []);
  const lowStock = useMemo(() => products.filter((product) => Number(product.stock_quantity || 0) <= Number(product.min_stock || 0)).sort((a, b) => Number(a.stock_quantity) - Number(b.stock_quantity)), [products]);
  useEffect(() => { onCountChange(lowStock.length); }, [lowStock.length, onCountChange]);

  return <Modal isOpen={isOpen} onClose={onClose} title="Thông báo hệ thống" maxWidth="max-w-2xl">
    <div className="flex items-center justify-between border-b pb-3">
      <p className="text-sm text-gray-600">Tự động cập nhật mỗi 60 giây</p>
      <button type="button" onClick={load} className="inline-flex h-9 items-center gap-2 border px-3 text-sm font-semibold"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>Làm mới</button>
    </div>
    <section className="mt-4">
      <h3 className="flex items-center gap-2 font-bold text-red-700"><AlertTriangle size={19}/>Cảnh báo tồn kho ({lowStock.length})</h3>
      <div className="mt-2 max-h-60 divide-y overflow-y-auto border border-red-200">
        {lowStock.length === 0 ? <p className="p-4 text-sm text-gray-500">Kho đang ổn định.</p> : lowStock.slice(0, 20).map((product) => <div key={product.id} className="flex items-center justify-between gap-3 bg-red-50 p-3">
          <div className="min-w-0"><p className="truncate text-sm font-bold text-gray-900">{product.name}</p><p className="text-xs text-gray-600">Mức tối thiểu: {Number(product.min_stock || 0)}</p></div>
          <span className="shrink-0 bg-red-600 px-2 py-1 text-xs font-bold text-white">Còn {Number(product.stock_quantity || 0)}</span>
        </div>)}
      </div>
    </section>
    <section className="mt-5">
      <h3 className="flex items-center gap-2 font-bold text-gray-900"><Clock3 size={19}/>Hoạt động gần đây</h3>
      <div className="mt-2 max-h-72 divide-y overflow-y-auto border">
        {activities.length === 0 ? <p className="p-4 text-sm text-gray-500">Chưa có hoạt động hoặc tài khoản không có quyền xem.</p> : activities.map((item) => <div key={item.id} className="flex gap-3 p-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center bg-blue-50 text-blue-700"><Boxes size={17}/></div>
          <div className="min-w-0"><p className="text-sm font-bold text-gray-900">{item.action_label}: {item.target_name || item.title}</p><p className="mt-0.5 text-xs text-gray-600">{item.actor_name} · {formatDate(item.created_at)} {formatTime(item.created_at)}</p><p className="mt-0.5 truncate text-xs text-gray-500">{item.description}</p></div>
        </div>)}
      </div>
    </section>
  </Modal>;
}
