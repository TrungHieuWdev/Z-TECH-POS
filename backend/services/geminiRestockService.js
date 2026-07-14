const GEMINI_API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
const cache = new Map();

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    reasons: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          productId: { type: 'integer' },
          reason: { type: 'string' }
        },
        required: ['productId', 'reason']
      }
    }
  },
  required: ['reasons']
};

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

function responseText(payload) {
  return (payload.candidates?.[0]?.content?.parts || []).map((part) => part.text || '').join('').trim();
}

export async function generateRestockReasons(suggestions) {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || !suggestions.length) {
    return { configured: Boolean(apiKey), reasonsByProductId: new Map() };
  }

  const model = String(process.env.GEMINI_MODEL || DEFAULT_MODEL).trim();
  const candidates = suggestions.slice(0, 12).map(toCompactSuggestion);
  const cacheKey = `${model}:${JSON.stringify(candidates)}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < 10 * 60 * 1000) {
    return { ...cached.value, cached: true };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${GEMINI_API_ROOT}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: 'Bạn là trợ lý quản lý kho cho POS phụ kiện điện thoại. Chỉ diễn giải dựa trên số liệu được cung cấp, không thay đổi số lượng nhập và không bịa số. Mỗi lý do tối đa 3 câu, dùng số nguyên.'
          }]
        },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify({ suggestions: candidates }) }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1200,
          thinkingConfig: { thinkingLevel: 'minimal' },
          responseMimeType: 'application/json',
          responseJsonSchema: RESPONSE_SCHEMA
        }
      })
    });

    if (!response.ok) throw new Error(`Gemini ${response.status}`);

    const payload = await response.json();
    const parsed = JSON.parse(responseText(payload) || '{}');
    const allowedIds = new Set(candidates.map((item) => Number(item.productId)));
    const reasonsByProductId = new Map();
    for (const item of parsed.reasons || []) {
      const productId = Number(item.productId);
      const reason = sanitizeReason(item.reason);
      if (allowedIds.has(productId) && reason) reasonsByProductId.set(productId, reason);
    }

    const value = { configured: true, model: payload.modelVersion || model, reasonsByProductId };
    cache.set(cacheKey, { createdAt: Date.now(), value });
    if (cache.size > 30) cache.delete(cache.keys().next().value);
    return value;
  } finally {
    clearTimeout(timer);
  }
}
