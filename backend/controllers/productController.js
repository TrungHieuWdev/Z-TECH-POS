import { query } from '../config/db.js';
import XLSX from 'xlsx';

const DEVICE_FAMILIES = new Set(['apple', 'samsung', 'vivo', 'oppo', 'xiaomi']);

const searchAliasSql = `
  CONCAT_WS(' ',
    dm.family,
    dm.name,
    dm.series,
    CASE dm.family
      WHEN 'apple' THEN 'apple iphone ios'
      WHEN 'samsung' THEN 'samsung galaxy'
      WHEN 'vivo' THEN 'vivo'
      WHEN 'oppo' THEN 'oppo'
      WHEN 'xiaomi' THEN 'xiaomi redmi poco mi'
      ELSE ''
    END,
    CASE p.category_id
      WHEN 1 THEN 'op lung case cover'
      WHEN 2 THEN 'sac cap charger cable cu sac bo sac'
      WHEN 3 THEN 'tai nghe am thanh bluetooth earphone headphone'
      WHEN 4 THEN 'kinh cuong luc kinh camera glass lens'
      WHEN 5 THEN 'gia do dan lung tien ich utility'
      ELSE ''
    END
  )
`;

function getSearchTokens(search = '') {
  return search.trim().split(/\s+/).filter(Boolean);
}

function appendTextSearch(sql, params, tokens) {
  let nextSql = sql;

  for (const token of tokens) {
    nextSql += `
      AND (
        p.name LIKE ?
        OR p.description LIKE ?
        OR dm.name LIKE ?
        OR dm.series LIKE ?
        OR dm.family LIKE ?
        OR c.name LIKE ?
        OR ${searchAliasSql} LIKE ?
      )
    `;
    params.push(
      `%${token}%`,
      `%${token}%`,
      `%${token}%`,
      `%${token}%`,
      `%${token}%`,
      `%${token}%`,
      `%${token}%`
    );
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

function normalizeHeader(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getCell(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return String(row[key]).trim();
    }
  }

  return '';
}

function parseProductImageRows(file) {
  const workbook = XLSX.read(file.buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    return [];
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

  return rows.map((row) => {
    const normalized = {};

    for (const [key, value] of Object.entries(row)) {
      normalized[normalizeHeader(key)] = value;
    }

    return normalized;
  });
}

function parseProductId(value = '') {
  const text = String(value).trim();
  const match = text.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
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

export async function importImages(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng chọn file CSV hoặc Excel' });
    }

    const rows = parseProductImageRows(req.file);

    if (rows.length === 0) {
      return res.status(400).json({ message: 'File không có dữ liệu import' });
    }

    const errors = [];
    let updated = 0;
    let skipped = 0;

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2;
      const imageUrl = getCell(row, ['image_url', 'image', 'url', 'link_anh', 'anh', 'hinh_anh']);
      const productId = parseProductId(getCell(row, ['id', 'product_id', 'ma_san_pham', 'sku']));
      const productName = getCell(row, ['name', 'ten', 'ten_san_pham', 'product_name']);

      if (!imageUrl) {
        skipped += 1;
        errors.push({ row: rowNumber, message: 'Thiếu image_url' });
        continue;
      }

      let result;

      if (productId > 0) {
        result = await query(
          'UPDATE products SET image_url = ? WHERE id = ? AND is_active = 1',
          [imageUrl, productId]
        );
      } else if (productName) {
        result = await query(
          'UPDATE products SET image_url = ? WHERE name = ? AND is_active = 1',
          [imageUrl, productName]
        );
      } else {
        skipped += 1;
        errors.push({ row: rowNumber, message: 'Thiếu id, sku hoặc tên sản phẩm' });
        continue;
      }

      if (result.affectedRows === 0) {
        skipped += 1;
        errors.push({ row: rowNumber, message: 'Không tìm thấy sản phẩm phù hợp' });
        continue;
      }

      updated += result.affectedRows;
    }

    res.json({
      message: `Đã cập nhật ${updated} ảnh sản phẩm`,
      updated,
      skipped,
      errors: errors.slice(0, 30)
    });
  } catch (error) {
    res.status(500).json({ message: 'Không thể import ảnh sản phẩm', error: error.message });
  }
}
