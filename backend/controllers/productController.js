import { query } from '../config/db.js';

const DEVICE_FAMILIES = new Set(['apple', 'samsung', 'vivo', 'oppo', 'xiaomi']);

function getSearchTokens(search = '') {
  return search.trim().split(/\s+/).filter(Boolean);
}

function appendTextSearch(sql, params, tokens) {
  let nextSql = sql;

  for (const token of tokens) {
    nextSql += ' AND (p.name LIKE ? OR p.description LIKE ? OR dm.name LIKE ? OR c.name LIKE ?)';
    params.push(`%${token}%`, `%${token}%`, `%${token}%`, `%${token}%`);
  }

  return nextSql;
}

function toPositiveNumber(value, fallback = 0) {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function normalizeProductBody(body, existing = {}) {
  return {
    category_id: body.category_id === '' ? null : Number(body.category_id ?? existing.category_id ?? 0),
    device_model_id: body.device_model_id === '' ? null : Number(body.device_model_id ?? existing.device_model_id ?? 0),
    name: body.name?.trim() ?? existing.name,
    description: body.description?.trim() ?? existing.description ?? '',
    price: toPositiveNumber(body.price, existing.price),
    cost_price: body.cost_price === '' ? null : toPositiveNumber(body.cost_price, existing.cost_price ?? 0),
    stock_quantity: toPositiveNumber(body.stock_quantity, existing.stock_quantity ?? 0),
    min_stock: toPositiveNumber(body.min_stock, existing.min_stock ?? 5),
    image_url: body.image_url?.trim() ?? existing.image_url ?? ''
  };
}

async function validateProduct(product) {
  if (!product.name || product.price === undefined || product.price <= 0) {
    return 'Tên và giá bán lớn hơn 0 là bắt buộc';
  }

  if (!product.category_id) {
    return 'Danh mục sản phẩm là bắt buộc';
  }

  if (!product.device_model_id) {
    return 'Model máy là bắt buộc';
  }

  const [category] = await query('SELECT id FROM categories WHERE id = ?', [product.category_id]);
  if (!category) {
    return 'Danh mục không hợp lệ';
  }

  const [deviceModel] = await query('SELECT id FROM device_models WHERE id = ?', [product.device_model_id]);
  if (!deviceModel) {
    return 'Model máy không hợp lệ';
  }

  return null;
}

const productSelect = `
  SELECT
    p.*,
    c.name AS category_name,
    dm.family AS device_family,
    dm.name AS device_model,
    dm.series AS device_series,
    dm.release_year AS device_release_year
  FROM products p
  JOIN device_models dm ON p.device_model_id = dm.id
  LEFT JOIN categories c ON p.category_id = c.id
`;

export async function getAll(req, res) {
  try {
    const { category_id, search = '', device_family, device_model_id } = req.query;
    const params = [];
    let sql = `${productSelect} WHERE p.is_active = 1`;

    if (category_id) {
      sql += ' AND p.category_id = ?';
      params.push(category_id);
    }

    if (DEVICE_FAMILIES.has(device_family)) {
      sql += ' AND dm.family = ?';
      params.push(device_family);
    }

    if (device_model_id) {
      sql += ' AND p.device_model_id = ?';
      params.push(device_model_id);
    }

    sql = appendTextSearch(sql, params, getSearchTokens(search));
    sql += ' ORDER BY dm.family, dm.release_year DESC, dm.name, c.name, p.name';

    const products = await query(sql, params);
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Không thể lấy danh sách sản phẩm', error: error.message });
  }
}

export async function getById(req, res) {
  try {
    const products = await query(
      `${productSelect} WHERE p.id = ? AND p.is_active = 1`,
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
    const validationMessage = await validateProduct(product);

    if (validationMessage) {
      return res.status(400).json({ message: validationMessage });
    }

    const result = await query(
      `INSERT INTO products
        (category_id, device_model_id, name, description, price, cost_price, stock_quantity, min_stock, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        product.category_id,
        product.device_model_id,
        product.name,
        product.description,
        product.price,
        product.cost_price,
        product.stock_quantity,
        product.min_stock,
        product.image_url
      ]
    );

    const created = await query(`${productSelect} WHERE p.id = ?`, [result.insertId]);
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
    const validationMessage = await validateProduct(product);

    if (validationMessage) {
      return res.status(400).json({ message: validationMessage });
    }

    await query(
      `UPDATE products
       SET category_id = ?, device_model_id = ?, name = ?, description = ?, price = ?, cost_price = ?,
           stock_quantity = ?, min_stock = ?, image_url = ?
       WHERE id = ?`,
      [
        product.category_id,
        product.device_model_id,
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

    const updated = await query(`${productSelect} WHERE p.id = ?`, [req.params.id]);
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
