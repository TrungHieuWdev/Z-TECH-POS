import { query } from '../config/db.js';
import { generateSalesStrategies } from '../services/huggingFaceSalesAIService.js';

export async function getLogs(req, res) {
  try {
    const logs = await query(
      `SELECT il.*, p.name AS product_name, u.name AS user_name
       FROM inventory_logs il
       JOIN products p ON il.product_id = p.id
       JOIN users u ON il.user_id = u.id
       ORDER BY il.created_at DESC`
    );

    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Không thể lấy lịch sử kho', error: error.message });
  }
}

export async function addStock(req, res) {
  try {
    const { product_id, quantity, note = '' } = req.body;
    const stockQuantity = Number(quantity);

    if (!product_id || stockQuantity <= 0) {
      return res.status(400).json({ message: 'Sản phẩm và số lượng nhập kho là bắt buộc' });
    }

    await query(
      "INSERT INTO inventory_logs (product_id, user_id, type, quantity, note) VALUES (?, ?, 'in', ?, ?)",
      [product_id, req.user.id, stockQuantity, note]
    );
    await query('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', [stockQuantity, product_id]);

    res.status(201).json({ message: 'Đã nhập kho' });
  } catch (error) {
    res.status(500).json({ message: 'Không thể nhập kho', error: error.message });
  }
}

export async function adjustStock(req, res) {
  try {
    const { product_id, quantity, note = '' } = req.body;
    const newQuantity = Number(quantity);

    if (!product_id || newQuantity < 0) {
      return res.status(400).json({ message: 'Số lượng tồn kho không hợp lệ' });
    }

    await query(
      "INSERT INTO inventory_logs (product_id, user_id, type, quantity, note) VALUES (?, ?, 'adjust', ?, ?)",
      [product_id, req.user.id, newQuantity, note]
    );
    await query('UPDATE products SET stock_quantity = ? WHERE id = ?', [newQuantity, product_id]);

    res.json({ message: 'Đã điều chỉnh tồn kho' });
  } catch (error) {
    res.status(500).json({ message: 'Không thể điều chỉnh tồn kho', error: error.message });
  }
}

export async function getProductAIAnalysis(req, res) {
  try {
    const days = [7, 15, 30].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
    const cutoffDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 19).replace('T', ' ');
    const params = [cutoffDate];
    let filters = '';
    if (req.query.categoryId) { filters += ' AND p.category_id = ?'; params.push(req.query.categoryId); }
    if (req.query.phoneBrandId) { filters += ' AND dm.family = ?'; params.push(req.query.phoneBrandId); }
    const products = await query(
      `SELECT p.id, p.name, p.sku, p.barcode, p.image_url, p.category_id,
              c.name AS category_name, dm.family AS device_family, dm.name AS device_model,
              p.stock_quantity, p.min_stock, p.cost_price, p.price,
              COALESCE(SUM(CASE WHEN o.status = 'completed' AND o.created_at >= ? THEN oi.quantity ELSE 0 END), 0) AS sold_quantity
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN device_models dm ON dm.id = p.device_model_id
       LEFT JOIN order_items oi ON oi.product_id = p.id
       LEFT JOIN orders o ON o.id = oi.order_id
       WHERE p.is_active = 1 ${filters}
       GROUP BY p.id, p.name, p.sku, p.barcode, p.image_url, p.category_id, c.name, dm.family, dm.name,
                p.stock_quantity, p.min_stock, p.cost_price, p.price
       ORDER BY p.stock_quantity DESC`, params
    );
    const [range] = await query(`SELECT MIN(created_at) AS first_sale_date FROM orders WHERE status = 'completed'`);
    const availableDays = range?.first_sale_date ? Math.max(1, Math.floor((Date.now() - new Date(range.first_sale_date).getTime()) / 86400000) + 1) : 0;
    res.json({ products, meta: { days, availableDays, generatedAt: new Date().toISOString() } });
  } catch (error) {
    res.status(500).json({ message: 'Không thể phân tích sản phẩm trong kho', error: error.message });
  }
}

export async function refreshProductAIAnalysis(req, res) {
  res.json({ message: 'Đã làm mới dữ liệu phân tích', refreshedAt: new Date().toISOString() });
}

export async function getSalesOpportunities(req, res) {
  try {
    const days = [30, 60, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 90;
    const cutoffDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 19).replace('T', ' ');
    const [summary, pairs, products] = await Promise.all([
      query(`SELECT COUNT(*) AS order_count FROM orders WHERE status = 'completed' AND created_at >= ?`, [cutoffDate]),
      query(`SELECT a.product_id AS product_a_id, b.product_id AS product_b_id, COUNT(DISTINCT a.order_id) AS together_orders
             FROM order_items a JOIN order_items b ON a.order_id = b.order_id AND a.product_id < b.product_id
             JOIN orders o ON o.id = a.order_id
             WHERE o.status = 'completed' AND o.created_at >= ?
             GROUP BY a.product_id, b.product_id HAVING COUNT(DISTINCT a.order_id) >= 2 ORDER BY together_orders DESC LIMIT 100`, [cutoffDate]),
      query(`SELECT p.id, p.name, p.sku, p.stock_quantity, p.min_stock, p.price, p.cost_price,
                    c.name AS category_name, dm.family AS device_family,
                    COUNT(DISTINCT CASE WHEN o.status = 'completed' AND o.created_at >= ? THEN o.id END) AS order_count,
                    COALESCE(SUM(CASE WHEN o.status = 'completed' AND o.created_at >= ? THEN oi.quantity ELSE 0 END), 0) AS sold_quantity
             FROM products p LEFT JOIN categories c ON c.id = p.category_id LEFT JOIN device_models dm ON dm.id = p.device_model_id
             LEFT JOIN order_items oi ON oi.product_id = p.id LEFT JOIN orders o ON o.id = oi.order_id
             WHERE p.is_active = 1 GROUP BY p.id, p.name, p.sku, p.stock_quantity, p.min_stock, p.price, p.cost_price, c.name, dm.family`, [cutoffDate, cutoffDate])
    ]);
    res.json({ days, orderCount: Number(summary[0]?.order_count || 0), pairs, products });
  } catch (error) {
    res.status(500).json({ message: 'Không thể phân tích cơ hội bán hàng', error: error.message });
  }
}

export async function generateAISalesOpportunities(req, res) {
  try {
    const days = [30, 60, 90].includes(Number(req.body.days)) ? Number(req.body.days) : 90;
    const orderCount = Math.max(0, Number(req.body.orderCount || 0));
    const candidates = Array.isArray(req.body.candidates) ? req.body.candidates.slice(0, 20) : [];
    if (!candidates.length) return res.status(400).json({ message: 'Không có ứng viên phù hợp để AI phân tích' });
    res.json(await generateSalesStrategies({ days, orderCount, candidates }));
  } catch (error) {
    res.status(502).json({ message: 'Hugging Face chưa thể tạo chiến lược; hệ thống sẽ dùng phân tích dự phòng', error: error.message });
  }
}
