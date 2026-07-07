import { readLocalJson } from '../utils/storage';
import api from '../api/axios';

const KEY = 'ztech_promotions';
let cachedPromotions = [];
const addDaysISO = (dateValue, days) => {
  const date = dateValue ? new Date(dateValue) : new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

function normalizeStoredPromotion(promotion) {
  const isAISuggestion = String(promotion?.code || '').startsWith('AI');
  if (!promotion || !isAISuggestion) return promotion;

  return {
    ...promotion,
    promotionType: 'standard',
    discountType: 'percent',
    discountValue: 0,
    minOrder: 0,
    maxOrder: 0,
    maxDiscount: 0,
    scope: promotion.productId || promotion.buyProductId ? 'Theo sản phẩm cụ thể' : 'Toàn đơn hàng',
    categoryId: '',
    productId: promotion.productId || promotion.buyProductId || '',
    deviceFamily: '',
    targetName: promotion.targetName || promotion.name || '',
    condition: promotion.condition || promotion.name || '',
    description: promotion.description || promotion.condition || '',
    startDate: promotion.startDate || new Date().toISOString().slice(0, 10),
    endDate: promotion.endDate || addDaysISO(promotion.startDate, 30),
    status: promotion.enabled === false ? 'ended' : 'active',
    enabled: true,
    buyProductId: '',
    buyQuantity: 1,
    giftProductId: '',
    giftQuantity: 1,
    quantityTiers: [],
    ...promotion,
    scope: promotion.scope || (promotion.productId || promotion.buyProductId ? 'Theo sản phẩm cụ thể' : 'Toàn đơn hàng'),
    productId: promotion.productId || promotion.buyProductId || '',
    targetName: promotion.targetName || promotion.name || '',
    condition: promotion.condition || promotion.name || '',
    description: promotion.description || promotion.condition || '',
    startDate: promotion.startDate || new Date().toISOString().slice(0, 10),
    endDate: promotion.endDate || addDaysISO(promotion.startDate, 30),
    status: promotion.status || (promotion.enabled === false ? 'ended' : 'active')
  };
}

export async function getPromotions(fallback = []) {
  try {
    const response = await api.get('/promotions', { cache: false });
    cachedPromotions = Array.isArray(response.data) ? response.data.map(normalizeStoredPromotion) : [];
    return cachedPromotions;
  } catch {
    cachedPromotions = readLocalJson(KEY, fallback, Array.isArray).map(normalizeStoredPromotion);
    return cachedPromotions;
  }
}

export async function savePromotion(promotion) {
  const payload = normalizeStoredPromotion(promotion);
  const response = payload.id
    ? await api.put(`/promotions/${payload.id}`, payload)
    : await api.post('/promotions', payload);

  const saved = normalizeStoredPromotion(response.data);
  cachedPromotions = [saved, ...cachedPromotions.filter((item) => Number(item.id) !== Number(saved.id))];
  window.dispatchEvent(new Event('ztech-promotions-changed'));
  return saved;
}

export async function savePromotions(promotions) {
  const saved = [];
  for (const promotion of promotions) {
    saved.push(await savePromotion(promotion));
  }
  return saved;
}

export async function deletePromotion(id) {
  await api.delete(`/promotions/${id}`);
  cachedPromotions = cachedPromotions.filter((promotion) => Number(promotion.id) !== Number(id));
  window.dispatchEvent(new Event('ztech-promotions-changed'));
}

export function getCachedPromotions(fallback = []) {
  return cachedPromotions.length ? cachedPromotions : fallback;
}

export function normalizePromotionText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function getPromotionDiscount(promotion, subtotal, cart = []) {
  if (promotion.promotionType === 'buy_x_get_y') {
    const buyQuantity = cart.filter((item) => Number(item.id) === Number(promotion.buyProductId)).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const giftItems = cart.filter((item) => Number(item.id) === Number(promotion.giftProductId));
    const giftQuantity = giftItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const sets = Math.min(Math.floor(buyQuantity / Math.max(1, Number(promotion.buyQuantity || 1))), Math.floor(giftQuantity / Math.max(1, Number(promotion.giftQuantity || 1))));
    if (sets <= 0) return 0;
    const giftUnitPrice = Number(giftItems[0]?.price || giftItems[0]?.selling_price || 0);
    return Math.min(subtotal, giftUnitPrice * Number(promotion.giftQuantity || 1) * sets);
  }
  if (promotion.promotionType === 'quantity_tier') {
    const targetQuantity = cart.filter((item) => !promotion.productId || Number(item.id) === Number(promotion.productId)).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const tier = [...(promotion.quantityTiers || [])].sort((a, b) => Number(b.quantity) - Number(a.quantity)).find((item) => targetQuantity >= Number(item.quantity));
    if (!tier) return 0;
    const targetSubtotal = cart.filter((item) => !promotion.productId || Number(item.id) === Number(promotion.productId)).reduce((sum, item) => sum + Number(item.price || item.selling_price || 0) * Number(item.quantity || 0), 0);
    return Math.min(subtotal, targetSubtotal * Number(tier.percent || 0) / 100);
  }
  const raw = promotion.discountType === 'percent' ? subtotal * Number(promotion.discountValue || 0) / 100 : Number(promotion.discountValue || 0);
  return Math.max(0, Math.min(subtotal, Number(promotion.maxDiscount || 0) > 0 ? Math.min(raw, Number(promotion.maxDiscount)) : raw));
}

export function isPromotionEligible(promotion, { cart, subtotal, isMember }) {
  if (!promotion?.enabled) return false;
  const today = new Date().toISOString().slice(0, 10);
  if (promotion.startDate && promotion.startDate > today) return false;
  if (promotion.endDate && promotion.endDate < today) return false;
  if (subtotal < Number(promotion.minOrder || 0)) return false;
  if (Number(promotion.maxOrder || 0) > 0 && subtotal > Number(promotion.maxOrder)) return false;
  if (promotion.memberOnly && !isMember) return false;
  if (promotion.promotionType === 'buy_x_get_y') {
    const quantityOf = (id) => cart.filter((item) => Number(item.id) === Number(id)).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    return quantityOf(promotion.buyProductId) >= Number(promotion.buyQuantity || 1) && quantityOf(promotion.giftProductId) >= Number(promotion.giftQuantity || 1);
  }
  if (promotion.promotionType === 'quantity_tier') {
    const quantity = cart.filter((item) => !promotion.productId || Number(item.id) === Number(promotion.productId)).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    return (promotion.quantityTiers || []).some((tier) => quantity >= Number(tier.quantity));
  }
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
