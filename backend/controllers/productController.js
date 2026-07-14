import { query } from '../config/db.js';
import { logActivity } from '../utils/activityLogger.js';
import ExcelJS from 'exceljs';
import { normalizeWarrantyPolicy } from '../utils/warrantyPolicy.js';
import { ensureGenericDeviceModel } from './deviceModelController.js';

const DEVICE_FAMILIES = new Set(['apple', 'samsung', 'vivo', 'oppo', 'xiaomi', 'generic']);
const CATEGORY_ALIASES = new Map([
  ['op lung', 'Ốp lưng'],
  ['bao da', 'Ốp lưng'],
  ['case', 'Ốp lưng'],
  ['kinh cuong luc', 'Kính cường lực'],
  ['cuong luc camera', 'Kính cường lực'],
  ['cuong luc man hinh', 'Kính cường lực'],
  ['mieng dan ppf', 'Miếng dán PPF'],
  ['ppf', 'Miếng dán PPF'],
  ['dan lung', 'Miếng dán PPF'],
  ['sac cap', 'Thiết bị sạc'],
  ['sac & cap', 'Thiết bị sạc'],
  ['thiet bi sac', 'Thiết bị sạc'],
  ['cap sac', 'Thiết bị sạc'],
  ['cu sac', 'Thiết bị sạc'],
  ['bo sac', 'Thiết bị sạc'],
  ['sac du phong', 'Thiết bị sạc'],
  ['de sac', 'Thiết bị sạc'],
  ['sac khong day', 'Thiết bị sạc'],
  ['tai nghe', 'Tai nghe'],
  ['tai nghe am thanh', 'Tai nghe'],
  ['tai nghe & am thanh', 'Tai nghe'],
  ['tai nghe co day', 'Tai nghe'],
  ['tai nghe khong day', 'Tai nghe'],
  ['loa bluetooth', 'Loa Bluetooth'],
  ['loa', 'Loa Bluetooth'],
  ['gia do dien thoai', 'Giá đỡ điện thoại'],
  ['gia do', 'Giá đỡ điện thoại'],
  ['phu kien chup anh', 'Phụ kiện chụp ảnh'],
  ['gay selfie', 'Phụ kiện chụp ảnh'],
  ['tripod', 'Phụ kiện chụp ảnh'],
  ['phu kien o to', 'Phụ kiện ô tô'],
  ['o to', 'Phụ kiện ô tô'],
  ['oto', 'Phụ kiện ô tô'],
  ['phu kien ve sinh', 'Phụ kiện vệ sinh'],
  ['ve sinh', 'Phụ kiện vệ sinh'],
  ['phu kien tien ich', 'Phụ kiện tiện ích'],
  ['tien ich', 'Phụ kiện tiện ích'],
  ['phu kien khac', 'Phụ kiện khác'],
  ['khac', 'Phụ kiện khác']
]);

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
    CASE
      WHEN LOWER(c.name) LIKE '%ốp lưng%' THEN 'op lung case cover'
      WHEN LOWER(c.name) LIKE '%sạc%' OR LOWER(c.name) LIKE '%cáp%' THEN 'sac cap charger cable cu sac bo sac'
      WHEN LOWER(c.name) LIKE '%tai nghe%' THEN 'tai nghe am thanh bluetooth earphone headphone'
      WHEN LOWER(c.name) LIKE '%cường lực%' THEN 'kinh cuong luc kinh camera glass lens'
      WHEN LOWER(c.name) LIKE '%ppf%' OR LOWER(c.name) LIKE '%tiện ích%' THEN 'gia do dan lung ppf tien ich utility'
      ELSE ''
    END
  )
`;

const genericAccessoryTextSql = `
  LOWER(CONCAT_WS(' ', p.name, p.description, c.name, dm.name, dm.series))
