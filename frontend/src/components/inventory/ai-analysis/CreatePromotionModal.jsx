import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../../Modal';
import { savePromotion } from '../../../services/promotionService';

const todayISO = () => new Date().toISOString().slice(0, 10);

const addDaysISO = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const productLabel = (product) => {
  const code = product.sku || product.barcode || `SKU-${String(product.id).padStart(5, '0')}`;
  return `${code} - ${product.name}`;
};

export default function CreatePromotionModal({ product, onClose }) {
  const [discount, setDiscount] = useState(0);

  useEffect(() => setDiscount(product?.suggestedDiscount || 0), [product]);

  if (!product) return null;

  const submit = async (event) => {
    event.preventDefault();
    const now = Date.now();

    await savePromotion({
      code: `AI${product.id}-${now.toString().slice(-5)}`,
      name: `Ưu đãi ${product.name}`,
      promotionType: 'standard',
      discountType: 'percent',
      discountValue: Number(discount),
      minOrder: 0,
      maxOrder: 0,
      maxDiscount: 0,
      scope: 'Theo sản phẩm cụ thể',
      categoryId: '',
      productId: product.id,
      deviceFamily: '',
      targetName: productLabel(product),
      condition: `Sản phẩm bán chậm - cảnh báo ${product.alertLevel}`,
      description: product.analysisComment || product.actionSuggestion || `Ưu đãi cho ${product.name}`,
      startDate: todayISO(),
      endDate: addDaysISO(30),
      status: 'active',
      enabled: true,
      buyProductId: '',
      buyQuantity: 1,
      giftProductId: '',
      giftQuantity: 1,
      quantityTiers: []
    });

    toast.success('Đã tạo khuyến mãi từ gợi ý phân tích');
    onClose();
  };

  return (
    <Modal isOpen onClose={onClose} title="Tạo khuyến mãi từ phân tích">
      <form onSubmit={submit} className="space-y-4">
        <div className="bg-sky-50 p-3 text-sm">
          <p className="font-bold text-gray-950">{product.name}</p>
          <p className="mt-1 text-gray-600">{product.category_name} · {product.device_model || product.device_family || 'Dùng chung'}</p>
        </div>
        <label className="block text-sm font-semibold text-gray-700">
          Lý do
          <textarea readOnly value={product.analysisComment || ''} className="mt-1 min-h-24 w-full border border-gray-300 bg-gray-50 p-3 font-normal" />
        </label>
        <label className="block text-sm font-semibold text-gray-700">
          Mức giảm gợi ý (%)
          <input type="number" min="0" max="100" value={discount} onChange={(event) => setDiscount(event.target.value)} className="mt-1 h-10 w-full border border-gray-300 px-3" />
        </label>
        {product.alertLevel === 'low' && <p className="text-xs text-amber-700">Mức thấp chỉ nên tiếp tục theo dõi; bạn vẫn có thể chủ động tạo ưu đãi nếu cần.</p>}
        <p className="text-xs text-gray-500">AI chỉ đưa ra gợi ý. Người quản lý quyết định mức giảm và việc kích hoạt chương trình.</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="border px-4 py-2 text-sm font-bold">Hủy</button>
          <button type="submit" disabled={Number(discount) <= 0} className="bg-[#69afd6] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Tạo khuyến mãi</button>
        </div>
      </form>
    </Modal>
  );
}
