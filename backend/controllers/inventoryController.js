import { query, withTransaction } from '../config/db.js';

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

    await withTransaction(async (db) => {
      const products = await db('SELECT stock_quantity FROM products WHERE id=? FOR UPDATE', [product_id]);
      if (!products[0]) throw Object.assign(new Error('Không tìm thấy sản phẩm'), { status: 404 });
      const before = Number(products[0].stock_quantity);
      const after = before + stockQuantity;
      await db('UPDATE products SET stock_quantity=? WHERE id=?', [after, product_id]);
      await db(`INSERT INTO inventory_logs
        (product_id,user_id,type,quantity,before_quantity,after_quantity,reference_type,note)
        VALUES (?,?,'IMPORT',?,?,?,'MANUAL',?)`, [product_id, req.user.id, stockQuantity, before, after, note]);
    });

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

    await withTransaction(async (db) => {
      const products = await db('SELECT stock_quantity FROM products WHERE id=? FOR UPDATE', [product_id]);
      if (!products[0]) throw Object.assign(new Error('Không tìm thấy sản phẩm'), { status: 404 });
      const before = Number(products[0].stock_quantity);
      await db('UPDATE products SET stock_quantity=? WHERE id=?', [newQuantity, product_id]);
      await db(`INSERT INTO inventory_logs
        (product_id,user_id,type,quantity,before_quantity,after_quantity,reference_type,note)
        VALUES (?,?,'ADJUSTMENT',?,?,?,'MANUAL',?)`, [product_id, req.user.id, newQuantity - before, before, newQuantity, note]);
    });

    res.json({ message: 'Đã điều chỉnh tồn kho' });
  } catch (error) {
    res.status(500).json({ message: 'Không thể điều chỉnh tồn kho', error: error.message });
  }
}