`;

const genericAccessoryKeywords = [
  'phụ kiện chung',
  'phu kien chung',
  'giá đỡ',
  'gia do',
  'gậy',
  'gay',
  'selfie',
  'tripod',
  'sạc dự phòng',
  'sac du phong',
  'power bank',
  '10000mah',
  'kẹp điện thoại',
  'kep dien thoai',
  'cửa gió',
  'cua gio',
  'ô tô',
  'o to',
  'đèn led',
  'den led',
  'livestream',
  'túi chống nước',
  'tui chong nuoc',
  'vệ sinh màn hình',
  've sinh man hinh',
  'dây móc',
  'day moc',
  'phone strap',
  'popsocket',
  'popsockets',
  'đế sạc',
  'de sac',
  'không dây',
  'khong day',
  'qi'
];

const modelSpecificProductNameKeywords = [
  'apple',
  'iphone',
  'ipad',
  'samsung',
  'galaxy',
  'vivo',
  'oppo',
  'reno',
  'xiaomi',
  'redmi',
  'poco'
];

function getSearchTokens(search = '') {
  return search.trim().split(/\s+/).filter(Boolean);
}

function normalizeScanCode(value = '') {
  return String(value)
    .replace(/[\r\n\t]+/g, '')
    .trim();
}

function appendGenericAccessoryFilter(sql, params) {
  const keywordConditions = genericAccessoryKeywords.map(() => `${genericAccessoryTextSql} LIKE ?`).join(' OR ');
  const modelSpecificConditions = modelSpecificProductNameKeywords
    .map(() => 'LOWER(p.name) NOT LIKE ?')
    .join(' AND ');

  params.push(...genericAccessoryKeywords.map((keyword) => `%${keyword}%`));
  params.push(...modelSpecificProductNameKeywords.map((keyword) => `%${keyword}%`));

  return `${sql} AND (dm.family = 'generic' OR (${keywordConditions})) AND (${modelSpecificConditions})`;
}

async function withResolvedDeviceModel(body) {
  if (body.device_family === 'generic' && !body.device_model_id) {
    return { ...body, device_model_id: await ensureGenericDeviceModel() };
  }

  return body;
}

function appendTextSearch(sql, params, tokens) {
  let nextSql = sql;

  for (const token of tokens) {
    nextSql += `
      AND (
        p.name LIKE ?
        OR p.sku LIKE ?
        OR p.barcode LIKE ?
        OR CONCAT('PRD-', LPAD(p.id, 4, '0')) LIKE ?
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

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

function fillMissing(current, incoming) {
  return isBlank(current) && !isBlank(incoming) ? incoming : current;
}

function inferDeviceFamily(name = '') {
  const text = normalizeHeader(name);

  if (text.includes('samsung') || text.includes('galaxy')) return 'samsung';
  if (text.includes('vivo')) return 'vivo';
  if (text.includes('oppo')) return 'oppo';
  if (text.includes('xiaomi') || text.includes('redmi') || text.includes('poco')) return 'xiaomi';
  return 'apple';
}

async function resolveImportCategory(item) {
  if (item.category_id) return Number(item.category_id);

  const rawCategoryName = String(item.category_name || item.category || item.danh_muc || 'Khác').trim() || 'Khác';
  const categoryName = CATEGORY_ALIASES.get(normalizeCategoryAlias(rawCategoryName)) || rawCategoryName;
  const existing = await query(
    'SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND is_active = 1 LIMIT 1',
    [categoryName]
  );

  if (existing[0]) return existing[0].id;

  const result = await query('INSERT INTO categories (name, description) VALUES (?, ?)', [
    categoryName,
    `Tự tạo khi import Excel: ${categoryName}`
  ]);

  return result.insertId;
}

async function resolveImportDeviceModel(item) {
  if (item.device_model_id) return Number(item.device_model_id);

  const modelName = String(item.device_model_name || item.device_model || item.dong_may || 'Phụ kiện tiện ích').trim() || 'Phụ kiện tiện ích';
  const existing = await query('SELECT id FROM device_models WHERE LOWER(name) = LOWER(?) LIMIT 1', [modelName]);

  if (existing[0]) return existing[0].id;

  const isGenericAccessory = normalizeHeader(modelName).includes('phu_kien') || normalizeHeader(modelName).includes('phu_kien_chung');
  const result = await query(
    'INSERT INTO device_models (family, name, series, release_year, notes) VALUES (?, ?, ?, ?, ?)',
    [
      inferDeviceFamily(modelName),
      modelName,
      isGenericAccessory ? 'Phụ kiện tiện ích' : 'Import Excel',
      null,
      `Tự tạo khi import Excel: ${modelName}`
    ]
  );

  return result.insertId;
}

function normalizeProductBody(body, existing = {}) {
  const warrantyPolicy = normalizeWarrantyPolicy(body, {
    ...existing,
    name: body.name?.trim() ?? existing.name,
    category_name: body.category_name ?? existing.category_name
  });

  return {
    sku: String(body.sku ?? existing.sku ?? '').trim() || null,
    barcode: String(body.barcode ?? existing.barcode ?? '').trim() || null,
    category_id: body.category_id === '' ? null : Number(body.category_id ?? existing.category_id ?? 0),
    device_model_id: body.device_model_id === '' ? null : Number(body.device_model_id ?? existing.device_model_id ?? 0),
    name: body.name?.trim() ?? existing.name,
    description: body.description?.trim() ?? existing.description ?? '',
    price: toPositiveNumber(body.price, existing.price),
    cost_price: body.cost_price === '' ? null : toPositiveNumber(body.cost_price, existing.cost_price ?? 0),
    stock_quantity: toPositiveNumber(body.stock_quantity, existing.stock_quantity ?? 0),
    min_stock: toPositiveNumber(body.min_stock, existing.min_stock ?? 5),
    image_url: body.image_url?.trim() ?? existing.image_url ?? '',
    ...warrantyPolicy
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

function appendOtherCategoryFilter(sql, params) {
  sql += " AND c.name = 'Phụ kiện khác'";
  return sql;
}

function normalizeCategoryAlias(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9&]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCell(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return String(row[key]).trim();
    }
  }

  return '';
}

async function parseProductImageRows(file) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file.buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const matrix = [];
  sheet.eachRow({ includeEmpty: false }, (row) => matrix.push(row.values.slice(1).map((value) => value?.text || value || '')));
  const headers = matrix.shift() || [];
  const rows = matrix.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));

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

  const [category] = await query('SELECT id FROM categories WHERE id = ? AND is_active = 1', [product.category_id]);
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
      const [selectedCategory] = await query('SELECT name FROM categories WHERE id = ? LIMIT 1', [category_id]);
      const canonicalCategoryName = CATEGORY_ALIASES.get(normalizeCategoryAlias(selectedCategory?.name)) || selectedCategory?.name;
      let resolvedCategoryId = category_id;

      if (canonicalCategoryName && canonicalCategoryName !== selectedCategory?.name) {
        const [canonicalCategory] = await query(
          'SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND is_active = 1 LIMIT 1',
          [canonicalCategoryName]
        );
        resolvedCategoryId = canonicalCategory?.id || category_id;
      }

      sql += ' AND p.category_id = ?';
      params.push(resolvedCategoryId);
    }

    if (device_family === 'other') {
      sql = appendOtherCategoryFilter(sql, params);
    } else if (device_family === 'generic') {
      sql = appendGenericAccessoryFilter(sql, params);
    } else if (DEVICE_FAMILIES.has(device_family)) {
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

export async function scan(req, res) {
  try {
    const code = normalizeScanCode(req.params.barcode);

    if (!code) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm với mã vạch này' });
    }

    const products = await query(
      `${productSelect}
       WHERE p.is_active = 1
         AND (
           TRIM(p.barcode) = ?
           OR LEFT(TRIM(p.barcode), 12) = ?
           OR RIGHT(TRIM(p.barcode), 12) = ?
           OR TRIM(p.sku) = ?
           OR CONCAT('PRD-', LPAD(p.id, 4, '0')) = ?
         )
       LIMIT 1`,
      [code, code, code, code, code]
    );
    const product = products[0];

    if (!product) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm với mã vạch này' });
    }

    if (Number(product.stock_quantity) <= 0) {
      return res.status(409).json({ message: 'Sản phẩm đã hết hàng' });
    }

    res.json({
      id: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      price: product.price,
      stock: product.stock_quantity,
      stock_quantity: product.stock_quantity,
      image_url: product.image_url,
      category: product.category_name || null,
      warranty_months: Number(product.warranty_period_days || 0) > 0
        ? Math.round(Number(product.warranty_period_days) / 30)
        : 0
    });
  } catch (error) {
    res.status(500).json({ message: 'Không thể quét mã sản phẩm', error: error.message });
  }
}

