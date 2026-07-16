import { createHash } from 'node:crypto';
import { query } from '../config/db.js';

function parseJson(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeHistoryRow(row, { includeResult = false } = {}) {
  const item = {
    id: Number(row.id),
    periodFrom: row.period_from,
    periodTo: row.period_to,
    filters: parseJson(row.filters_json, {}),
    executiveSummary: row.executive_summary,
    healthScore: Number(row.health_score || 0),
    outlook: row.outlook,
    provider: row.provider,
    model: row.model,
    analyzedAt: row.analyzed_at,
    createdAt: row.created_at,
    requestedBy: row.requested_by
      ? {
        id: Number(row.requested_by),
        name: row.requested_by_name,
        employeeCode: row.requested_by_employee_code
      }
      : null
  };

  if (includeResult) item.result = parseJson(row.result_json, null);
  return item;
}

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

export async function listAiReportAnalyses({ page, limit, search = '' }) {
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 5));
  const offset = (safePage - 1) * safeLimit;
  const searchPattern = `%${search}%`;
  const where = search
    ? `WHERE analysis.report_type = 'revenue'
       AND (
         analysis.executive_summary LIKE ?
         OR analysis.model LIKE ?
         OR requester.name LIKE ?
         OR requester.employee_code LIKE ?
       )`
    : `WHERE analysis.report_type = 'revenue'`;
  const searchParams = search ? [searchPattern, searchPattern, searchPattern, searchPattern] : [];

  const [rows, countRows] = await Promise.all([
    query(
      `SELECT
         analysis.id,
         analysis.requested_by,
         DATE_FORMAT(analysis.period_from, '%Y-%m-%d') AS period_from,
         DATE_FORMAT(analysis.period_to, '%Y-%m-%d') AS period_to,
         analysis.filters_json,
         analysis.executive_summary,
         analysis.health_score,
         analysis.outlook,
         analysis.provider,
         analysis.model,
         DATE_FORMAT(analysis.analyzed_at, '%Y-%m-%d %H:%i:%s') AS analyzed_at,
         DATE_FORMAT(analysis.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
         requester.name AS requested_by_name,
         requester.employee_code AS requested_by_employee_code
       FROM ai_report_analysis_results analysis
       LEFT JOIN users requester ON requester.id = analysis.requested_by
       ${where}
       ORDER BY analysis.analyzed_at DESC, analysis.id DESC
       LIMIT ${safeLimit} OFFSET ${offset}`,
      searchParams
    ),
    query(
      `SELECT COUNT(*) AS total
       FROM ai_report_analysis_results analysis
       LEFT JOIN users requester ON requester.id = analysis.requested_by
       ${where}`,
      searchParams
    )
  ]);

  return {
    items: rows.map((row) => normalizeHistoryRow(row)),
    total: Number(countRows[0]?.total || 0)
  };
}

export async function getAiReportAnalysisById(id) {
  const rows = await query(
    `SELECT
       analysis.id,
       analysis.requested_by,
       DATE_FORMAT(analysis.period_from, '%Y-%m-%d') AS period_from,
       DATE_FORMAT(analysis.period_to, '%Y-%m-%d') AS period_to,
       analysis.filters_json,
       analysis.result_json,
       analysis.executive_summary,
       analysis.health_score,
       analysis.outlook,
       analysis.provider,
       analysis.model,
       DATE_FORMAT(analysis.analyzed_at, '%Y-%m-%d %H:%i:%s') AS analyzed_at,
       DATE_FORMAT(analysis.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
       requester.name AS requested_by_name,
       requester.employee_code AS requested_by_employee_code
     FROM ai_report_analysis_results analysis
     LEFT JOIN users requester ON requester.id = analysis.requested_by
     WHERE analysis.id = ? AND analysis.report_type = 'revenue'
     LIMIT 1`,
    [id]
  );

  return rows[0] ? normalizeHistoryRow(rows[0], { includeResult: true }) : null;
}

export async function deleteAiReportAnalysisById(id) {
  const result = await query(
    `DELETE FROM ai_report_analysis_results
     WHERE id = ? AND report_type = 'revenue'`,
    [id]
  );
  return Number(result.affectedRows || 0);
}
