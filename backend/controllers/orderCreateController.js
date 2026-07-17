import { randomUUID } from 'node:crypto';
import { query, withTransaction } from '../config/db.js';
import {
  calculatePromotion,
  normalizeOrderItems,
  parsePromotionRow
} from '../services/promotionEngine.js';

function settingEnabled(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

async function getSettings(db, keys) {
  const placeholders = keys.map(() => '?').join(',');
  const rows = await db(
    `SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (${placeholders})`,
    keys
  );
  return Object.fromEntries(rows.map((row) => [row.setting_key, row.setting_value]));
}

async function getOrderResponse(db, orderId) {
  const rows = await db('SELECT * FROM orders WHERE id = ?', [orderId]);
  const inventory = await db(
    `SELECT oi.product_id, p.name AS product_name, p.stock_quantity AS remaining_stock
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ?`,
    [orderId]
  );
  return { ...rows[0], inventory };
}

function publicError(error) {
  return {
    message: error.status ? error.message : 'Không thể tạo đơn hàng',
    ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {})
  };
}

export async function create(req, res) {
  try {
    const {
      customer_id = null,
      items = [],
      promotion_id = null,
      points_used = 0,
      payment_method = 'cash',
      paid_amount = null,
      note = '',
      idempotency_key = null
    } = req.body;

    const createdOrder = await withTransaction(async (db) => {
      if (idempotency_key) {
        const existing = await db(
          'SELECT id FROM orders WHERE user_id = ? AND idempotency_key = ? LIMIT 1 FOR UPDATE',
          [req.user.id, idempotency_key]
        );
        if (existing[0]) {
          return { ...(await getOrderResponse(db, existing[0].id)), idempotent_replay: true };
        }
      }

      const normalizedItems = normalizeOrderItems(items);
      const settings = await getSettings(db, [
        'inventory_allow_out_of_stock_sale',
        'payment_cash_enabled',
        'payment_transfer_enabled',
        'payment_qr_enabled',
        'vat_enabled',
        'vat_rate'
      ]);
      const allowOutOfStockSale = settingEnabled(settings.inventory_allow_out_of_stock_sale);
      const paymentEnabled = {
        cash: settings.payment_cash_enabled === undefined || settingEnabled(settings.payment_cash_enabled),
        transfer: settingEnabled(settings.payment_transfer_enabled) ||
          settingEnabled(settings.payment_qr_enabled)
      };
      if (!paymentEnabled[payment_method]) {
        const error = new Error('Phương thức thanh toán đang bị tắt trong cài đặt');
        error.status = 400;
        throw error;
      }

      const productIds = normalizedItems.map((item) => item.product_id).sort((a, b) => a - b);
      const placeholders = productIds.map(() => '?').join(',');
      const productRows = await db(
        `SELECT p.id, p.name, p.price, p.cost_price, p.stock_quantity, p.category_id,
                c.name AS category_name, dm.name AS device_model, dm.family AS device_family,
                p.warranty_enabled, p.warranty_period_days, p.warranty_type,
                p.warranty_conditions, p.warranty_exclusions, p.warranty_note
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         LEFT JOIN device_models dm ON dm.id = p.device_model_id
         WHERE p.id IN (${placeholders}) AND p.is_active = 1
         ORDER BY p.id
         FOR UPDATE`,
        productIds
      );
      const products = new Map(productRows.map((product) => [Number(product.id), product]));
      let subtotal = 0;
      let purchasedSubtotal = 0;

      const orderItems = normalizedItems.map((item) => {
        const product = products.get(item.product_id);
        if (!product) {
          const error = new Error(`Không tìm thấy sản phẩm ID ${item.product_id}`);
          error.status = 404;
          throw error;
        }
        if (!allowOutOfStockSale && Number(product.stock_quantity) < item.quantity) {
          const error = new Error(`Sản phẩm ${product.name} không đủ tồn kho`);
          error.status = 400;
          throw error;
        }

        const unitPrice = Number(product.price);
        subtotal += unitPrice * item.quantity;
        purchasedSubtotal += unitPrice * item.purchased_quantity;
        return {
          ...product,
          ...item,
          unit_price: unitPrice,
          cost_price_snapshot: Number(product.cost_price || 0),
          subtotal: unitPrice * item.quantity
        };
      });

      let promotion = null;
      if (promotion_id) {
        const rows = await db('SELECT * FROM promotions WHERE id = ? LIMIT 1', [promotion_id]);
        promotion = parsePromotionRow(rows[0]);
        if (!promotion) {
          const error = new Error('Không tìm thấy khuyến mãi');
          error.status = 404;
          throw error;
        }
      }

      const promotionResult = calculatePromotion({
        promotion,
        items: orderItems,
        products,
        subtotal,
        purchasedSubtotal,
        customerId: customer_id || null
      });
      const amountAfterPromotion = Math.max(subtotal - promotionResult.discount, 0);
      const requestedPoints = Math.floor(Math.max(Number(points_used) || 0, 0));
      let availablePoints = 0;

      if (customer_id) {
        const customers = await db('SELECT id, loyalty_points FROM customers WHERE id = ? FOR UPDATE', [customer_id]);
        if (!customers[0]) {
          const error = new Error('Không tìm thấy khách hàng thành viên');
          error.status = 400;
          throw error;
        }
        availablePoints = Number(customers[0].loyalty_points || 0);
      } else if (requestedPoints > 0) {
        const error = new Error('Chỉ khách hàng thành viên mới được sử dụng điểm');
        error.status = 400;
        throw error;
      }

      const maxRedeemPoints = Math.floor(Math.min(availablePoints, amountAfterPromotion * 0.2 / 1000));
      if (requestedPoints > maxRedeemPoints) {
        const error = new Error(`Chỉ có thể sử dụng tối đa ${maxRedeemPoints} điểm`);
        error.status = 400;
        throw error;
      }

      const pointsDiscountAmount = requestedPoints * 1000;
      const afterPoints = Math.max(amountAfterPromotion - pointsDiscountAmount, 0);
      const vatRate = settingEnabled(settings.vat_enabled)
        ? Math.max(0, Math.min(100, Number(settings.vat_rate) || 0))
        : 0;
      const vatAmount = vatRate > 0 ? Math.round(afterPoints * vatRate / 100) : 0;
      const total = afterPoints + vatAmount;
      const earnedPoints = customer_id ? Math.floor(total / 10000) : 0;
      const totalDiscount = promotionResult.discount + pointsDiscountAmount;
      const normalizedPaid = payment_method === 'cash' ? Number(paid_amount) : total;
      if (payment_method === 'cash' && (!Number.isFinite(normalizedPaid) || normalizedPaid < total)) {
        const error = new Error('Số tiền khách đưa chưa đủ để thanh toán');
        error.status = 400;
        throw error;
      }

      const temporaryOrderNumber = `T-${randomUUID().replaceAll('-', '').slice(0, 18)}`;
      const orderResult = await db(
        `INSERT INTO orders
          (customer_id, user_id, order_number, promotion_id, promotion_code_snapshot,
           promotion_name_snapshot, subtotal, discount, promotion_discount, points_used,
           points_discount_amount, points_earned, vat_rate, vat_amount, total, payment_method,
           status, note, idempotency_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?)`,
        [
          customer_id || null,
          req.user.id,
          temporaryOrderNumber,
          promotionResult.promotion?.id || null,
          promotionResult.promotion?.code || null,
          promotionResult.promotion?.name || null,
          subtotal,
          totalDiscount,
          promotionResult.discount,
          requestedPoints,
          pointsDiscountAmount,
          earnedPoints,
          vatRate,
          vatAmount,
          total,
          payment_method,
          String(note || '').trim(),
          idempotency_key || null
        ]
      );
      const dateRows = await db("SELECT DATE_FORMAT(NOW(), '%Y%m%d') AS date_part");
      const orderNumber = `ORD-${dateRows[0].date_part}-${String(orderResult.insertId).padStart(6, '0')}`;
      await db('UPDATE orders SET order_number = ? WHERE id = ?', [orderNumber, orderResult.insertId]);

      for (const item of orderItems) {
        const orderItemResult = await db(
          `INSERT INTO order_items
           (order_id, product_id, quantity, purchased_quantity, gift_quantity, unit_price,
            cost_price_snapshot, subtotal, warranty_enabled_snapshot, warranty_period_days_snapshot,
            warranty_type_snapshot, warranty_conditions_snapshot, warranty_exclusions_snapshot,
            warranty_note_snapshot, public_token)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderResult.insertId,
            item.product_id,
            item.quantity,
            item.purchased_quantity,
            item.gift_quantity,
            item.unit_price,
            item.cost_price_snapshot,
            item.subtotal,
            item.warranty_enabled,
            item.warranty_period_days,
            item.warranty_type,
            item.warranty_conditions,
            item.warranty_exclusions,
            item.warranty_note,
            randomUUID()
          ]
        );
        const beforeQuantity = Number(item.stock_quantity);
        const afterQuantity = beforeQuantity - item.quantity;
        await db('UPDATE products SET stock_quantity = ? WHERE id = ?', [afterQuantity, item.product_id]);
        await db(
          `INSERT INTO inventory_logs
           (product_id,user_id,type,quantity,before_quantity,after_quantity,reference_type,reference_id,note)
           VALUES (?,?,'SALE',?,?,?,'ORDER',?,?)`,
          [item.product_id, req.user.id, item.quantity, beforeQuantity, afterQuantity, orderResult.insertId, `Bán hàng ${orderNumber}`]
        );

        if (Number(item.warranty_enabled) && Number(item.warranty_period_days) > 0) {
          const warrantyCode = `BH-${String(orderResult.insertId).padStart(5, '0')}-${String(orderItemResult.insertId).padStart(3, '0')}`;
          await db(
            `INSERT INTO warranties
             (warranty_code,order_item_id,customer_id,product_id,warranty_start,warranty_end,status,note)
             VALUES (?,?,?,?,CURDATE(),DATE_ADD(CURDATE(), INTERVAL ? DAY),'active',?)`,
            [
              warrantyCode,
              orderItemResult.insertId,
              customer_id || null,
              item.product_id,
              item.warranty_period_days,
              item.warranty_note || null
            ]
          );
        }
      }

      await db(
        `INSERT INTO payments (order_id,payment_method,amount,paid_amount,change_amount,status,paid_at)
         VALUES (?,?,?,?,?,'completed',NOW())`,
        [orderResult.insertId, payment_method, total, normalizedPaid, Math.max(normalizedPaid - total, 0)]
      );

      if (customer_id) {
        await db(
          'UPDATE customers SET loyalty_points = loyalty_points - ? + ? WHERE id = ? AND loyalty_points >= ?',
          [requestedPoints, earnedPoints, customer_id, requestedPoints]
        );
      }

      return getOrderResponse(db, orderResult.insertId);
    });

    res.status(createdOrder.idempotent_replay ? 200 : 201).json(createdOrder);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY' && req.body?.idempotency_key) {
      const existing = await query(
        'SELECT id FROM orders WHERE user_id = ? AND idempotency_key = ? LIMIT 1',
        [req.user.id, req.body.idempotency_key]
      ).catch(() => []);
      if (existing[0]) {
        const replay = await getOrderResponse(query, existing[0].id);
        return res.status(200).json({ ...replay, idempotent_replay: true });
      }
    }
    res.status(error.status || 500).json(publicError(error));
  }
}