export async function create(req, res) {
  try {
    const product = normalizeProductBody(await withResolvedDeviceModel(req.body));
    const validationMessage = await validateProduct(product);

    if (validationMessage) {
      return res.status(400).json({ message: validationMessage });
    }

    const result = await query(
      `INSERT INTO products
        (sku, barcode, category_id, device_model_id, name, description, price, cost_price, stock_quantity, min_stock, image_url,
         warranty_enabled, warranty_period_days, warranty_type, warranty_conditions, warranty_exclusions, warranty_note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        product.sku,
        product.barcode,
        product.category_id,
        product.device_model_id,
        product.name,
        product.description,
        product.price,
        product.cost_price,
        product.stock_quantity,
        product.min_stock,
        product.image_url,
        product.warranty_enabled,
        product.warranty_period_days,
        product.warranty_type,
        product.warranty_conditions,
        product.warranty_exclusions,
        product.warranty_note
      ]
    );

    const created = await query(`${productSelect} WHERE p.id = ?`, [result.insertId]);
    await logActivity(req.user?.id, 'Thêm sản phẩm', product.name, `Tồn kho ban đầu: ${product.stock_quantity}`);
    res.status(201).json(created[0]);
  } catch (error) {
    res.status(500).json({ message: 'Không thể tạo sản phẩm', error: error.message });
  }
}

export async function importProducts(req, res) {
  try {
    const products = Array.isArray(req.body) ? req.body : req.body?.products;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: 'Danh sách sản phẩm import không hợp lệ' });
    }

    const created = [];
    const updated = [];
    let skipped = 0;

    for (const item of products) {
      const product = normalizeProductBody({
        ...item,
        category_id: await resolveImportCategory(item),
        device_model_id: await resolveImportDeviceModel(item)
      });
      const validationMessage = await validateProduct(product);

      if (validationMessage) {
        return res.status(400).json({ message: validationMessage });
      }

      const existingProducts = await query(
        'SELECT * FROM products WHERE LOWER(name) = LOWER(?) AND device_model_id = ? AND is_active = 1 LIMIT 1',
        [product.name, product.device_model_id]
      );
      const existing = existingProducts[0];

      if (existing) {
        const next = {
          category_id: existing.category_id || product.category_id,
          device_model_id: existing.device_model_id || product.device_model_id,
          name: fillMissing(existing.name, product.name),
          description: fillMissing(existing.description, product.description),
          price: Number(existing.price) > 0 ? existing.price : product.price,
          cost_price: existing.cost_price ?? product.cost_price,
          stock_quantity: existing.stock_quantity ?? product.stock_quantity,
          min_stock: existing.min_stock ?? product.min_stock,
          image_url: fillMissing(existing.image_url, product.image_url)
          ,
          warranty_enabled: existing.warranty_enabled ?? product.warranty_enabled,
          warranty_period_days: existing.warranty_period_days ?? product.warranty_period_days,
          warranty_type: existing.warranty_type ?? product.warranty_type,
          warranty_conditions: fillMissing(existing.warranty_conditions, product.warranty_conditions),
          warranty_exclusions: fillMissing(existing.warranty_exclusions, product.warranty_exclusions),
          warranty_note: fillMissing(existing.warranty_note, product.warranty_note)
        };

        const hasMissingField =
          next.category_id !== existing.category_id ||
          next.device_model_id !== existing.device_model_id ||
          next.name !== existing.name ||
          next.description !== existing.description ||
          Number(next.price) !== Number(existing.price) ||
          next.cost_price !== existing.cost_price ||
          next.stock_quantity !== existing.stock_quantity ||
          next.min_stock !== existing.min_stock ||
          next.image_url !== existing.image_url ||
          next.warranty_enabled !== existing.warranty_enabled ||
          next.warranty_period_days !== existing.warranty_period_days ||
          next.warranty_type !== existing.warranty_type ||
          next.warranty_conditions !== existing.warranty_conditions ||
          next.warranty_exclusions !== existing.warranty_exclusions ||
          next.warranty_note !== existing.warranty_note;

        if (!hasMissingField) {
          skipped += 1;
          continue;
        }

        await query(
          `UPDATE products
           SET category_id = ?, device_model_id = ?, name = ?, description = ?, price = ?, cost_price = ?,
               stock_quantity = ?, min_stock = ?, image_url = ?, warranty_enabled = ?, warranty_period_days = ?,
               warranty_type = ?, warranty_conditions = ?, warranty_exclusions = ?, warranty_note = ?
           WHERE id = ?`,
          [
            next.category_id,
            next.device_model_id,
            next.name,
            next.description,
            next.price,
            next.cost_price,
            next.stock_quantity,
            next.min_stock,
            next.image_url,
            next.warranty_enabled,
            next.warranty_period_days,
            next.warranty_type,
            next.warranty_conditions,
            next.warranty_exclusions,
            next.warranty_note,
            existing.id
          ]
        );

        updated.push(existing.id);
        continue;
      }

      const result = await query(
        `INSERT INTO products
          (category_id, device_model_id, name, description, price, cost_price, stock_quantity, min_stock, image_url,
           warranty_enabled, warranty_period_days, warranty_type, warranty_conditions, warranty_exclusions, warranty_note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          product.warranty_enabled,
          product.warranty_period_days,
          product.warranty_type,
          product.warranty_conditions,
          product.warranty_exclusions,
          product.warranty_note
        ]
      );

      created.push(result.insertId);
    }

    res.status(201).json({
      message: `Đã import ${created.length} sản phẩm`,
      imported: created.length,
      updated: updated.length,
      skipped,
      ids: created,
      updatedIds: updated
    });
  } catch (error) {
    res.status(500).json({ message: 'Không thể import sản phẩm', error: error.message });
  }
}

