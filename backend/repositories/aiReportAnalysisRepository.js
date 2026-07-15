import { createHash } from 'node:crypto';
import { query } from '../config/db.js';

export async function saveAiReportAnalysis({ requestedBy, filters, result }) {
  const analysisKey = createHash('sha256')
    .update(`${result.provider}:${result.model}:${result.analyzedAt}:${JSON.stringify(filters)}`)
    .digest('hex');
  const rows = await query(
    `INSERT INTO ai_report_analysis_results
      (analysis_key, requested_by, report_type, period_from, period_to, filters_json, result_json,
       executive_summary, health_score, outlook, provider, model, analyzed_at)
     VALUES (?, ?, 'revenue', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
    [
      analysisKey,
      requestedBy || null,
      filters.from,
      filters.to,
      JSON.stringify(filters),
      JSON.stringify(result),
      result.executiveSummary,
      result.healthScore,
      result.outlook,
      result.provider,
      result.model,
      new Date(result.analyzedAt)
    ]
  );

  return rows.insertId;
}
