import { ALERT_META } from '../constants/productAIAnalysisConstants';

const RULES = {
  30: [{ level: 'high', stock: 50, sold: 5 }, { level: 'medium', stock: 30, sold: 10 }, { level: 'low', stock: 20, sold: 15 }],
  15: [{ level: 'high', stock: 50, sold: 3 }, { level: 'medium', stock: 30, sold: 5 }, { level: 'low', stock: 20, sold: 8 }],
  7: [{ level: 'high', stock: 50, sold: 2 }, { level: 'medium', stock: 30, sold: 3 }, { level: 'low', stock: 20, sold: 5 }]
};
const COMMENTS = {
  high: 'Sản phẩm có lượng tồn kho cao và tốc độ tiêu thụ thấp trong thời gian phân tích. Nên xem xét tạo khuyến mãi hoặc hạn chế nhập thêm sản phẩm này.',
  medium: 'Sản phẩm có tốc độ bán thấp hơn kỳ vọng. Nên tiếp tục theo dõi hoặc cân nhắc chương trình ưu đãi phù hợp.',
  low: 'Sản phẩm có dấu hiệu tiêu thụ chậm. Cần tiếp tục theo dõi trong các kỳ phân tích tiếp theo.'
};

export function analyzeProduct(product, days = 30) {
  const stock = Number(product.stock_quantity || 0);
  const sold = Number(product.sold_quantity || 0);
  const matched = (RULES[days] || RULES[30]).find((rule) => stock > rule.stock && sold < rule.sold);
  if (!matched) return null;
  return { ...product, stock_quantity: stock, sold_quantity: sold, inventoryValue: stock * Number(product.cost_price || 0), alertLevel: matched.level, analysisComment: COMMENTS[matched.level], actionSuggestion: ALERT_META[matched.level].suggestion, suggestedDiscount: ALERT_META[matched.level].suggestedDiscount };
}

export function analyzeProducts(products, days) {
  return products.map((product) => analyzeProduct(product, days)).filter(Boolean);
}
