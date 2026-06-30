import { useEffect, useMemo, useState } from 'react';
import { Gift, PackagePlus, RefreshCw, ShoppingBasket } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import { buildSalesOpportunities } from '../../../utils/salesOpportunityRules';
import { getPromotions, savePromotions } from '../../../services/promotionService';

const typeMeta = {
  buy_get: ['Mua X tặng Y', Gift],
  combo: ['Combo mua chung', ShoppingBasket],
  tier: ['Giảm theo số lượng', PackagePlus]
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const addDaysISO = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const productLabel = (product) => {
  if (!product) return '';
  const code = product.sku || product.barcode || `SKU-${String(product.id).padStart(5, '0')}`;
  return `${code} - ${product.name}`;
};

export default function SalesOpportunityPanel() {
  const [days, setDays] = useState(90);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aiStrategies, setAiStrategies] = useState([]);
  const [aiStatus, setAiStatus] = useState('idle');
  const [aiModel, setAiModel] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      setAiStrategies([]);
      setAiStatus('loading');
      const raw = (await api.get('/inventory/sales-opportunities', { params: { days } })).data;
      setData(raw);
      const candidates = buildSalesOpportunities(raw);
      if (!candidates.length) {
        setAiStatus('fallback');
        return;
      }
      try {
        const result = (await api.post('/inventory/sales-opportunities/ai', { days, orderCount: raw.orderCount, candidates })).data;
        if (result.configured && result.strategies?.length) {
          setAiStrategies(result.strategies);
          setAiModel(result.model || 'Hugging Face');
          setAiStatus('ai');
        } else {
          setAiStatus('fallback');
        }
      } catch {
        setAiStatus('fallback');
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Không thể phân tích cơ hội bán hàng');
      setAiStatus('fallback');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [days]);

  const ruleIdeas = useMemo(() => buildSalesOpportunities(data || {}), [data]);

  const ideas = useMemo(() => {
    if (!aiStrategies.length) return ruleIdeas;
    const byId = new Map(ruleIdeas.map((idea) => [String(idea.id), idea]));
    return aiStrategies.map((strategy) => {
      const source = byId.get(String(strategy.candidateId));
      return source ? {
        ...source,
        title: strategy.title || source.title,
        reason: strategy.reason || source.reason,
        goal: strategy.goal || source.goal,
        customerInsight: strategy.customerInsight,
        discount: strategy.discountPercent || source.discount,
        aiConfidenceLabel: strategy.confidenceLabel
      } : null;
    }).filter(Boolean);
  }, [ruleIdeas, aiStrategies]);

  const create = (idea) => {
    const now = Date.now();
    const common = {
      id: now,
      code: `AI${now.toString().slice(-6)}`,
      name: idea.title,
      description: `${idea.reason} Mục tiêu: ${idea.goal}`,
      startDate: todayISO(),
      endDate: addDaysISO(30),
      status: 'active',
      enabled: true,
      minOrder: 0,
      maxOrder: 0,
      maxDiscount: 0,
      categoryId: '',
      productId: '',
      deviceFamily: '',
      discountValue: Number(idea.discount || 0),
      buyProductId: '',
      buyQuantity: 1,
      giftProductId: '',
      giftQuantity: 1,
      quantityTiers: []
    };

    const promotion = idea.type === 'buy_get'
      ? {
          ...common,
          promotionType: 'buy_x_get_y',
          discountType: 'buy_x_get_y',
          discountValue: 0,
          productId: idea.base.id,
          buyProductId: idea.base.id,
          giftProductId: idea.addon.id,
          scope: 'Theo sản phẩm cụ thể',
          targetName: `${productLabel(idea.base)} + ${productLabel(idea.addon)}`,
          condition: `${idea.title} - mua ${idea.base.name} tặng ${idea.addon.name}`
        }
      : idea.type === 'tier'
        ? {
            ...common,
            promotionType: 'quantity_tier',
            discountType: 'quantity_tier',
            discountValue: 0,
            productId: idea.base.id,
            targetName: productLabel(idea.base),
            scope: 'Theo sản phẩm cụ thể',
            quantityTiers: [{ quantity: 2, percent: 5 }, { quantity: 3, percent: 10 }],
            condition: 'Mua 2 giảm 5%, mua 3 giảm 10%'
          }
        : {
            ...common,
            promotionType: 'standard',
            discountType: 'percent',
            discountValue: Number(idea.discount || 0),
            productId: idea.addon.id,
            targetName: productLabel(idea.addon),
            scope: 'Theo sản phẩm cụ thể',
            condition: `Mua kèm ${idea.base.name}`
          };

    savePromotions([promotion, ...getPromotions([])]);
    toast.success('Đã tạo chương trình từ gợi ý AI');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border border-sky-200 bg-sky-50 p-4">
        <div>
          <h3 className="font-extrabold text-sky-950">Cơ hội bán hàng từ hành vi mua thực tế</h3>
          <p className="mt-1 text-sm text-sky-800">Phân tích sản phẩm mua chung, độ liên quan, tồn kho và lợi nhuận để tạo chiến lược khác nhau.</p>
        </div>
        <div className="flex gap-2">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-10 border bg-white px-3 text-sm">
            <option value="30">30 ngày</option>
            <option value="60">60 ngày</option>
            <option value="90">90 ngày</option>
          </select>
          <button onClick={load} className="grid h-10 w-10 place-items-center bg-[#69afd6] text-white"><RefreshCw size={17} /></button>
        </div>
      </div>

      {data && <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-gray-500">
        <p>Phân tích từ {data.orderCount} hóa đơn hoàn thành · Chỉ hiển thị mối liên quan có ý nghĩa</p>
        <span className={`px-2 py-1 ${aiStatus === 'ai' ? 'bg-violet-50 text-violet-700' : 'bg-amber-50 text-amber-700'}`}>
          {aiStatus === 'loading' ? 'Hugging Face đang suy luận…' : aiStatus === 'ai' ? `Hugging Face · ${aiModel}` : 'Chế độ dự phòng rule-based'}
        </span>
      </div>}

      {loading ? <div className="p-12 text-center text-sm text-gray-500">Đang tổng hợp dữ liệu và yêu cầu Hugging Face phân tích...</div>
        : error ? <div className="border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>
          : !ideas.length ? <div className="border border-dashed p-10 text-center text-gray-500">Chưa đủ hóa đơn mua chung để đưa ra gợi ý đáng tin cậy.</div>
            : <div className="grid gap-3 xl:grid-cols-2">
                {ideas.map((idea) => {
                  const [label, Icon] = typeMeta[idea.type];
                  return <article key={idea.id} className="border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="inline-flex items-center gap-1.5 bg-sky-50 px-2 py-1 text-xs font-bold text-sky-700"><Icon size={14} />{label}</span>
                        <h4 className="mt-2 font-extrabold text-gray-950">{idea.title}</h4>
                      </div>
                      {idea.confidence && <span className="text-xs font-bold text-emerald-700">Tin cậy {(idea.confidence * 100).toFixed(0)}%</span>}
                    </div>
                    {idea.customerInsight && <p className="mt-3 border-l-2 border-violet-300 pl-3 text-sm font-semibold text-violet-800">Góc nhìn khách hàng: {idea.customerInsight}</p>}
                    <p className="mt-3 text-sm leading-6 text-gray-600">{idea.reason}</p>
                    <p className="mt-2 text-sm font-semibold text-sky-800">Mục tiêu: {idea.goal}</p>
                    <button onClick={() => create(idea)} className="mt-4 h-10 w-full bg-[#69afd6] text-sm font-bold text-white hover:bg-[#579fc8]">Dùng gợi ý này</button>
                  </article>;
                })}
              </div>}
    </div>
  );
}
