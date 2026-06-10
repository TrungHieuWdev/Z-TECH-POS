import { query } from '../config/db.js';

const result = await query(`
  UPDATE products p
  JOIN device_models dm ON p.device_model_id = dm.id
  SET p.image_url = CONCAT(
    'ztech://product/',
    dm.family,
    '/',
    CASE
      WHEN LOWER(p.name) LIKE '%camera%' THEN 'lens'
      WHEN p.category_id = 1 THEN 'case'
      WHEN p.category_id = 2 THEN 'charger'
      WHEN p.category_id = 3 THEN 'audio'
      WHEN p.category_id = 4 THEN 'glass'
      WHEN p.category_id = 5 THEN 'utility'
      ELSE 'accessory'
    END
  )
  WHERE p.is_active = 1
`);

console.log(`Updated product images: ${result.affectedRows}`);
