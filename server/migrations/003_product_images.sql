-- CarterTheTownWear: several photos per product (up to 4, the first is the main photo)
-- Run ONCE on an existing database, as DB root, BEFORE deploying the matching release:
--   sudo mysql < server/migrations/003_product_images.sql
-- Safe to re-run. Expand-only: products.image_url stays and always mirrors the first photo,
-- so the previous release keeps working on this schema.

USE carterthetown;

CREATE TABLE IF NOT EXISTS product_images (
  id          INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  product_id  INT           NOT NULL,
  url         VARCHAR(500)  NOT NULL,
  position    TINYINT UNSIGNED NOT NULL DEFAULT 0,   -- 0 = main photo
  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_product_position (product_id, position),
  CONSTRAINT fk_product_images_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Existing single photos become position 0
INSERT INTO product_images (product_id, url, position)
SELECT p.id, p.image_url, 0
FROM products p
WHERE p.image_url IS NOT NULL AND p.image_url <> ''
  AND NOT EXISTS (SELECT 1 FROM product_images i WHERE i.product_id = p.id);

SELECT COUNT(*) AS products_with_photos FROM product_images;
