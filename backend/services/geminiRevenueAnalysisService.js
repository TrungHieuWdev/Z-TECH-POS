import { createHash } from 'node:crypto';

const GEMINI_API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
const CACHE_TTL_MS = 5 * 60 * 1000;
const ANALYSIS_VERSION = 'focused-v5';
const analysisCache = new Map();
const FINDING_TITLES = ['Doanh thu', 'Nhóm hàng', 'Tồn kho', 'Nhân viên'];
const TODAY_FINDING_TITLES = ['Nhóm hàng', 'Tồn kho', 'Nhân viên'];
const ACTION_TITLES = ['Bổ sung sản phẩm sắp hết', 'Xử lý sản phẩm bán chậm', 'Tạo gợi ý bán kèm phù hợp'];

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    executiveSummary: { type: 'string', description: 'Tóm tắt 2-3 câu tự nhiên bằng tiếng Việt: kết quả chính, nguyên nhân có căn cứ và việc cần làm trước.' },
    healthScore: { type: 'integer', minimum: 0, maximum: 100 },
    outlook: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
    findings: {
      type: 'array',
      minItems: 3,
      maxItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string', enum: FINDING_TITLES },
          insight: { type: 'string', description: 'Tối đa 2 câu, chỉ nói một vấn đề chính, có đối chiếu và không viết chung chung.' },
          impact: { type: 'string', description: 'Một câu ngắn giải thích ảnh hưởng trực tiếp đến doanh thu, lợi nhuận, tồn kho hoặc vận hành.' },
          severity: { type: 'string', enum: ['positive', 'info', 'warning', 'critical'] },
          evidence: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'string', description: 'Một số liệu thực tế kèm đơn vị và đối tượng được đo.' } }
        },
        required: ['title', 'insight', 'impact', 'severity', 'evidence']
      }
    },
    actions: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string', enum: ACTION_TITLES },
          reason: { type: 'string', description: 'Tối đa 2 câu, nêu đúng một sản phẩm hoặc nhóm hàng, số liệu thực tế và lý do phải làm.' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
          evidence: { type: 'string' },
          steps: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'string', description: 'Một việc cụ thể, có thể giao cho nhân viên làm ngay.' } },
          expectedImpact: { type: 'string', description: 'Một câu ngắn về kết quả thực tế có thể mong đợi, không bịa thêm con số.' }
        },
        required: ['title', 'reason', 'priority', 'evidence', 'steps', 'expectedImpact']
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
  const findings = (value.findings || []).slice(0, 4).map((item) => ({
    title: compactText(item.title, 140),
    insight: compactText(item.insight, 520),
    impact: compactText(item.impact, 260),
    severity: ['positive', 'info', 'warning', 'critical'].includes(item.severity) ? item.severity : 'info',
    evidence: (item.evidence || []).slice(0, 2).map((entry) => compactText(entry, 220)).filter(Boolean)
  })).filter((item) => FINDING_TITLES.includes(item.title) && item.insight)
    .sort((a, b) => FINDING_TITLES.indexOf(a.title) - FINDING_TITLES.indexOf(b.title));
  const actions = (value.actions || []).slice(0, 3).map((item) => ({
    title: compactText(item.title, 140),
    reason: compactText(item.reason, 420),
    priority: ['high', 'medium', 'low'].includes(item.priority) ? item.priority : 'medium',
    evidence: compactText(item.evidence, 280),
    steps: (item.steps || []).slice(0, 2).map((step) => compactText(step, 220)).filter(Boolean),
    expectedImpact: compactText(item.expectedImpact, 260)
  })).filter((item) => ACTION_TITLES.includes(item.title) && item.reason)
    .sort((a, b) => ACTION_TITLES.indexOf(a.title) - ACTION_TITLES.indexOf(b.title));

  return {
    executiveSummary: compactText(value.executiveSummary, 650),
    healthScore: Math.min(100, Math.max(0, Math.round(Number(value.healthScore) || 0))),
    outlook: ['positive', 'neutral', 'negative'].includes(value.outlook) ? value.outlook : 'neutral',
    findings,
    actions
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

function isSingleDaySnapshot(snapshot) {
  return Boolean(snapshot?.range?.from && snapshot.range.from === snapshot.range.to);
}

export async function analyzePosWithGemini(snapshot) {
  const model = String(process.env.GEMINI_MODEL || DEFAULT_MODEL).trim();
  const isSingleDay = isSingleDaySnapshot(snapshot);
  const expectedFindingTitles = isSingleDay ? TODAY_FINDING_TITLES : FINDING_TITLES;
  const cacheKey = createHash('sha256').update(`${ANALYSIS_VERSION}:${model}:${JSON.stringify(snapshot)}`).digest('hex');
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
              'Bạn là chuyên gia BI kiêm quản lý vận hành cho cửa hàng phụ kiện điện thoại quy mô nhỏ và vừa.',
              'Hãy viết như một người quản lý có kinh nghiệm đang trao đổi trực tiếp với chủ cửa hàng: tự nhiên, rõ ràng, cụ thể và dễ hành động.',
              'Mỗi nhận định chỉ tập trung vào một vấn đề quan trọng nhất, nêu điều gì đã xảy ra, bằng chứng số liệu, ảnh hưởng thực tế và nếu có thể thì nguyên nhân hợp lý.',
              'Không khẳng định nguyên nhân khi snapshot không đủ chứng minh; khi đó phải dùng cách nói "có thể" và chỉ ra dữ liệu cần kiểm tra.',
              'Không dùng những đề xuất chung chung như "đẩy mạnh bán hàng" hoặc "theo dõi thêm" nếu không nêu rõ sản phẩm hoặc nhóm hàng, việc cần làm và thời điểm thực hiện.',
              'Tuyệt đối không bịa số, không tự suy diễn nhân khẩu học, không viết lời dẫn dài và không lặp lại cùng một ý giữa phần nhận định, ảnh hưởng và hành động.',
              'Mọi câu trả lời phải thuần tiếng Việt; chỉ giữ nguyên tên riêng, mã hàng và tên sản phẩm bắt buộc.',
              'Tránh lối viết máy móc và các cụm sáo rỗng như "bức tranh tổng thể", "đáng chú ý", "tín hiệu tích cực", "đòn bẩy", "tối ưu hóa", "trong bối cảnh", "không chỉ... mà còn", "dữ liệu cho thấy", "cần lưu ý" hoặc "nên cân nhắc". Viết như quản lý cửa hàng đang nói chuyện thẳng với chủ cửa hàng.'
            ].join(' ')
          }]
        },
        contents: [{
          role: 'user',
          parts: [{
            text: [
              'Phân tích snapshot POS đã tổng hợp và ẩn danh dưới đây.',
              'Chỉ kết luận doanh thu theo range và activeFilters của snapshot. Riêng tồn kho hiện tại, hàng bán chậm và cặp bán kèm được phép dùng cửa sổ theo dõi riêng đã ghi rõ trong operations, nhưng vẫn phải tôn trọng danh mục đang lọc.',
              'Phần tóm tắt chỉ viết 2-3 câu: nói thẳng kết quả chính, lý do có căn cứ và việc cần làm trước; không mở đầu xã giao và không kết luận chung chung.',
              isSingleDay
                ? 'Bộ lọc chỉ có 1 ngày. Không tạo mục Doanh thu và không diễn giải lại doanh thu, lợi nhuận, số đơn hoặc biểu đồ đã có trong báo cáo tổng quan. Phần phân tích chi tiết phải có đúng 3 mục, đúng thứ tự: Nhóm hàng, Tồn kho, Nhân viên.'
                : 'Phần phân tích chi tiết phải có đúng 4 mục, đúng thứ tự: Doanh thu, Nhóm hàng, Tồn kho, Nhân viên.',
              isSingleDay
                ? 'Mục Nhóm hàng tập trung vào nhóm đang có rủi ro kho cần xử lý; mục Tồn kho chọn sản phẩm sắp hết hoặc bán chậm đáng xử lý nhất; mục Nhân viên chỉ nêu việc vận hành trong ngày có liên quan trực tiếp đến xử lý hàng. Chỉ được nhắc doanh thu trong phần tóm tắt bằng một vế ngắn nếu có bất thường cần xử lý ngay.'
                : 'Mục Doanh thu tập trung vào thay đổi doanh thu, lợi nhuận hoặc giá trị đơn; mục Nhóm hàng tập trung vào nhóm đóng góp hoặc suy giảm rõ nhất; mục Tồn kho tập trung vào rủi ro hàng sắp hết hoặc bán chậm lớn nhất; mục Nhân viên tập trung vào chênh lệch hiệu quả bán hàng rõ nhất.',
              isSingleDay
                ? 'Điểm đánh giá phải phản ánh sức khỏe kho và khả năng xử lý vận hành trong ngày, không chấm theo mức doanh thu.'
                : 'Điểm đánh giá phản ánh cân bằng giữa kết quả kinh doanh, tồn kho và vận hành trong kỳ đã lọc.',
              'Mỗi mục chỉ viết tối đa 2 câu phân tích và 1 câu ảnh hưởng, kèm đúng 2 dòng số liệu dẫn chứng lấy nguyên từ snapshot. Mỗi dòng phải ghi rõ con số, đơn vị và đối tượng. Không gom nhiều vấn đề vào một mục.',
              'Phần hành động phải có đúng 3 mục, đúng thứ tự và đúng tiêu đề: Bổ sung sản phẩm sắp hết; Xử lý sản phẩm bán chậm; Tạo gợi ý bán kèm phù hợp.',
              'Mỗi hành động chỉ chọn một sản phẩm, một cặp sản phẩm hoặc một nhóm hàng cần xử lý trước; nêu lý do trong tối đa 2 câu, đưa đúng 2 bước có thể giao làm ngay và 1 câu kết quả mong đợi.',
              'Ưu tiên sản phẩm có rủi ro rõ nhất theo số tồn, mức tồn tối thiểu, lần bán gần nhất hoặc số đơn mua cùng. Không liệt kê thêm sản phẩm phụ trong cùng một hành động.',
              'Nếu một mục chưa đủ căn cứ, nói thẳng đang thiếu số liệu nào; không thay bằng lời khuyên chung và không tự tạo con số.',
              `SNAPSHOT_POS_ANONYMIZED=${JSON.stringify(snapshot)}`
            ].join('\n')
          }]
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2800,
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
    const hasAllFindings = result.findings.length === expectedFindingTitles.length
      && result.findings.every((item, index) => item.title === expectedFindingTitles[index] && item.evidence.length >= 2);
    const hasAllActions = result.actions.length === ACTION_TITLES.length
      && result.actions.every((item, index) => item.title === ACTION_TITLES[index] && item.steps.length >= 2);
    if (!result.executiveSummary || !hasAllFindings || !hasAllActions) {
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
