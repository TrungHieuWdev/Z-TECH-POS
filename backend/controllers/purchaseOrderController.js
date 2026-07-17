import { query, withTransaction } from '../config/db.js';
import { normalizePurchasePayment } from '../services/purchaseOrderPaymentService.js';

function buildPurchaseCode(id) {
  return `PN-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(id).padStart(5, '0')}`;
}

export async function getAll(req, res) {
  const rows = await query(`SELECT po.*, GREATEST(po.total_amount - po.paid_amount, 0) AS debt_amount,
    s.supplier_name, u.name AS created_by_name
    FROM purchase_orders po JOIN suppliers s ON s.id=po.supplier_id JOIN users u ON u.id=po.user_id
    ORDER BY po.created_at DESC`);
  res.json(rows);
}

export async function getById(req, res) {
  const rows = await query(`SELECT po.*, GREATEST(po.total_amount - po.paid_amount, 0) AS debt_amount,
    s.supplier_name, u.name AS created_by_name
    FROM purchase_orders po JOIN suppliers s ON s.id=po.supplier_id JOIN users u ON u.id=po.user_id WHERE po.id=?`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ message: 'Không tìm thấy phiếu nhập' });
  const items = await query(`SELECT poi.*, p.name AS product_name, p.sku
    FROM purchase_order_items poi JOIN products p ON p.id=poi.product_id WHERE poi.purchase_order_id=?`, [req.params.id]);
  res.json({ ...rows[0], items });
}

export async function create(req, res) {
  try {
    const created = await withTransaction(async (db) => {
      const supplier = await db("SELECT id FROM suppliers WHERE id=? AND status<>'inactive' FOR UPDATE", [req.body.supplier_id]);
      if (!supplier[0]) throw Object.assign(new Error('Nhà cung cấp không hợp lệ'), { status: 400 });
      const temporaryCode = `TMP-${Date.now()}-${req.user.id}`;
      const order = await db(`INSERT INTO purchase_orders (purchase_code,supplier_id,user_id,total_amount,note,status)
        VALUES (?,?,?,0,?,'completed')`, [temporaryCode, req.body.supplier_id, req.user.id, req.body.note || null]);
      const code = buildPurchaseCode(order.insertId);
      await db('UPDATE purchase_orders SET purchase_code=? WHERE id=?', [code, order.insertId]);
      let total = 0;
      for (const input of req.body.items) {
        const products = await db('SELECT id,stock_quantity FROM products WHERE id=? FOR UPDATE', [input.product_id]);
        if (!products[0]) throw Object.assign(new Error(`Không tìm thấy sản phẩm ${input.product_id}`), { status: 404 });
        const quantity = Number(input.quantity);
        const importPrice = Number(input.import_price);
        const subtotal = quantity * importPrice;
        const before = Number(products[0].stock_quantity);
        const after = before + quantity;
        await db(`INSERT INTO purchase_order_items (purchase_order_id,product_id,quantity,import_price,subtotal)
          VALUES (?,?,?,?,?)`, [order.insertId, input.product_id, quantity, importPrice, subtotal]);
        await db('UPDATE products SET stock_quantity=?, cost_price=? WHERE id=?', [after, importPrice, input.product_id]);
        await db(`INSERT INTO inventory_logs
          (product_id,user_id,type,quantity,before_quantity,after_quantity,reference_type,reference_id,note)
          VALUES (?,?,'IMPORT',?,?,?,'PURCHASE_ORDER',?,?)`,
          [input.product_id, req.user.id, quantity, before, after, order.insertId, `Nhập hàng ${code}`]);
        total += subtotal;
      }
      const payment = normalizePurchasePayment({
        totalAmount: total,
        paidAmount: req.body.paid_amount,
        paymentMethod: req.body.payment_method,
        dueDate: req.body.due_date
      });
      await db(
        `UPDATE purchase_orders
         SET total_amount=?, paid_amount=?, payment_status=?, payment_method=?, due_date=?, paid_at=?
         WHERE id=?`,
        [
          payment.totalAmount,
          payment.paidAmount,
          payment.paymentStatus,
          payment.paymentMethod,
          payment.dueDate,
          payment.paidAmount > 0 ? new Date() : null,
          order.insertId
        ]
      );
      return { id: order.insertId, purchase_code: code, ...payment };
    });
    res.status(201).json(created);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.status ? error.message : 'Không thể tạo phiếu nhập' });
  }
}

export async function updatePayment(req, res) {
  try {
    const updated = await withTransaction(async (db) => {
      const rows = await db(
        `SELECT id, total_amount, paid_amount, status
         FROM purchase_orders
         WHERE id=?
         FOR UPDATE`,
        [req.params.id]
      );
      const order = rows[0];
      if (!order) throw Object.assign(new Error('Không tìm thấy phiếu nhập'), { status: 404 });
      if (order.status === 'cancelled') throw Object.assign(new Error('Không thể thanh toán phiếu nhập đã hủy'), { status: 409 });

      const payment = normalizePurchasePayment({
        totalAmount: order.total_amount,
        paidAmount: req.body.paid_amount,
        paymentMethod: req.body.payment_method,
        dueDate: req.body.due_date
      });
      if (payment.paidAmount < Number(order.paid_amount || 0)) {
        throw Object.assign(new Error('Số tiền đã thanh toán không được nhỏ hơn giá trị đã ghi nhận'), { status: 400 });
      }

      const hasNewPayment = payment.paidAmount > Number(order.paid_amount || 0);
      await db(
        `UPDATE purchase_orders
         SET paid_amount=?, payment_status=?, payment_method=?, due_date=?,
             paid_at=CASE WHEN ? = 1 THEN NOW() ELSE paid_at END
         WHERE id=?`,
        [payment.paidAmount, payment.paymentStatus, payment.paymentMethod, payment.dueDate, hasNewPayment ? 1 : 0, order.id]
      );
      return { id: order.id, ...payment };
    });

    res.json(updated);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.status ? error.message : 'Không thể cập nhật thanh toán phiếu nhập' });
  }
}
