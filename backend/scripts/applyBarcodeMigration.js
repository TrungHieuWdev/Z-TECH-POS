import { query } from '../config/db.js';

async function run() {
  const columns = await query("SHOW COLUMNS FROM products LIKE 'barcode'");
  if (!columns.length) {
    await query('ALTER TABLE products ADD COLUMN barcode VARCHAR(50) NULL AFTER sku');
  } else if (String(columns[0].Type).toLowerCase() !== 'varchar(50)') {
    await query('ALTER TABLE products MODIFY COLUMN barcode VARCHAR(50) NULL');
  }

  await query("UPDATE products SET barcode = NULL WHERE TRIM(COALESCE(barcode, '')) = ''");

  const indexes = await query("SHOW INDEX FROM products WHERE Column_name = 'barcode'");
  if (!indexes.length) {
    await query('CREATE UNIQUE INDEX uk_products_barcode ON products (barcode)');
  }

  await query("UPDATE products SET sku = 'PRD-0277' WHERE id = 277 AND sku IS NULL");
  await query("UPDATE products SET sku = 'PRD-0278' WHERE id = 278 AND sku IS NULL");
  await query("UPDATE products SET barcode = '194644197421' WHERE sku = 'PRD-0277'");
  await query("UPDATE products SET barcode = '8938555972973' WHERE sku = 'PRD-0278'");

  const products = await query(
    "SELECT id, name, sku, barcode, price, stock_quantity AS stock FROM products WHERE sku IN ('PRD-0277', 'PRD-0278')"
  );
  console.table(products);

  if (products.length !== 2) {
    throw new Error('Không tìm thấy đủ 2 sản phẩm theo SKU PRD-0277 và PRD-0278');
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
