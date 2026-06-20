import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { formatDate } from '../utils/format';

const statusLabels = {
  active: 'Còn bảo hành', expired: 'Hết hạn', processing: 'Đang xử lý',
  replaced: 'Đã đổi mới', rejected: 'Từ chối', initial_exchange: 'Chỉ đổi lỗi ban đầu',
  no_warranty: 'Không bảo hành'
};

export default function WarrantyLookupPublic() {
  const { publicToken } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/public/warranties/${encodeURIComponent(publicToken)}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || 'Không thể tra cứu bảo hành');
        setData(body);
      })
      .catch((requestError) => setError(requestError.message));
  }, [publicToken]);

  return <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
    <section className="mx-auto max-w-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-5">
        <ShieldCheck className="h-9 w-9 text-emerald-600" />
        <div><h1 className="text-xl font-bold">Tra cứu bảo hành Z-TECH</h1><p className="text-sm text-slate-500">Thông tin bảo hành công khai</p></div>
      </div>
      {error && <p className="mt-6 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {!data && !error && <p className="mt-6 text-sm text-slate-500">Đang tra cứu...</p>}
      {data && <dl className="mt-6 grid gap-5 sm:grid-cols-2">
        <Item label="Mã bảo hành" value={data.warrantyCode} />
        <Item label="Trạng thái" value={statusLabels[data.status] || data.status} />
        <Item label="Sản phẩm" value={data.productName} wide />
        <Item label="Ngày mua" value={formatDate(data.purchasedAt)} />
        <Item label="Hạn bảo hành" value={formatDate(data.expiresAt)} />
        <Item label="Điều kiện bảo hành" value={data.warrantyConditions || 'Không có thông tin'} wide />
      </dl>}
    </section>
  </main>;
}

function Item({ label, value, wide }) {
  return <div className={wide ? 'sm:col-span-2' : ''}><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-line text-sm font-medium">{value}</dd></div>;
}
