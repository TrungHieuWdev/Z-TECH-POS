import { createHash } from 'node:crypto';

const GEMINI_API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
const CACHE_TTL_MS = 5 * 60 * 1000;
const analysisCache = new Map();

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    executiveSummary: { type: 'string', description: 'Tóm tắt tối đa 2 câu bằng tiếng Việt.' },
    healthScore: { type: 'integer', minimum: 0, maximum: 100 },
    outlook: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
    findings: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          insight: { type: 'string' },
          severity: { type: 'string', enum: ['positive', 'info', 'warning', 'critical'] },
          evidence: { type: 'array', maxItems: 2, items: { type: 'string' } }
        },
        required: ['title', 'insight', 'severity', 'evidence']
      }
    },
    actions: {
      type: 'array',
      maxItems: 2,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          reason: { type: 'string' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
          evidence: { type: 'string' }
        },
        required: ['title', 'reason', 'priority', 'evidence']
      }
    }
  },
  required: ['executiveSummary', 'healthScore', 'outlook', 'findings', 'actions']
};

function compactText(value, maxLength = 400) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function parseJsonContent(content) {
  const cleaned = String(content || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

function sanitizeResult(value) {
  return {
    executiveSummary: compactText(value.executiveSummary, 450),
    healthScore: Math.min(100, Math.max(0, Math.round(Number(value.healthScore) || 0))),
    outlook: ['positive', 'neutral', 'negative'].includes(value.outlook) ? value.outlook : 'neutral',
    findings: (value.findings || []).slice(0, 3).map((item) => ({
      title: compactText(item.title, 100),
      insight: compactText(item.insight, 240),
      severity: ['positive', 'info', 'warning', 'critical'].includes(item.severity) ? item.severity : 'info',
      evidence: (item.evidence || []).slice(0, 2).map((entry) => compactText(entry, 150)).filter(Boolean)
    })).filter((item) => item.title && item.insight),
    actions: (value.actions || []).slice(0, 2).map((item) => ({
      title: compactText(item.title, 110),
      reason: compactText(item.reason, 220),
      priority: ['high', 'medium', 'low'].includes(item.priority) ? item.priority : 'medium',
      evidence: compactText(item.evidence, 160)
    })).filter((item) => item.title && item.reason)
  };
}

function responseText(payload) {
  return (payload.candidates?.[0]?.content?.parts || [])
    .map((part) => part.text || '')
    .join('')
    .trim();
}

function apiErrorMessage(status, body) {
  let detail = compactText(body, 300);
  try {
    detail = compactText(JSON.parse(body)?.error?.message, 300) || detail;
  } catch {
    // Nội dung lỗi không phải JSON thì giữ nguyên chuỗi phản hồi.
  }
  if (status === 429) return `Gemini đã vượt giới hạn sử dụng của API key${detail ? `: ${detail}` : ''}`;
  if (status === 403) return `Gemini từ chối API key hoặc project chưa được cấp quyền${detail ? `: ${detail}` : ''}`;
  return `Gemini API ${status}${detail ? `: ${detail}` : ''}`;
}

export async function analyzePosWithGemini(snapshot) {
  const model = String(process.env.GEMINI_MODEL || DEFAULT_MODEL).trim();
  const cacheKey = createHash('sha256').update(`${model}:${JSON.stringify(snapshot)}`).digest('hex');
  const cached = analysisCache.get(cacheKey);
  if (cached && Date.now() - cached.savedAt < CACHE_TTL_MS) {
    return { ...cached.value, cached: true };
  }
  if (cached) analysisCache.delete(cacheKey);

  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    throw Object.assign(new Error('Chưa cấu hình GEMINI_API_KEY trong backend/.env'), { status: 503 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(`${GEMINI_API_ROOT}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: [
              'Bạn là chuyên gia BI cho cửa hàng phụ kiện điện thoại.',
              'Báo cáo và biểu đồ đã được MySQL tạo sẵn. Chỉ viết nhận xét cực ngắn, không tạo biểu đồ và không bịa số.',
              'Mọi nhận xét và đề xuất phải có căn cứ trực tiếp từ snapshot POS được cung cấp.'
            ].join(' ')
          }]
        },
        contents: [{
          role: 'user',
          parts: [{
            text: [
              'Phân tích snapshot POS đã tổng hợp và ẩn danh dưới đây.',
              'Viết tối đa 3 phát hiện và tối đa 2 hành động thực tế bằng tiếng Việt.',
              `SNAPSHOT_POS_ANONYMIZED=${JSON.stringify(snapshot)}`
            ].join('\n')
          }]
        }],
        generationConfig: {
          temperature: 0.15,
          maxOutputTokens: 900,
          thinkingConfig: { thinkingLevel: 'minimal' },
          responseMimeType: 'application/json',
          responseJsonSchema: RESPONSE_SCHEMA
        }
      })
    });

    if (!response.ok) {
      const body = await response.text();
      const status = response.status === 429 ? 429 : 502;
      throw Object.assign(new Error(apiErrorMessage(response.status, body)), { status });
    }

    const payload = await response.json();
    const content = responseText(payload);
    if (!content) {
      const finishReason = payload.candidates?.[0]?.finishReason;
      throw Object.assign(new Error(`Gemini không trả về nội dung phân tích${finishReason ? ` (${finishReason})` : ''}`), { status: 502 });
    }

    const result = sanitizeResult(parseJsonContent(content));
    if (!result.executiveSummary) {
      throw Object.assign(new Error('Kết quả Gemini chưa đầy đủ, vui lòng phân tích lại'), { status: 502 });
    }

    const value = {
      ...result,
      provider: 'Google Gemini',
      model: payload.modelVersion || model,
      analyzedAt: new Date().toISOString(),
      cached: false
    };
    analysisCache.set(cacheKey, { savedAt: Date.now(), value });
    if (analysisCache.size > 30) analysisCache.delete(analysisCache.keys().next().value);
    return value;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw Object.assign(new Error('Gemini phản hồi quá thời gian 60 giây'), { status: 504 });
    }
    if (error instanceof SyntaxError) {
      throw Object.assign(new Error('Gemini trả về JSON không hợp lệ'), { status: 502 });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
