ALTER TABLE suppliers
  ADD COLUMN supplier_group VARCHAR(100) NULL AFTER supplier_name,
  ADD COLUMN contact_name VARCHAR(100) NULL AFTER supplier_group;
