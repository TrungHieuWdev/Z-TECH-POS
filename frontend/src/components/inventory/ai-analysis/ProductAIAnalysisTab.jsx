import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Modal from '../../Modal';
import ProductAIHeader from './ProductAIHeader';
import ProductAIFilters from './ProductAIFilters';
import ProductAlertList from './ProductAlertList';
import CreatePromotionModal from './CreatePromotionModal';
import SalesOpportunityPanel from './SalesOpportunityPanel';

export default function ProductAIAnalysisTab({ analysis }) {
  const [categories, setCategories] = useState([]);
  const [promotionProduct, setPromotionProduct] = useState(null);
  const [detailProduct, setDetailProduct] = useState(null);
  const [view, setView] = useState('opportunities');
  useEffect(() => { api.get('/categories').then((response) => setCategories(response.data || [])).catch(() => {}); }, []);
  const refresh = async () => { try { await analysis.refresh(); toast.success('Đã làm mới kết quả phân tích'); } catch (e) { toast.error(e.response?.data?.message || 'Không thể làm mới phân tích'); } };
  return <section className="space-y-4 bg-[#f8fafc] p-4">
    <ProductAIHeader onRefresh={refresh} loading={analysis.loading}/>
    <div className="flex border-b border-gray-200 bg-white"><button type="button" onClick={() => setView('opportunities')} className={`px-5 py-3 text-sm font-bold ${view === 'opportunities' ? 'border-b-2 border-sky-600 text-sky-700' : 'text-gray-500'}`}>Cơ hội bán hàng AI</button><button type="button" onClick={() => setView('inventory')} className={`px-5 py-3 text-sm font-bold ${view === 'inventory' ? 'border-b-2 border-sky-600 text-sky-700' : 'text-gray-500'}`}>Cảnh báo tồn kho</button></div>
    {view === 'opportunities' ? <SalesOpportunityPanel/> : <>
      <div className="border-l-4 border-[#69afd6] bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-900">Trợ lý AI giúp phát hiện nhanh sản phẩm tồn kho cao, bán chậm và đề xuất hướng xử lý phù hợp để tối ưu dòng vốn.</div>
      <div className="border border-gray-200 bg-white p-3"><ProductAIFilters filters={analysis.filters} onChange={analysis.setFilters} categories={categories}/></div>
      <ProductAlertList products={analysis.products} loading={analysis.loading} error={analysis.error} onRetry={analysis.reload} onCreatePromotion={setPromotionProduct} onView={setDetailProduct}/>
    </>}
    <CreatePromotionModal product={promotionProduct} onClose={() => setPromotionProduct(null)}/>
    <Modal isOpen={Boolean(detailProduct)} onClose={() => setDetailProduct(null)} title="Chi tiết phân tích sản phẩm">{detailProduct && <div className="space-y-3 text-sm"><p className="text-lg font-bold">{detailProduct.name}</p><p><b>SKU/Barcode:</b> {detailProduct.sku || detailProduct.barcode || 'Chưa có'}</p><p><b>Danh mục:</b> {detailProduct.category_name || '-'}</p><p><b>Dòng máy:</b> {detailProduct.device_model || detailProduct.device_family || 'Dùng chung'}</p><p><b>Nhận xét:</b> {detailProduct.analysisComment}</p><p className="text-sky-800"><b>Gợi ý xử lý:</b> {detailProduct.actionSuggestion}</p></div>}</Modal>
  </section>;
}
