import api from '../api/axios';

const root = '/reports/revenue';

export async function loadRevenueDashboard(params) {
  const [summary, trend, categories, payments, topProducts, stockAlerts] = await Promise.all([
    api.get(`${root}/summary`, { params, cache: false }),
    api.get(`${root}/trend`, { params, cache: false }),
    api.get(`${root}/categories`, { params, cache: false }),
    api.get(`${root}/payment-methods`, { params, cache: false }),
    api.get(`${root}/products`, { params: { ...params, page: 1, limit: 5, search: '', sortBy: 'netRevenue', sortOrder: 'desc' }, cache: false })
      .catch(() => ({ data: { items: [] } })),
    api.get(`${root}/stock-alerts`, { params, cache: false })
      .catch(() => ({ data: { suggestions: [], unavailable: true } }))
  ]);
  return {
    summary: summary.data,
    trend: trend.data,
    categories: categories.data,
    payments: payments.data,
    topProducts: topProducts.data,
    stockAlerts: stockAlerts.data
  };
}

export async function runAiRevenueAnalysis(params) {
  return (await api.get(`${root}/ai-analysis`, { params, cache: false, timeout: 75000 })).data;
}

export async function loadAiRevenueAnalysisHistory(params) {
  return (await api.get(`${root}/ai-analysis-history`, { params, cache: false })).data;
}

export async function loadAiRevenueAnalysisHistoryItem(id) {
  return (await api.get(`${root}/ai-analysis-history/${id}`, { cache: false })).data;
}

export async function deleteAiRevenueAnalysisHistoryItem(id) {
  return (await api.delete(`${root}/ai-analysis-history/${id}`)).data;
}

export async function loadRevenueProducts(params) {
  return (await api.get(`${root}/products`, { params, cache: false })).data;
}

export async function exportRevenueReport(params) {
  return api.get(`${root}/export`, { params, responseType: 'blob', cache: false });
}

export async function exportRevenueExcelReport(params) {
  return api.get(`${root}/export-excel`, { params, responseType: 'blob', cache: false });
}
