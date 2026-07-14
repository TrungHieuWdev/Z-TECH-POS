import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePosWithGemini } from '../services/geminiRevenueAnalysisService.js';

const modelResult = {
  executiveSummary: 'Doanh thu ổn định.',
  healthScore: 72,
  outlook: 'neutral',
  findings: [{ title: 'Doanh thu', insight: 'Doanh thu có giao dịch.', severity: 'info', evidence: ['1.000.000 đồng'] }],
  actions: [{ title: 'Theo dõi', reason: 'Cần thêm lịch sử', priority: 'low', evidence: '14 ngày dữ liệu' }]
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
    assert.equal(result.findings.length, 1);
    assert.equal(request.options.headers['x-goog-api-key'], 'gemini_server_test');
    assert.doesNotMatch(request.url, /gemini_server_test/);
    const body = JSON.parse(request.options.body);
    assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, 'minimal');
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.equal(body.generationConfig.responseJsonSchema.type, 'object');

    const cached = await analyzePosWithGemini(snapshot);
    assert.equal(cached.cached, true);
    assert.equal(fetchCount, 1);
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
