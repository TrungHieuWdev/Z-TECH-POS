import api from '../api/axios';

export async function fetchRestockSuggestions(filters) {
  const response = await api.get('/inventory/restock-suggestions', {
    cache: false,
    params: {
      leadTimeDays: filters.leadTimeDays,
      safetyDays: filters.safetyDays,
      targetDays: filters.targetDays,
      categoryId: filters.categoryId || undefined,
      deviceFamily: filters.deviceFamily || undefined
    }
  });

  return response.data;
}
