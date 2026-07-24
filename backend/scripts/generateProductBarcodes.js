import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from '../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(__dirname, '../generated');
const outputFile = path.join(outputDir, 'product-barcodes.html');

const LEFT_ODD = {
  0: '0001101', 1: '0011001', 2: '0010011', 3: '0111101', 4: '0100011',
  5: '0110001', 6: '0101111', 7: '0111011', 8: '0110111', 9: '0001011'
};
const LEFT_EVEN = {
  0: '0100111', 1: '0110011', 2: '0011011', 3: '0100001', 4: '0011101',
  5: '0111001', 6: '0000101', 7: '0010001', 8: '0001001', 9: '0010111'
};
const RIGHT = {
  0: '1110010', 1: '1100110', 2: '1101100', 3: '1000010', 4: '1011100',
  5: '1001110', 6: '1010000', 7: '1000100', 8: '1001000', 9: '1110100'
};
const PARITY = {
  0: 'OOOOOO', 1: 'OOEOEE', 2: 'OOEEOE', 3: 'OOEEEO', 4: 'OEOOEE',
  5: 'OEEOOE', 6: 'OEEEOO', 7: 'OEOEOE', 8: 'OEOEEO', 9: 'OEEOEO'
};

function ean13CheckDigit(first12Digits) {
  const sum = [...first12Digits].reduce((total, digit, index) => {
    const value = Number(digit);
    return total + value * (index % 2 === 0 ? 1 : 3);
  }, 0);
  return String((10 - (sum % 10)) % 10);
}

function makeInternalEan13(productId, offset = 0) {
  const baseNumber = Number(productId) + offset;
  const first12Digits = `20${String(baseNumber).padStart(10, '0').slice(-10)}`;
  return `${first12Digits}${ean13CheckDigit(first12Digits)}`;
}

function encodeEan13(value) {
  const digits = String(value).replace(/\D/g, '');
  const ean13Digits = digits.length === 12 ? `0${digits}` : digits;
  if (!/^\d{13}$/.test(ean13Digits)) throw new Error(`EAN/UPC không hợp lệ: ${value}`);
  if (ean13CheckDigit(ean13Digits.slice(0, 12)) !== ean13Digits[12]) throw new Error(`Sai check digit EAN/UPC: ${value}`);

  const parity = PARITY[ean13Digits[0]];
  let bits = '101';
  for (let index = 1; index <= 6; index += 1) {
    bits += parity[index - 1] === 'O' ? LEFT_ODD[ean13Digits[index]] : LEFT_EVEN[ean13Digits[index]];
  }
  bits += '01010';
  for (let index = 7; index <= 12; index += 1) bits += RIGHT[ean13Digits[index]];
  bits += '101';
  return bits;
}

