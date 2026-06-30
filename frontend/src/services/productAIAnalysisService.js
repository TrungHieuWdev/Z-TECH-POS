import api from '../api/axios';
export async function fetchProductAIAnalysis(filters) {
  const response = await api.get('/inventory/product-ai-analysis', { params: { days: filters.days, categoryId: filters.categoryId || undefined, phoneBrandId: filters.phoneBrandId || undefined } });
  return response.data;
}
export async function refreshProductAIAnalysis() {
  const response = await api.post('/inventory/product-ai-analysis/refresh');
  return response.data;
}