export async function update(req, res) {
  try {
    const current = await query('SELECT * FROM products WHERE id = ? AND is_active = 1', [req.params.id]);

    if (!current[0]) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }

    const product = normalizeProductBody(await withResolvedDeviceModel(req.body), current[0]);
    const validationMessage = await validateProduct(product);

    if (validationMessage) {
      return res.status(400).json({ message: validationMessage });
    }

    await query(
      `UPDATE products
       SET sku = ?, barcode = ?, category_id = ?, device_model_id = ?, name = ?, description = ?, price = ?, cost_price = ?,
           stock_quantity = ?, min_stock = ?, image_url = ?, warranty_enabled = ?, warranty_period_days = ?,
           warranty_type = ?, warranty_conditions = ?, warranty_exclusions = ?, warranty_note = ?
       WHERE id = ?`,
      [
        product.sku,
        product.barcode,
        product.category_id,
        product.device_model_id,
        product.name,
        product.description,
        product.price,
        product.cost_price,
        product.stock_quantity,
        product.min_stock,
        product.image_url,
        product.warranty_enabled,
        product.warranty_period_days,
        product.warranty_type,
        product.warranty_conditions,
        product.warranty_exclusions,
        product.warranty_note,
        req.params.id
      ]
    );

    const updated = await query(`${productSelect} WHERE p.id = ?`, [req.params.id]);
    await logActivity(req.user?.id, 'Sửa sản phẩm', product.name, Number(current[0].stock_quantity) !== Number(product.stock_quantity) ? `Cập nhật tồn kho: ${current[0].stock_quantity} → ${product.stock_quantity}` : 'Cập nhật thông tin sản phẩm');
    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ message: 'Không thể cập nhật sản phẩm', error: error.message });
  }
}

export async function remove(req, res) {
  try {
    const products = await query('SELECT name FROM products WHERE id = ?', [req.params.id]);

    if (!products[0]) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }

    const result = await query('DELETE FROM products WHERE id = ?', [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }

    await logActivity(req.user?.id, 'Xóa sản phẩm', products[0].name, 'Sản phẩm đã được xóa khỏi MySQL');
    res.json({ message: 'Đã xóa sản phẩm khỏi dữ liệu MySQL' });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({
        message: 'Không thể xóa sản phẩm đã có lịch sử bán hàng hoặc nhập kho'
      });
    }

    res.status(500).json({ message: 'Không thể xóa sản phẩm', error: error.message });
  }
}

export async function importImages(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng chọn file CSV hoặc Excel' });
    }

    const rows = await parseProductImageRows(req.file);

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
