-- LOCAL DEVELOPMENT ONLY. Never run this on a production database.
-- Creates a known admin login and sample products so the UI has something to show.
--   Local admin:  admin@carterthetown.com  /  password
-- Run after setup.sql:  mysql -u root < seed.dev.sql

USE carterthetown;

INSERT INTO users (name, email, password_hash, role) VALUES
(
  'Local Dev Admin',
  'admin@carterthetown.com',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'admin'
)
ON DUPLICATE KEY UPDATE id=id;

INSERT INTO products (name, brand, category, price, price_mwk, price_zar, description, image_url) VALUES
('Classic Slim Tee',   'CTW', 'men',     47500,  47500,  500,  'A timeless slim-fit tee crafted from premium cotton.',  NULL),
('Heritage Chino',     'CTW', 'men',     114000, 114000, 1200, 'Tailored chinos with a refined silhouette.',            NULL),
('Wrapped Midi Dress', 'Northline', 'women',   133000, 133000, 1400, 'An elegant wrapped midi silhouette in soft crepe.',     NULL),
('Tailored Blazer',    'Northline', 'women',   209000, 209000, 2200, 'Sharp structured blazer with gold-tone hardware.',      NULL),
('Heavyweight Hoodie', 'CTW', 'hoodies', 123500, 123500, 1300, 'Brushed fleece hoodie with a relaxed fit.',             NULL),
('Zip Hoodie',         'CTW', 'hoodies', 133000, 133000, 1400, 'Full-zip hoodie in soft cotton blend.',                NULL),
('Structured Cap',     'Urban Lab', 'caps',    38000,  38000,  400,  'Six-panel cap with an adjustable strap.',              NULL),
('Everyday Sneaker',   'Urban Lab', 'shoes',   237500, 237500, 2500, 'Clean low-top sneaker for daily wear.',                NULL);
