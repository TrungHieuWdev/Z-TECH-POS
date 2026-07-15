import { query } from '../config/db.js';
import { calculateRestockForecast, classifyRestockPriority } from '../utils/restockForecast.js';

const DEFAULT_OPTIONS = {
  leadTimeDays: 7,
  safetyDays: 5,
  targetDays: 30,
  limit: 80
};

function clampInteger(value, fallback, min, max) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function getDefaultReason(item) {
  const cover = item.daysCover === null
    ? 'chưa đủ dữ liệu để xác định số ngày đủ bán'
    : `còn đủ bán khoảng ${Math.max(0, Math.round(item.daysCover))} ngày`;
  if (item.priority === 'insufficient') {
    return `Tồn kho hiện tại ${item.currentStock} sản phẩm và chưa có lịch sử bán đáng tin cậy. Chưa nên nhập theo dự báo; cần theo dõi thêm nhu cầu thực tế.`;
  }
  if (item.currentStock === 0 && item.forecastQtyTarget < 5) {
    return `Sản phẩm đã hết hàng nhưng tốc độ bán thấp, nhu cầu dự báo ${item.forecastQtyTarget} sản phẩm trong ${item.targetDays} ngày. Nên nhập ${item.suggestedQuantity} sản phẩm để kiểm tra nhu cầu.`;
  }
  return `Tồn kho hiện tại ${item.currentStock} sản phẩm, ${cover}; nhu cầu dự báo ${item.forecastQtyTarget} sản phẩm trong ${item.targetDays} ngày và điểm đặt lại là ${item.reorderPoint}. Đề xuất nhập ${item.suggestedQuantity} sản phẩm để đạt mức đủ bán mục tiêu kèm tồn kho an toàn.`;
}

function normalizeOptions(input = {}) {
  return {
    leadTimeDays: clampInteger(input.leadTimeDays, DEFAULT_OPTIONS.leadTimeDays, 1, 60),
    safetyDays: clampInteger(input.safetyDays, DEFAULT_OPTIONS.safetyDays, 0, 60),
    targetDays: clampInteger(input.targetDays, DEFAULT_OPTIONS.targetDays, 7, 180),
    limit: clampInteger(input.limit, DEFAULT_OPTIONS.limit, 1, 200),
    categoryId: input.categoryId ? Number(input.categoryId) : null,
    deviceFamily: input.deviceFamily ? String(input.deviceFamily) : ''
  };
}

async function fetchProductSales(options) {
  const filters = [];
  const params = [];

  if (options.categoryId) {
    filters.push('p.category_id = ?');
    params.push(options.categoryId);
  }

  if (options.deviceFamily) {
    filters.push('dm.family = ?');
    params.push(options.deviceFamily);
  }

  const whereSql = filters.length ? `AND ${filters.join(' AND ')}` : '';

  return query(
    `SELECT
       p.id AS product_id,
       p.name AS product_name,
       p.sku,
       p.barcode,
       p.image_url,
       p.stock_quantity,
       p.min_stock,
       p.cost_price,
       p.price,
       p.created_at AS product_created_at,
       c.name AS category_name,
       dm.family AS device_family,
       dm.name AS device_model,
       COALESCE(SUM(CASE WHEN o.status = 'completed' AND o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN oi.quantity ELSE 0 END), 0) AS sold_7_days,
       COALESCE(SUM(CASE WHEN o.status = 'completed' AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN oi.quantity ELSE 0 END), 0) AS sold_30_days,
       COALESCE(SUM(CASE WHEN o.status = 'completed' AND o.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY) THEN oi.quantity ELSE 0 END), 0) AS sold_90_days
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN device_models dm ON dm.id = p.device_model_id
     LEFT JOIN order_items oi ON oi.product_id = p.id
     LEFT JOIN orders o ON o.id = oi.order_id
     WHERE p.is_active = 1 ${whereSql}
     GROUP BY p.id, p.name, p.sku, p.barcode, p.image_url, p.stock_quantity, p.min_stock, p.cost_price, p.price,
              p.created_at, c.name, dm.family, dm.name`,
    params
  );
}

function buildSuggestion(row, options) {
  const currentStock = Number(row.stock_quantity || 0);
  const sold7Days = Number(row.sold_7_days || 0);
  const sold30Days = Number(row.sold_30_days || 0);
  const sold90Days = Number(row.sold_90_days || 0);
  const productAgeDays = Math.max(1, Math.floor((Date.now() - new Date(row.product_created_at).getTime()) / 86400000) + 1);
  const forecast = calculateRestockForecast({ currentStock, sold7Days, sold30Days, sold90Days, productAgeDays, ...options });
  const priority = classifyRestockPriority({ currentStock, sold7Days, sold30Days, sold90Days, leadTimeDays: options.leadTimeDays, ...forecast });
  const hasValidCostPrice = Number(row.cost_price) > 0;

  const item = {
    productId: Number(row.product_id),
    productName: row.product_name,
    sku: row.sku,
    barcode: row.barcode,
    imageUrl: row.image_url,
    categoryName: row.category_name,
    deviceFamily: row.device_family,
    deviceModel: row.device_model,
    currentStock,
    minStock: Number(row.min_stock || 0),
    costPrice: Number(row.cost_price || 0),
    price: Number(row.price || 0),
    sold7Days,
    sold30Days,
    sold90Days,
    productAgeDays,
    targetDays: options.targetDays,
    daily7: forecast.rate7,
    daily30: forecast.rate30,
    daily90: forecast.rate90,
    forecastDailySales: forecast.forecastPerDay,
    forecastQtyTarget: forecast.forecastQtyTarget,
    safetyStock: forecast.safetyStock,
    reorderPoint: forecast.reorderPoint,
    suggestedQuantity: forecast.suggestedQuantity,
    hasValidCostPrice,
    estimatedCost: hasValidCostPrice ? forecast.suggestedQuantity * Number(row.cost_price) : null,
    daysOfStockLeft: forecast.daysCover,
    daysCover: forecast.daysCover,
    priority
  };

  return { ...item, reason: getDefaultReason(item), reasonSource: 'formula' };
}

export async function getRestockSnapshot(input = {}) {
  const options = normalizeOptions(input);
  const rows = await fetchProductSales(options);
  const suggestions = rows
    .map((row) => buildSuggestion(row, options))
    .filter((item) => item.suggestedQuantity > 0 || item.currentStock <= item.minStock)
    .sort((a, b) => {
      const priorityScore = { high: 3, medium: 2, low: 1 };
      return priorityScore[b.priority] - priorityScore[a.priority]
        || b.suggestedQuantity - a.suggestedQuantity
        || b.sold30Days - a.sold30Days;
    })
    .slice(0, options.limit);

  return {
    suggestions,
    meta: {
      generatedAt: new Date().toISOString(),
      totalProductsAnalyzed: rows.length,
      options,
      algorithm: 'Weighted Moving Average + Reorder Point + Safety Stock',
      formula: {
        forecastDailySales: '50% × tốc độ bán TB 7 ngày + 30% × tốc độ bán TB 30 ngày + 20% × tốc độ bán TB 90 ngày',
        reorderPoint: 'Dự báo/ngày × Ngày chờ nhập + Tồn kho an toàn',
        safetyStock: 'Dự báo/ngày × Ngày tồn an toàn',
        suggestedQuantity: 'max(0, Dự báo/ngày × Mục tiêu đủ bán + Tồn kho an toàn - Tồn kho hiện tại)'
      }
    }
  };
}
