import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ProductAlertCard from './ProductAlertCard';

const PAGE_SIZE = 5;

export default function ProductAlertList({ products, loading, error, onRetry, onCreatePromotion, onView }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const rows = useMemo(() => products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [products, page]);
  useEffect(() => { setPage(1); }, [products]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  if (loading) return <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-44 animate-pulse border border-gray-200 bg-white p-4"><div className="h-full bg-gray-100" /></div>)}</div>;
  if (error) return <div className="border border-red-200 bg-red-50 p-8 text-center"><p className="text-sm font-semibold text-red-700">{error}</p><button type="button" onClick={onRetry} className="mt-3 border border-red-300 bg-white px-4 py-2 text-sm font-bold text-red-700">Thử lại</button></div>;
  if (!products.length) return <div className="border border-dashed border-gray-300 bg-white p-12 text-center text-sm text-gray-500">Không có sản phẩm nào đạt ngưỡng cảnh báo trong bộ lọc hiện tại.</div>;

  const visiblePages = Array.from({ length: totalPages }, (_, index) => index + 1).filter((item) => item === 1 || item === totalPages || Math.abs(item - page) <= 1);
  return <div>
    <div className="space-y-3">{rows.map((product) => <ProductAlertCard key={product.id} product={product} onCreatePromotion={onCreatePromotion} onView={onView} />)}</div>
    {totalPages > 1 && <div className="mt-4 flex items-center justify-start gap-1 border-t border-gray-200 bg-white px-4 py-4">
      <PageButton disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /></PageButton>
      {visiblePages.map((item, index) => <span key={item} className="flex items-center gap-1">{index > 0 && item - visiblePages[index - 1] > 1 && <span className="px-1 text-gray-400">…</span>}<PageButton active={page === item} onClick={() => setPage(item)}>{item}</PageButton></span>)}
      <PageButton disabled={page === totalPages} onClick={() => setPage(page + 1)}><ChevronRight size={16} /></PageButton>
    </div>}
  </div>;
}

function PageButton({ children, active, disabled, onClick }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={`grid h-9 min-w-9 place-items-center border px-2 text-sm font-bold ${active ? 'border-[#69afd6] bg-[#69afd6] text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-sky-300 hover:bg-sky-50'} disabled:cursor-not-allowed disabled:text-gray-300`}>{children}</button>;
}
