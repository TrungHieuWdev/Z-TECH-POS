const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function positiveInteger(value, fallback = 1) {
  const parsed = Math.floor(number(value, fallback));
  return parsed > 0 ? parsed : fallback;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export function getVietnamDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: VIETNAM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

export function parsePromotionRow(row) {
  if (!row) return null;

  let data = {};
  try {
    data = JSON.parse(row.data || '{}');
  } catch {
    data = {};
  }

  return {
    ...data,
    id: Number(row.id),
    code: row.code,
    name: data.name || row.promotion_name || row.code,
    enabled: data.enabled !== false && !['inactive', 'expired'].includes(row.status),
    startDate: data.startDate || (row.start_date ? String(row.start_date).slice(0, 10) : ''),
    endDate: data.endDate || (row.end_date ? String(row.end_date).slice(0, 10) : '')
  };
}

export function isPromotionActive(promotion, today = getVietnamDate()) {
  return Boolean(
    promotion?.enabled &&
    (!promotion.startDate || promotion.startDate <= today) &&
    (!promotion.endDate || promotion.endDate >= today)
  );
}

export function normalizeOrderItems(rawItems = []) {
  const aggregated = new Map();

  for (const rawItem of rawItems) {
    const productId = Number(rawItem?.product_id);
    const quantity = Math.floor(number(rawItem?.quantity));
    const hasSeparatedQuantities = rawItem?.purchased_quantity != null || rawItem?.gift_quantity != null;
    const purchasedQuantity = hasSeparatedQuantities
      ? Math.floor(number(rawItem?.purchased_quantity))
      : quantity;
    const giftQuantity = hasSeparatedQuantities
      ? Math.floor(number(rawItem?.gift_quantity))
      : 0;

    if (
      !Number.isInteger(productId) ||
      productId <= 0 ||
      !Number.isInteger(quantity) ||
      quantity <= 0 ||
      !Number.isInteger(purchasedQuantity) ||
      purchasedQuantity < 0 ||
      !Number.isInteger(giftQuantity) ||
      giftQuantity < 0 ||
      purchasedQuantity + giftQuantity !== quantity
    ) {
      const error = new Error('Sản phẩm hoặc số lượng mua/quà tặng không hợp lệ');
      error.status = 400;
      throw error;
    }

    const current = aggregated.get(productId) || {
      product_id: productId,
      quantity: 0,
      purchased_quantity: 0,
      gift_quantity: 0
    };
    current.quantity += quantity;
    current.purchased_quantity += purchasedQuantity;
    current.gift_quantity += giftQuantity;
    aggregated.set(productId, current);
  }

  return [...aggregated.values()];
}

function quantityOf(items, productId, field = 'purchased_quantity') {
  return items
    .filter((item) => Number(item.product_id) === Number(productId))
    .reduce((sum, item) => sum + number(item[field]), 0);
}

function productMatchesScope(promotion, product) {
  const scope = normalizeText(promotion.scope);
  if (!scope || scope.includes('toan don')) return true;
  if (promotion.productId) return Number(product.id) === Number(promotion.productId);
  if (promotion.categoryId) return Number(product.category_id) === Number(promotion.categoryId);
  if (promotion.deviceFamily) {
    return normalizeText(product.device_family) === normalizeText(promotion.deviceFamily);
  }

  const target = normalizeText([
    promotion.targetName,
    promotion.name,
    promotion.condition,
    promotion.description
  ].join(' '));
  const productText = normalizeText([
    product.name,
    product.category_name,
    product.device_model,
    product.device_family
  ].join(' '));

  return productText
    .split(/\s+/)
    .filter((word) => word.length >= 3)
    .some((word) => target.includes(word));
}

function ensureBaseEligibility(promotion, { items, products, purchasedSubtotal, customerId }) {
  if (!isPromotionActive(promotion)) {
    const error = new Error('Khuyến mãi đã ngừng hoạt động hoặc hết hạn');
    error.status = 400;
    throw error;
  }

  const minOrder = Math.max(0, number(promotion.minOrder));
  const maxOrder = Math.max(0, number(promotion.maxOrder));
  if (purchasedSubtotal < minOrder || (maxOrder > 0 && purchasedSubtotal > maxOrder)) {
    const error = new Error('Giá trị đơn hàng chưa đáp ứng điều kiện khuyến mãi');
    error.status = 400;
    throw error;
  }
  if (promotion.memberOnly && !customerId) {
    const error = new Error('Khuyến mãi chỉ áp dụng cho khách hàng thành viên');
    error.status = 400;
    throw error;
  }

  const purchasedProducts = items
    .filter((item) => item.purchased_quantity > 0)
    .map((item) => products.get(item.product_id))
    .filter(Boolean);
  if (!purchasedProducts.some((product) => productMatchesScope(promotion, product))) {
    const error = new Error('Sản phẩm trong giỏ không thuộc phạm vi khuyến mãi');
    error.status = 400;
    throw error;
  }
}

export function calculatePromotion({
  promotion,
  items,
  products,
  subtotal,
  purchasedSubtotal,
  customerId
}) {
  const giftItems = items.filter((item) => item.gift_quantity > 0);

  if (!promotion) {
    if (giftItems.length) {
      const error = new Error('Không thể thêm quà tặng khi chưa áp dụng khuyến mãi');
      error.status = 400;
      throw error;
    }
    return { discount: 0, promotion: null };
  }

  ensureBaseEligibility(promotion, { items, products, purchasedSubtotal, customerId });
  const type = promotion.promotionType || 'standard';
  let discount = 0;

  if (type === 'buy_x_get_y') {
    const buyProductId = Number(promotion.buyProductId);
    const giftProductId = Number(promotion.giftProductId);
    const buyRequired = positiveInteger(promotion.buyQuantity);
    const giftRequired = positiveInteger(promotion.giftQuantity);
    const purchasedQuantity = quantityOf(items, buyProductId);
    const allowedGiftQuantity = Math.floor(purchasedQuantity / buyRequired) * giftRequired;
    const requestedGiftQuantity = quantityOf(items, giftProductId, 'gift_quantity');
    const invalidGiftProduct = giftItems.some((item) => item.product_id !== giftProductId);

    if (
      !buyProductId ||
      !giftProductId ||
      purchasedQuantity < buyRequired ||
      requestedGiftQuantity <= 0 ||
      requestedGiftQuantity > allowedGiftQuantity ||
      invalidGiftProduct
    ) {
      const error = new Error('Số lượng mua hoặc quà tặng không đúng điều kiện khuyến mãi');
      error.status = 400;
      throw error;
    }

    const giftProduct = products.get(giftProductId);
    discount = number(giftProduct?.price) * requestedGiftQuantity;
  } else {
    if (giftItems.length) {
      const error = new Error('Loại khuyến mãi này không có sản phẩm quà tặng');
      error.status = 400;
      throw error;
    }

    if (type === 'combo') {
      const comboItems = Array.isArray(promotion.comboItems) ? promotion.comboItems : [];
      if (comboItems.length < 2) {
        const error = new Error('Cấu hình combo không hợp lệ');
        error.status = 400;
        throw error;
      }
      const sets = Math.min(...comboItems.map((required) => (
        Math.floor(quantityOf(items, required.productId) / positiveInteger(required.quantity))
      )));
      if (sets <= 0) {
        const error = new Error('Giỏ hàng chưa đủ sản phẩm combo');
        error.status = 400;
        throw error;
      }
      const comboSubtotal = comboItems.reduce((sum, required) => {
        const product = products.get(Number(required.productId));
        return sum + number(product?.price) * positiveInteger(required.quantity);
      }, 0) * sets;
      discount = promotion.comboDiscountType === 'percent'
        ? comboSubtotal * Math.max(0, number(promotion.comboDiscountValue)) / 100
        : Math.max(0, number(promotion.comboDiscountValue)) * sets;
    } else if (type === 'nth_item_discount') {
      const eligibleItems = promotion.productId
        ? quantityOf(items, promotion.productId)
        : items.reduce((sum, item) => sum + item.purchased_quantity, 0);
      const times = Math.floor(eligibleItems / Math.max(2, positiveInteger(promotion.nthQuantity, 2)));
      if (times <= 0) {
        const error = new Error('Giỏ hàng chưa đủ số lượng để áp dụng khuyến mãi');
        error.status = 400;
        throw error;
      }
      discount = times * Math.max(0, number(promotion.nthDiscountAmount));
    } else if (type === 'quantity_tier') {
      const eligibleItems = promotion.productId
        ? quantityOf(items, promotion.productId)
        : items.reduce((sum, item) => sum + item.purchased_quantity, 0);
      const tier = [...(promotion.quantityTiers || [])]
        .sort((a, b) => number(b.quantity) - number(a.quantity))
        .find((item) => eligibleItems >= positiveInteger(item.quantity));
      if (!tier) {
        const error = new Error('Giỏ hàng chưa đạt mức số lượng khuyến mãi');
        error.status = 400;
        throw error;
      }
      const eligibleSubtotal = items.reduce((sum, item) => {
        const product = products.get(item.product_id);
        if (promotion.productId && item.product_id !== Number(promotion.productId)) return sum;
        return sum + number(product?.price) * item.purchased_quantity;
      }, 0);
      discount = eligibleSubtotal * Math.max(0, number(tier.percent)) / 100;
    } else {
      const minQuantity = Math.max(0, Math.floor(number(promotion.minQuantity)));
      const purchasedQuantity = items.reduce((sum, item) => sum + item.purchased_quantity, 0);
      if (purchasedQuantity < minQuantity) {
        const error = new Error('Giỏ hàng chưa đủ số lượng tối thiểu');
        error.status = 400;
        throw error;
      }
      const eligibleSubtotal = items.reduce((sum, item) => {
        const product = products.get(item.product_id);
        return productMatchesScope(promotion, product)
          ? sum + number(product?.price) * item.purchased_quantity
          : sum;
      }, 0);
      const rawDiscount = promotion.discountType === 'percent'
        ? eligibleSubtotal * Math.max(0, number(promotion.discountValue)) / 100
        : Math.max(0, number(promotion.discountValue));
      const maxDiscount = Math.max(0, number(promotion.maxDiscount));
      discount = Math.min(
        eligibleSubtotal,
        maxDiscount > 0 ? Math.min(rawDiscount, maxDiscount) : rawDiscount
      );
    }
  }

  return {
    discount: Math.round(Math.max(0, Math.min(subtotal, discount))),
    promotion: {
      id: promotion.id,
      code: promotion.code,
      name: promotion.name
    }
  };
}
