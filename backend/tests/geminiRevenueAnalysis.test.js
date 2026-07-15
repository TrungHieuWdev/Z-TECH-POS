import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePosWithGemini } from '../services/geminiRevenueAnalysisService.js';

const modelResult = {
  executiveSummary: 'Doanh thu ổn định.',
  healthScore: 72,
  outlook: 'neutral',
  findings: [
    { title: 'Doanh thu', insight: 'Doanh thu có giao dịch.', impact: 'Cửa hàng duy trì được dòng tiền.', severity: 'info', evidence: ['Doanh thu thuần 1.000.000 đồng', 'Lợi nhuận gộp 400.000 đồng'] },
    { title: 'Nhóm hàng', insight: 'Kính cường lực đang đóng góp nhiều nhất.', impact: 'Doanh thu đang phụ thuộc vào một nhóm hàng.', severity: 'info', evidence: ['Kính cường lực đạt 600.000 đồng', 'Tỷ trọng doanh thu đạt 60%'] },
    { title: 'Tồn kho', insight: 'Một số mặt hàng đã chạm mức tồn tối thiểu.', impact: 'Cửa hàng có thể thiếu hàng để bán.', severity: 'warning', evidence: ['Kính A còn 2 sản phẩm', 'Mức tồn tối thiểu là 3 sản phẩm'] },
    { title: 'Nhân viên', insight: 'Nhân viên có phát sinh đơn hoàn thành.', impact: 'Có căn cứ để phân công ca bán phù hợp.', severity: 'info', evidence: ['Nhân viên NV-1 hoàn thành 3 đơn', 'Doanh thu của NV-1 là 1.000.000 đồng'] }
  ],
  actions: [
    { title: 'Bổ sung sản phẩm sắp hết', reason: 'Kính A chỉ còn 2 sản phẩm, thấp hơn mức tối thiểu 3 sản phẩm.', priority: 'high', evidence: 'Tồn hiện tại 2 sản phẩm; tồn tối thiểu 3 sản phẩm.', steps: ['Kiểm tra số lượng thực tế của Kính A', 'Lập phiếu nhập bổ sung'], expectedImpact: 'Giảm nguy cơ thiếu Kính A khi khách mua.' },
    { title: 'Xử lý sản phẩm bán chậm', reason: 'Ốp B đã hơn 30 ngày chưa bán.', priority: 'medium', evidence: 'Ốp B còn 8 sản phẩm; lần bán gần nhất ngày 01/06/2026.', steps: ['Kiểm tra vị trí trưng bày Ốp B', 'Ghép ưu đãi phù hợp trong tuần'], expectedImpact: 'Tăng khả năng bán lượng Ốp B đang tồn.' },
    { title: 'Tạo gợi ý bán kèm phù hợp', reason: 'Kính A và Ốp B thường xuất hiện trong cùng đơn.', priority: 'medium', evidence: 'Hai sản phẩm xuất hiện cùng nhau trong 5 đơn của 90 ngày.', steps: ['Tạo gợi ý Kính A kèm Ốp B tại quầy', 'Theo dõi số đơn mua cùng mỗi tuần'], expectedImpact: 'Tăng số sản phẩm trên mỗi đơn hàng.' }
  ]
};

test('Gemini dùng API key server-side và trả phân tích JSON có cấu trúc', async () => {
  const oldKey = process.env.GEMINI_API_KEY;
  const oldModel = process.env.GEMINI_MODEL;
  const oldFetch = global.fetch;
  let request;
  let fetchCount = 0;
  process.env.GEMINI_API_KEY = 'gemini_server_test';
  process.env.GEMINI_MODEL = 'gemini-3.1-flash-lite';
  global.fetch = async (url, options) => {
    fetchCount += 1;
    request = { url, options };
    return {
      ok: true,
      json: async () => ({
        modelVersion: 'gemini-3.1-flash-lite',
        candidates: [{ content: { parts: [{ text: JSON.stringify(modelResult) }] } }]
      })
    };
  };

  const snapshot = { range: { from: '2026-07-01', to: '2026-07-14' }, dailyHistory: [] };
  try {
    const result = await analyzePosWithGemini(snapshot);
    assert.equal(result.provider, 'Google Gemini');
    assert.equal(result.model, 'gemini-3.1-flash-lite');
    assert.equal(result.findings.length, 4);
    assert.equal(result.findings[0].impact, 'Cửa hàng duy trì được dòng tiền.');
    assert.equal(result.actions.length, 3);
    assert.equal(result.actions[0].steps.length, 2);
    assert.equal(request.options.headers['x-goog-api-key'], 'gemini_server_test');
    assert.doesNotMatch(request.url, /gemini_server_test/);
    const body = JSON.parse(request.options.body);
    assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, 'minimal');
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.equal(body.generationConfig.responseJsonSchema.type, 'object');
    assert.equal(body.generationConfig.responseJsonSchema.properties.findings.maxItems, 4);
    assert.equal(body.generationConfig.responseJsonSchema.properties.actions.maxItems, 3);
    const prompt = body.contents[0].parts[0].text;
    assert.match(prompt, /Doanh thu, Nhóm hàng, Tồn kho, Nhân viên/);
    assert.match(prompt, /Bổ sung sản phẩm sắp hết; Xử lý sản phẩm bán chậm; Tạo gợi ý bán kèm phù hợp/);

    const cached = await analyzePosWithGemini(snapshot);
    assert.equal(cached.cached, true);
    assert.equal(fetchCount, 1);

    global.fetch = async (url, options) => {
      fetchCount += 1;
      request = { url, options };
      return {
        ok: true,
        json: async () => ({
          modelVersion: 'gemini-3.1-flash-lite',
          candidates: [{ content: { parts: [{ text: JSON.stringify({
            ...modelResult,
            executiveSummary: 'Kho hôm nay cần ưu tiên xử lý các mặt hàng tồn thấp.',
            findings: modelResult.findings.slice(1)
          }) }] } }]
        })
      };
    };
    const todayResult = await analyzePosWithGemini({ range: { from: '2026-07-15', to: '2026-07-15' }, dailyHistory: [] });
    assert.deepEqual(todayResult.findings.map((item) => item.title), ['Nhóm hàng', 'Tồn kho', 'Nhân viên']);
    assert.doesNotMatch(todayResult.findings.map((item) => item.title).join(','), /Doanh thu/);
    const todayPrompt = JSON.parse(request.options.body).contents[0].parts[0].text;
    assert.match(todayPrompt, /Không tạo mục Doanh thu/);
    assert.equal(fetchCount, 2);
  } finally {
    global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey;
    if (oldModel === undefined) delete process.env.GEMINI_MODEL; else process.env.GEMINI_MODEL = oldModel;
  }
});

test('thiếu GEMINI_API_KEY thì không gọi dịch vụ ngoài', async () => {
  const oldKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    await assert.rejects(analyzePosWithGemini({ range: { to: '2026-07-14' } }), (error) => error.status === 503);
  } finally {
    if (oldKey !== undefined) process.env.GEMINI_API_KEY = oldKey;
  }
});
