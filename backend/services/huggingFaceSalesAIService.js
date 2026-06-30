const HF_URL = 'https://router.huggingface.co/v1/chat/completions';
const DEFAULT_MODEL = 'Qwen/Qwen2.5-7B-Instruct-1M:cheapest';
const cache = new Map();

function clamp(value, min, max) { return Math.min(max, Math.max(min, Number(value) || 0)); }

export async function generateSalesStrategies({ days, orderCount, candidates }) {
  const token = process.env.HF_TOKEN;
  if (!token) return { configured: false, strategies: [], message: 'Chưa cấu hình HF_TOKEN' };
  const safeCandidates = (candidates || []).slice(0, 20).map((item) => ({
    candidateId: String(item.id), allowedType: item.type, baseProductId: Number(item.base?.id), addonProductId: Number(item.addon?.id || 0) || null,
    baseName: String(item.base?.name || '').slice(0, 120), addonName: String(item.addon?.name || '').slice(0, 120),
    stockBase: Number(item.base?.stock_quantity || 0), stockAddon: Number(item.addon?.stock_quantity || 0), soldBase: Number(item.base?.sold_quantity || 0), soldAddon: Number(item.addon?.sold_quantity || 0),
    confidence: Number(item.confidence || 0), lift: Number(item.lift || 0), togetherOrders: Number(item.together || 0), suggestedDiscount: Number(item.discount || 0)
  }));
  const cacheKey = JSON.stringify([days, orderCount, safeCandidates]);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < 10 * 60 * 1000) return { ...cached.value, cached: true };
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(HF_URL, { method: 'POST', signal: controller.signal, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({
      model: process.env.HF_MODEL || DEFAULT_MODEL, temperature: 0.35, max_tokens: 1800,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: 'Bạn là chuyên gia merchandising cho POS phụ kiện điện thoại Việt Nam. Chỉ dùng ứng viên được cung cấp, không bịa sản phẩm hay số liệu. Tạo chiến lược đa dạng, rõ mục tiêu, ưu tiên lợi nhuận và tồn kho. Trả JSON thuần dạng {"strategies":[{"candidateId":"...","title":"...","reason":"...","goal":"...","customerInsight":"...","recommendedType":"buy_get|combo|tier","discountPercent":0,"confidenceLabel":"Cao|Trung bình|Thấp"}]}. recommendedType phải bằng allowedType của ứng viên. discountPercent: combo 3-15, tier 3-12, buy_get 0.' }, { role: 'user', content: JSON.stringify({ analysisPeriodDays: days, completedOrders: orderCount, candidates: safeCandidates }) }]
    }) });
    if (!response.ok) throw new Error(`Hugging Face ${response.status}: ${await response.text()}`);
    const payload = await response.json(); const parsed = JSON.parse(payload.choices?.[0]?.message?.content || '{}');
    const allowed = new Map(safeCandidates.map((item) => [item.candidateId, item]));
    const strategies = (parsed.strategies || []).slice(0, 12).flatMap((item) => { const source = allowed.get(String(item.candidateId)); if (!source || item.recommendedType !== source.allowedType) return []; return [{ candidateId: String(item.candidateId), title: String(item.title || '').slice(0, 180), reason: String(item.reason || '').slice(0, 600), goal: String(item.goal || '').slice(0, 240), customerInsight: String(item.customerInsight || '').slice(0, 400), recommendedType: source.allowedType, discountPercent: source.allowedType === 'buy_get' ? 0 : clamp(item.discountPercent, 3, source.allowedType === 'combo' ? 15 : 12), confidenceLabel: ['Cao','Trung bình','Thấp'].includes(item.confidenceLabel) ? item.confidenceLabel : 'Trung bình' }]; });
    const value = { configured: true, model: payload.model || process.env.HF_MODEL || DEFAULT_MODEL, strategies };
    cache.set(cacheKey, { createdAt: Date.now(), value });
    if (cache.size > 30) cache.delete(cache.keys().next().value);
    return value;
  } finally { clearTimeout(timer); }
}