function barcodeSvg(value) {
  const bits = encodeEan13(value);
  const moduleWidth = 2.2;
  const barHeight = 72;
  const textHeight = 24;
  // Chừa 12 module trắng mỗi bên (cao hơn mức tối thiểu của EAN-13)
  // để tem vẫn dễ quét khi in trên máy in nhiệt có sai lệch nhỏ.
  const quiet = moduleWidth * 12;
  const width = bits.length * moduleWidth + quiet * 2;
  const height = barHeight + textHeight;
  const bars = [...bits].map((bit, index) => (
    bit === '1'
      ? `<rect x="${quiet + index * moduleWidth}" y="0" width="${moduleWidth}" height="${barHeight}" />`
      : ''
  )).join('');

  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${value}">
    <rect width="${width}" height="${height}" fill="#fff"/>
    <g fill="#111">${bars}</g>
    <text x="${width / 2}" y="${height - 4}" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" letter-spacing="4">${value}</text>
  </svg>`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

async function ensureBarcodeSchema() {
  await query("UPDATE products SET sku = NULL WHERE TRIM(COALESCE(sku, '')) = ''");
  const columns = await query("SHOW COLUMNS FROM products LIKE 'barcode'");
  if (!columns.length) {
    await query('ALTER TABLE products ADD COLUMN barcode VARCHAR(50) NULL AFTER sku');
  }
  await query("UPDATE products SET barcode = NULL WHERE TRIM(COALESCE(barcode, '')) = ''");

  const indexes = await query("SHOW INDEX FROM products WHERE Key_name = 'uk_products_barcode'");
  if (!indexes.length) {
    await query('CREATE UNIQUE INDEX uk_products_barcode ON products (barcode)');
  }

  const skuIndexes = await query("SHOW INDEX FROM products WHERE Column_name = 'sku'");
  if (!skuIndexes.length) {
    await query('CREATE UNIQUE INDEX uk_products_sku ON products (sku)');
  }
}

async function assignMissingSkus() {
  const existingRows = await query('SELECT sku FROM products WHERE sku IS NOT NULL');
  const used = new Set(existingRows.map((row) => String(row.sku).toUpperCase()));
  const missingProducts = await query('SELECT id, name FROM products WHERE sku IS NULL ORDER BY id');
  const assigned = [];

  for (const product of missingProducts) {
    const baseSku = `PRD-${String(product.id).padStart(4, '0')}`;
    let sku = baseSku;
    let suffix = 2;
    while (used.has(sku.toUpperCase())) {
      sku = `${baseSku}-${suffix}`;
      suffix += 1;
    }
    await query('UPDATE products SET sku = ? WHERE id = ? AND sku IS NULL', [sku, product.id]);
    used.add(sku.toUpperCase());
    assigned.push({ ...product, sku });
  }

  return assigned;
}

async function assignMissingBarcodes() {
  const existingRows = await query('SELECT barcode FROM products WHERE barcode IS NOT NULL');
  const used = new Set(existingRows.map((row) => String(row.barcode)));
  const missingProducts = await query('SELECT id, name FROM products WHERE barcode IS NULL ORDER BY id');
  const assigned = [];

  for (const product of missingProducts) {
    let offset = 0;
    let barcode = makeInternalEan13(product.id, offset);
    while (used.has(barcode)) {
      offset += 100000;
      barcode = makeInternalEan13(product.id, offset);
    }
    await query('UPDATE products SET barcode = ? WHERE id = ?', [barcode, product.id]);
    used.add(barcode);
    assigned.push({ ...product, barcode });
  }

  return assigned;
}

function buildHtml(products) {
  const generatedAt = new Date().toLocaleString('vi-VN');
  const labels = products.map((product) => `
    <article class="label">
      <div class="name">${escapeHtml(product.name)}</div>
      <div class="sku">${escapeHtml(product.sku || '')}</div>
      ${barcodeSvg(product.barcode)}
      <div class="price">${Number(product.price || 0).toLocaleString('vi-VN')} đ</div>
    </article>
  `).join('');

  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>Mã vạch sản phẩm POS</title>
  <style>
    @page { size: A4; margin: 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, sans-serif; color: #111827; }
    .toolbar { margin-bottom: 10mm; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .toolbar h1 { margin: 0; font-size: 18px; }
    .toolbar p { margin: 4px 0 0; color: #6b7280; font-size: 12px; }
    .toolbar button { border: 1px solid #94a3b8; background: #fff; padding: 8px 14px; font-weight: 700; cursor: pointer; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8mm 6mm; }
    .label { min-height: 42mm; border: 1px solid #d1d5db; padding: 3mm; text-align: center; break-inside: avoid; }
    .name { height: 24px; overflow: hidden; font-size: 11px; font-weight: 700; line-height: 12px; }
    .sku { height: 14px; color: #6b7280; font-size: 10px; }
    svg { width: 100%; height: 26mm; display: block; }
    .price { margin-top: 1mm; font-size: 11px; font-weight: 700; color: #0f766e; }
    @media print { .toolbar { display: none; } }
  </style>
</head>
<body>
  <header class="toolbar">
    <div><h1>Mã vạch sản phẩm POS</h1><p>${products.length} sản phẩm · Tạo lúc ${generatedAt}</p></div>
    <button onclick="window.print()">In mã vạch</button>
  </header>
  <main class="grid">${labels}</main>
</body>
</html>`;
}

async function run() {
  await ensureBarcodeSchema();
  const assignedSkus = await assignMissingSkus();
  const assignedBarcodes = await assignMissingBarcodes();
  const products = await query(`
    SELECT id, name, sku, barcode, price
    FROM products
    WHERE is_active = 1 AND barcode IS NOT NULL
    ORDER BY id
  `);

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputFile, buildHtml(products), 'utf8');

  const [verification] = await query(`
    SELECT COUNT(*) AS total,
      SUM(sku IS NULL OR TRIM(sku) = '') AS missing_sku,
      SUM(barcode IS NULL OR TRIM(barcode) = '') AS missing_barcode,
      COUNT(DISTINCT sku) AS unique_skus,
      COUNT(DISTINCT barcode) AS unique_barcodes
    FROM products
  `);

  console.log(`Đã gán mới ${assignedSkus.length} SKU.`);
  console.log(`Đã gán mới ${assignedBarcodes.length} mã vạch.`);
  console.log('Kiểm tra database:', verification);
  console.log(`Đã tạo file in mã vạch: ${outputFile}`);
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
