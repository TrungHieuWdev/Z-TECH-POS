import { query } from '../config/db.js';

const code = `TEST-NCC-${Date.now()}`;
let id;

try {
  const created = await query(
    `INSERT INTO suppliers (supplier_code, supplier_name, supplier_group, contact_name, status)
     VALUES (?, ?, ?, ?, 'active')`,
    [code, 'Nhà cung cấp kiểm thử', 'Nhóm phụ kiện', 'Người liên hệ A']
  );
  id = created.insertId;
  let rows = await query('SELECT supplier_group, contact_name FROM suppliers WHERE id=?', [id]);
  if (rows[0]?.supplier_group !== 'Nhóm phụ kiện' || rows[0]?.contact_name !== 'Người liên hệ A') throw new Error('Create flow did not persist fields');

  await query('UPDATE suppliers SET supplier_group=?, contact_name=? WHERE id=?', ['Nhóm sạc cáp', 'Người liên hệ B', id]);
  rows = await query('SELECT supplier_group, contact_name FROM suppliers WHERE id=?', [id]);
  if (rows[0]?.supplier_group !== 'Nhóm sạc cáp' || rows[0]?.contact_name !== 'Người liên hệ B') throw new Error('Update flow did not persist fields');

  await query('DELETE FROM suppliers WHERE id=?', [id]);
  console.log('Supplier create/update contact-group flow passed');
  process.exit(0);
} catch (error) {
  if (id) await query('DELETE FROM suppliers WHERE id=?', [id]).catch(() => {});
  console.error(error.message);
  process.exit(1);
}
