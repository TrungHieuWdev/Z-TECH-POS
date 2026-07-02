const HF_URL = 'https://router.huggingface.co/v1/chat/completions';
const DEFAULT_MODEL = 'Qwen/Qwen2.5-7B-Instruct-1M:cheapest';
const cache = new Map();

function toCompactSuggestion(item) {
  return {
    productId: Number(item.productId),
    productName: String(item.productName || '').slice(0, 120),
    currentStock: Number(item.currentStock || 0),
    sold30Days: Number(item.sold30Days || 0),
    forecastQtyTarget: Number(item.forecastQtyTarget || 0),
    targetDays: Number(item.targetDays || 30),
    forecastDailySales: Number(item.forecastDailySales || 0),
    daysOfStockLeft: item.daysOfStockLeft === null
      ? null
      : Math.max(0, Math.round(Number(item.daysOfStockLeft))),
    reorderPoint: Number(item.reorderPoint || 0),
    suggestedQuantity: Number(item.suggestedQuantity || 0),
    priority: item.priority
  };
}

function sanitizeReason(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 420);
}

export async function generateRestockReasons(suggestions) {
  const token = process.env.HF_TOKEN;
  if (!token || !suggestions.length) {
    return { configured: Boolean(token), reasonsByProductId: new Map() };
  }

  const candidates = suggestions.slice(0, 12).map(toCompactSuggestion);
  const cacheKey = JSON.stringify(candidates);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < 10 * 60 * 1000) {
    return { ...cached.value, cached: true };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(HF_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.HF_MODEL || DEFAULT_MODEL,
        temperature: 0.2,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'Bạn là trợ lý quản lý kho cho POS phụ kiện điện thoại. Chỉ diễn giải dựa trên số liệu được cung cấp, tuyệt đối không quyết định hoặc thay đổi số lượng nhập, không bịa số liệu. Mỗi lý do phải nêu tồn kho hiện tại, nhu cầu dự báo trong kỳ mục tiêu, điểm đặt lại, số ngày còn đủ bán và vì sao đề xuất số lượng đó. Mọi số lượng và số ngày phải giữ ở dạng số nguyên, tuyệt đối không viết số thập phân. Trả về JSON thuần dạng {"reasons":[{"productId":1,"reason":"..."}]}, tiếng Việt rõ ràng, tối đa 3 câu.'
          },
          {
            role: 'user',
            content: JSON.stringify({ suggestions: candidates })
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Hugging Face ${response.status}`);
    }

    const payload = await response.json();
    const parsed = JSON.parse(payload.choices?.[0]?.message?.content || '{}');
    const allowedIds = new Set(candidates.map((item) => Number(item.productId)));
    const reasonsByProductId = new Map();

    for (const item of parsed.reasons || []) {
      const productId = Number(item.productId);
      const reason = sanitizeReason(item.reason);
      if (allowedIds.has(productId) && reason) {
        reasonsByProductId.set(productId, reason);
      }
    }

    const value = {
      configured: true,
      model: payload.model || process.env.HF_MODEL || DEFAULT_MODEL,
      reasonsByProductId
    };
    cache.set(cacheKey, { createdAt: Date.now(), value });
    if (cache.size > 30) cache.delete(cache.keys().next().value);

    return value;
  } finally {
    clearTimeout(timer);
  }
}
