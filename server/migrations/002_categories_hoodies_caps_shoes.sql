-- CarterTheTownWear: new categories (hoodies, caps, shoes); kids retired
-- Run ONCE on an existing database, as DB root:
--   sudo mysql < server/migrations/002_categories_hoodies_caps_shoes.sql
-- Safe to re-run. Expand-only: 'kids' stays in the enum so the previous release keeps working on this schema.
-- Brand data is NOT touched: products keep whatever brand the admin entered.

USE carterthetown;

ALTER TABLE products
  MODIFY COLUMN category ENUM('men','women','kids','hoodies','caps','shoes') NOT NULL DEFAULT 'men';

-- Kids is no longer sold. These rows still exist and still show under "All" until you delete
-- them in the admin panel. Listed here so none are forgotten:
SELECT id, name, category FROM products WHERE category = 'kids' ORDER BY id;
