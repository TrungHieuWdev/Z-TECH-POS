import { query } from '../config/db.js';

const canonicalCategories = [
  { name: 'Ốp lưng', description: 'Ốp lưng, bao da, case bảo vệ điện thoại.' },
  { name: 'Kính cường lực', description: 'Kính cường lực màn hình và camera.' },
  { name: 'Miếng dán PPF', description: 'Miếng dán PPF, dán lưng, dán viền bảo vệ máy.' },
  { name: 'Thiết bị sạc', description: 'Củ sạc, cáp sạc, bộ sạc, sạc dự phòng, đế sạc không dây và phụ kiện nguồn.' },
  { name: 'Tai nghe', description: 'Tai nghe có dây, không dây, Bluetooth và phụ kiện âm thanh cá nhân.' },
  { name: 'Loa Bluetooth', description: 'Loa Bluetooth, loa mini và phụ kiện loa.' },
  { name: 'Giá đỡ điện thoại', description: 'Giá đỡ, chân đế, kẹp điện thoại, holder.' },
  { name: 'Phụ kiện chụp ảnh', description: 'Gậy selfie, tripod, đèn livestream, remote chụp ảnh.' },
  { name: 'Phụ kiện ô tô', description: 'Phụ kiện điện thoại dùng trên ô tô.' },
  { name: 'Phụ kiện vệ sinh', description: 'Bộ vệ sinh, khăn lau, dung dịch vệ sinh thiết bị.' },
  { name: 'Phụ kiện tiện ích', description: 'Các phụ kiện tiện ích dùng chung.' },
  { name: 'Phụ kiện khác', description: 'Sản phẩm chưa thuộc các nhóm còn lại.' }
];

const aliasToCanonical = new Map([
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
  ['tai nghe', 'Tai nghe'],
  ['tai nghe co day', 'Tai nghe'],
  ['tai nghe khong day', 'Tai nghe'],
  ['loa bluetooth', 'Loa Bluetooth'],
  ['loa', 'Loa Bluetooth'],
  ['gia do dien thoai', 'Giá đỡ điện thoại'],
  ['gia do', 'Giá đỡ điện thoại'],
  ['de dien thoai', 'Giá đỡ điện thoại'],
  ['kep dien thoai', 'Giá đỡ điện thoại'],
  ['phu kien chup anh', 'Phụ kiện chụp ảnh'],
  ['gay selfie', 'Phụ kiện chụp ảnh'],
  ['tripod', 'Phụ kiện chụp ảnh'],
  ['den livestream', 'Phụ kiện chụp ảnh'],
  ['phu kien o to', 'Phụ kiện ô tô'],
  ['o to', 'Phụ kiện ô tô'],
  ['oto', 'Phụ kiện ô tô'],
  ['xe hoi', 'Phụ kiện ô tô'],
  ['phu kien ve sinh', 'Phụ kiện vệ sinh'],
  ['ve sinh', 'Phụ kiện vệ sinh'],
  ['khan lau', 'Phụ kiện vệ sinh'],
  ['phu kien tien ich', 'Phụ kiện tiện ích'],
  ['tien ich', 'Phụ kiện tiện ích'],
  ['phu kien khac', 'Phụ kiện khác'],
  ['khac', 'Phụ kiện khác']
]);

