import { useCallback, useEffect, useMemo, useState } from 'react';
import { analyzeProducts } from '../utils/productAIAnalysisRules';
import { fetchProductAIAnalysis, refreshProductAIAnalysis } from '../services/productAIAnalysisService';

export default function useProductAIAnalysis() {
  const [filters, setFilters] = useState({ days: 30, categoryId: '', phoneBrandId: '', alertLevel: '' });
  const [data, setData] = useState({ products: [], meta: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => { try { setLoading(true); setError(''); setData(await fetchProductAIAnalysis(filters)); } catch (e) { setError(e.response?.data?.message || 'Không thể tải dữ liệu phân tích.'); } finally { setLoading(false); } }, [filters.days, filters.categoryId, filters.phoneBrandId]);
  useEffect(() => { load(); }, [load]);
  const analyzedProducts = useMemo(() => analyzeProducts(data.products || [], filters.days), [data.products, filters.days]);
  const products = useMemo(() => analyzedProducts.filter((item) => !filters.alertLevel || item.alertLevel === filters.alertLevel), [analyzedProducts, filters.alertLevel]);
  const refresh = async () => { await refreshProductAIAnalysis(); await load(); };
  return { filters, setFilters, products, analyzedProducts, totalAnalyzed: (data.products || []).length, meta: data.meta || {}, loading, error, reload: load, refresh };
}
