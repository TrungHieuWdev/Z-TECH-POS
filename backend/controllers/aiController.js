import { getRestockSuggestions } from '../services/restockSuggestionService.js';

export async function getInventoryRestockSuggestions(req, res) {
  try {
    const result = await getRestockSuggestions({
      leadTimeDays: req.query.leadTimeDays,
      safetyDays: req.query.safetyDays,
      targetDays: req.query.targetDays,
      limit: req.query.limit,
      categoryId: req.query.categoryId,
      deviceFamily: req.query.deviceFamily
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      message: 'Không thể tạo gợi ý nhập hàng',
      error: error.message
    });
  }
}
