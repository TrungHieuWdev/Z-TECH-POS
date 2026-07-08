ALTER TABLE suppliers
  MODIFY COLUMN status ENUM('active','paused','inactive') NOT NULL DEFAULT 'active';
