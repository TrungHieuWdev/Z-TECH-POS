import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchRestockSuggestions } from '../services/restockSuggestionService';

const initialFilters = {
  leadTimeDays: 7,
  safetyDays: 5,
  targetDays: 30,
  categoryId: '',
  deviceFamily: '',
  priority: '',
  search: '',
  stockStatus: '',
  costStatus: '',
  quantityRange: ''
};

export default function useRestockSuggestions() {
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState({ suggestions: [], meta: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setData(await fetchRestockSuggestions(filters));
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể tải gợi ý nhập hàng.');
    } finally {
      setLoading(false);
    }
  }, [filters.leadTimeDays, filters.safetyDays, filters.targetDays, filters.categoryId, filters.deviceFamily]);

  useEffect(() => {
    load();
  }, [load]);

  const suggestions = useMemo(() => (
    (data.suggestions || []).filter((item) => {
      const keyword = filters.search.trim().toLocaleLowerCase('vi-VN');
      const matchesSearch = !keyword || [item.productName, item.sku, item.barcode]
        .some((value) => String(value || '').toLocaleLowerCase('vi-VN').includes(keyword));
      const matchesPriority = !filters.priority || item.priority === filters.priority;
      const matchesStock = !filters.stockStatus
        || (filters.stockStatus === 'out' && item.currentStock <= 0)
        || (filters.stockStatus === 'low' && item.currentStock > 0 && item.currentStock <= item.reorderPoint)
        || (filters.stockStatus === 'available' && item.currentStock > item.reorderPoint);
      const matchesCost = !filters.costStatus
        || (filters.costStatus === 'has' && item.hasValidCostPrice)
        || (filters.costStatus === 'missing' && !item.hasValidCostPrice);
      const quantity = Number(item.suggestedQuantity || 0);
      const matchesQuantity = !filters.quantityRange
        || (filters.quantityRange === 'under10' && quantity < 10)
        || (filters.quantityRange === '10to30' && quantity >= 10 && quantity <= 30)
        || (filters.quantityRange === 'over30' && quantity > 30);
      return matchesSearch && matchesPriority && matchesStock && matchesCost && matchesQuantity;
    })
  ), [data.suggestions, filters.search, filters.priority, filters.stockStatus, filters.costStatus, filters.quantityRange]);

  return {
    filters,
    setFilters,
    suggestions,
    allSuggestions: data.suggestions || [],
    meta: data.meta || {},
    loading,
    error,
    reload: load
  };
}
