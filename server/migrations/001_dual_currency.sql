-- CarterTheTownWear: dual-currency pricing (ZAR + MWK)
-- Run ONCE on an existing database, as DB root:  sudo mysql < server/migrations/001_dual_currency.sql
-- Safe to re-run (MariaDB). Existing prices are treated as Kwacha, which is what the site showed.
--
-- Expand step only: the legacy `price` column is kept (now nullable) and still written by the
-- API as a mirror of price_mwk, so the previous release keeps working if you need to roll back.
-- Drop `price` in a later release once the new version is proven.

USE carterthetown;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS price_mwk DECIMAL(10,2) NULL AFTER price,
  ADD COLUMN IF NOT EXISTS price_zar DECIMAL(10,2) NULL AFTER price_mwk,
  MODIFY COLUMN price DECIMAL(10,2) NULL;

UPDATE products SET price_mwk = price WHERE price_mwk IS NULL;

-- Products created before this migration have no Rand price. They show "Price on request"
-- in Rand until you set one, e.g.:  UPDATE products SET price_zar = 250.00 WHERE id = 7;
SELECT id, name, price_mwk, price_zar FROM products ORDER BY id;