function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function hasAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function inferCategory(product) {
  const text = normalizeText([
    product.name,
    product.description,
    product.category_name,
    product.device_model,
    product.device_series
  ].filter(Boolean).join(' '));

  if (hasAny(text, ['ppf', 'dan lung', 'dan vien', 'dan ppf'])) return 'Miếng dán PPF';
  if (hasAny(text, ['kinh cuong luc', 'cuong luc', 'glass', 'camera lens', 'kinh camera'])) return 'Kính cường lực';
  if (hasAny(text, ['op lung', 'bao da', 'case', 'cover', 'chong soc', 'lung trong'])) return 'Ốp lưng';
  if (hasAny(text, ['loa bluetooth', 'loa mini', 'speaker'])) return 'Loa Bluetooth';
  if (hasAny(text, ['tai nghe', 'airpods', 'earphone', 'headphone', 'buds', 'enco', 'tws'])) return 'Tai nghe';
  if (hasAny(text, ['sac du phong', 'cu sac', 'cap sac', 'bo sac', 'de sac', 'sac khong day', 'sac nhanh', 'fast charge', 'qi', 'adapter', 'charger', 'charge', 'cable', 'lightning', 'type c', 'usb c', 'magsafe'])) return 'Thiết bị sạc';
  if (hasAny(text, ['gia do dien thoai', 'gia do', 'chan de', 'de dien thoai', 'kep dien thoai', 'phone holder', 'holder'])) return 'Giá đỡ điện thoại';
  if (hasAny(text, ['gay selfie', 'tripod', 'remote chup', 'den livestream', 'den led', 'ring light', 'chup anh'])) return 'Phụ kiện chụp ảnh';
  if (hasAny(text, ['o to', 'oto', 'xe hoi', 'cua gio', 'taplo', 'car mount', 'tren xe'])) return 'Phụ kiện ô tô';
  if (hasAny(text, ['ve sinh', 'khan lau', 'dung dich', 'bo ve sinh', 'clean', 'cleaning'])) return 'Phụ kiện vệ sinh';
  if (hasAny(text, ['tui chong nuoc', 'day deo', 'moc khoa', 'popsocket', 'pop socket', 'tien ich'])) return 'Phụ kiện tiện ích';

  const normalizedCategory = normalizeText(product.category_name);
  return aliasToCanonical.get(normalizedCategory) || 'Phụ kiện khác';
}

async function ensureCanonicalCategories() {
  const categoryByName = new Map();

  for (const category of canonicalCategories) {
    const [existing] = await query('SELECT id FROM categories WHERE LOWER(name) = LOWER(?) LIMIT 1', [category.name]);

    if (existing) {
      await query(
        'UPDATE categories SET name = ?, description = ?, is_active = 1 WHERE id = ?',
        [category.name, category.description, existing.id]
      );
      categoryByName.set(category.name, existing.id);
      continue;
    }

    const result = await query(
      'INSERT INTO categories (name, description, is_active) VALUES (?, ?, 1)',
      [category.name, category.description]
    );
    categoryByName.set(category.name, result.insertId);
  }

  return categoryByName;
}

async function migrateProducts(categoryByName) {
  const products = await query(`
    SELECT
      p.id,
      p.name,
      p.description,
      c.name AS category_name,
      dm.name AS device_model,
      dm.series AS device_series
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN device_models dm ON p.device_model_id = dm.id
    WHERE p.is_active = 1
  `);

  const summary = new Map(canonicalCategories.map((category) => [category.name, 0]));

  for (const product of products) {
    const categoryName = inferCategory(product);
    const categoryId = categoryByName.get(categoryName) || categoryByName.get('Phụ kiện khác');

    await query('UPDATE products SET category_id = ? WHERE id = ?', [categoryId, product.id]);
    summary.set(categoryName, (summary.get(categoryName) || 0) + 1);
  }

  return summary;
}

async function hideUnusedNonCanonicalCategories() {
  const canonicalNames = canonicalCategories.map((category) => category.name);
  const placeholders = canonicalNames.map(() => '?').join(', ');

  await query(
    `UPDATE categories
     SET is_active = 0
     WHERE name NOT IN (${placeholders})
       AND id NOT IN (SELECT DISTINCT category_id FROM products WHERE category_id IS NOT NULL)`,
    canonicalNames
  );
}

async function main() {
  const categoryByName = await ensureCanonicalCategories();
  const summary = await migrateProducts(categoryByName);
  await hideUnusedNonCanonicalCategories();

  console.log('Đã chuẩn hóa danh mục và phân loại sản phẩm:');
  for (const [category, count] of summary.entries()) {
    console.log(`- ${category}: ${count} sản phẩm`);
  }
}

main().catch((error) => {
  console.error('Không thể chuẩn hóa danh mục:', error);
  process.exitCode = 1;
});
