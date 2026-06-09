import { query } from '../config/db.js';

function normalizeProductBody(body, existing = {}) {
  return {
    category_id: body.category_id === '' ? null : body.category_id ?? existing.category_id ?? null,
    name: body.name ?? existing.name,
    description: body.description ?? existing.description ?? '',
    price: body.price ?? existing.price,
    cost_price: body.cost_price === '' ? null : body.cost_price ?? existing.cost_price ?? null,
    stock_quantity: body.stock_quantity ?? existing.stock_quantity ?? 0,
    min_stock: body.min_stock ?? existing.min_stock ?? 5,
    image_url: body.image_url ?? existing.image_url ?? ''
  };
}

export async function getAll(req, res) {
  try {
    const { category_id, search } = req.query;
    const params = [];
    let sql = `
      SELECT p.*, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1
    `;

    if (category_id) {
      sql += ' AND p.category_id = ?';
      params.push(category_id);
    }

    if (search) {
      sql += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY p.created_at DESC';

    const products = await query(sql, params);
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Không thể lấy danh sách sản phẩm', error: error.message });
  }
}

export async function getById(req, res) {
  try {
    const products = await query(
      `SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = ? AND p.is_active = 1`,
      [req.params.id]
    );

    if (!products[0]) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }

    res.json(products[0]);
  } catch (error) {
    res.status(500).json({ message: 'Không thể lấy sản phẩm', error: error.message });
  }
}

export async function create(req, res) {
  try {
    const product = normalizeProductBody(req.body);

    if (!product.name || product.price === undefined) {
      return res.status(400).json({ message: 'Tên và giá sản phẩm là bắt buộc' });
    }

    const result = await query(
      `INSERT INTO products
        (category_id, name, description, price, cost_price, stock_quantity, min_stock, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        product.category_id,
        product.name,
        product.description,
        product.price,
        product.cost_price,
        product.stock_quantity,
        product.min_stock,
        product.image_url
      ]
    );

    const created = await query('SELECT * FROM products WHERE id = ?', [result.insertId]);
    res.status(201).json(created[0]);
  } catch (error) {
    res.status(500).json({ message: 'Không thể tạo sản phẩm', error: error.message });
  }
}

export async function update(req, res) {
  try {
    const current = await query('SELECT * FROM products WHERE id = ? AND is_active = 1', [req.params.id]);

    if (!current[0]) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }

    const product = normalizeProductBody(req.body, current[0]);

    await query(
      `UPDATE products
       SET category_id = ?, name = ?, description = ?, price = ?, cost_price = ?,
           stock_quantity = ?, min_stock = ?, image_url = ?
       WHERE id = ?`,
      [
        product.category_id,
        product.name,
        product.description,
        product.price,
        product.cost_price,
        product.stock_quantity,
        product.min_stock,
        product.image_url,
        req.params.id
      ]
    );

    const updated = await query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ message: 'Không thể cập nhật sản phẩm', error: error.message });
  }
}

export async function remove(req, res) {
  try {
    const result = await query('UPDATE products SET is_active = 0 WHERE id = ?', [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }

    res.json({ message: 'Đã xóa sản phẩm' });
  } catch (error) {
    res.status(500).json({ message: 'Không thể xóa sản phẩm', error: error.message });
  }
}
