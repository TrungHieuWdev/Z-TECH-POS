import { query } from '../config/db.js';

async function ignoreExistingColumn(error) {
  if (error.code !== 'ER_DUP_FIELDNAME') throw error;
}

async function ignoreExistingIndex(error) {
  if (error.code !== 'ER_DUP_KEYNAME') throw error;
}

async function run() {
  await query('ALTER TABLE products ADD COLUMN sku VARCHAR(100) NULL AFTER id').catch(ignoreExistingColumn);
  await query('ALTER TABLE products ADD COLUMN barcode VARCHAR(100) NULL AFTER sku').catch(ignoreExistingColumn);
  await query("UPDATE products SET sku = NULL WHERE TRIM(COALESCE(sku, '')) = ''");
  await query("UPDATE products SET barcode = NULL WHERE TRIM(COALESCE(barcode, '')) = ''");

  const duplicateSku = await query('SELECT sku FROM products WHERE sku IS NOT NULL GROUP BY sku HAVING COUNT(*) > 1');
  const duplicateBarcode = await query('SELECT barcode FROM products WHERE barcode IS NOT NULL GROUP BY barcode HAVING COUNT(*) > 1');

  if (duplicateSku.length || duplicateBarcode.length) {
    throw new Error('Có SKU hoặc barcode trùng; hãy xử lý dữ liệu trùng trước khi tạo unique index');
  }

  await query('CREATE UNIQUE INDEX uk_products_sku ON products (sku)').catch(ignoreExistingIndex);
  await query('CREATE UNIQUE INDEX uk_products_barcode ON products (barcode)').catch(ignoreExistingIndex);
  console.log('Đã thêm sku, barcode và unique index an toàn.');
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
