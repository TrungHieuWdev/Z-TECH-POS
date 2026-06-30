import { readLocalJson } from '../utils/storage';

const KEY = 'ztech_promotions';
export function getPromotions(fallback = []) {
  return readLocalJson(KEY, fallback, Array.isArray);
}
export function savePromotions(promotions) {
  localStorage.setItem(KEY, JSON.stringify(promotions));
  window.dispatchEvent(new Event('ztech-promotions-changed'));
  return promotions;
}

export function normalizePromotionText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function getPromotionDiscount(promotion, subtotal) {
  const raw = promotion.discountType === 'percent' ? subtotal * Number(promotion.discountValue || 0) / 100 : Number(promotion.discountValue || 0);
  return Math.max(0, Math.min(subtotal, Number(promotion.maxDiscount || 0) > 0 ? Math.min(raw, Number(promotion.maxDiscount)) : raw));
}

export function isPromotionEligible(promotion, { cart, subtotal, isMember }) {
  if (!promotion?.enabled || !['active', 'ending'].includes(promotion.status)) return false;
  const today = new Date().toISOString().slice(0, 10);
  if (promotion.startDate && promotion.startDate > today) return false;
  if (promotion.endDate && promotion.endDate < today) return false;
  if (subtotal < Number(promotion.minOrder || 0)) return false;
  if (Number(promotion.maxOrder || 0) > 0 && subtotal > Number(promotion.maxOrder)) return false;
  if (promotion.memberOnly && !isMember) return false;
  if (cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0) < Number(promotion.minQuantity || 0)) return false;
  const scope = normalizePromotionText(promotion.scope);
  if (scope.includes('toan don')) return true;
  const target = normalizePromotionText([promotion.targetName, promotion.name, promotion.condition, promotion.description].join(' '));
  const matches = cart.some((item) => {
    const itemText = normalizePromotionText([item.name, item.category_name, item.device_model, item.device_family].join(' '));
    if (promotion.productId) return Number(item.id) === Number(promotion.productId);
    if (promotion.categoryId) return Number(item.category_id) === Number(promotion.categoryId);
    if (promotion.deviceFamily) return normalizePromotionText(item.device_family) === normalizePromotionText(promotion.deviceFamily);
    const words = itemText.split(/\s+/).filter((word) => word.length >= 3);
    return words.some((word) => target.includes(word));
  });
  return matches;
}
