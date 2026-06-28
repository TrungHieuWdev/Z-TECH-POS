USE pos_accessories;

ALTER TABLE categories
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE AFTER description;
