-- CarterTheTownWear — Database Setup
-- Schema only. Safe for production: no sample data, no default accounts.
-- Run once as DB root:  sudo mysql < setup.sql
-- Local development sample data lives in seed.dev.sql (never run that in production).

CREATE DATABASE IF NOT EXISTS carterthetown;
USE carterthetown;

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(255)                        NOT NULL,
  brand       VARCHAR(255)                        NOT NULL,
  category    ENUM('men','women','kids','hoodies','caps','shoes') NOT NULL DEFAULT 'men',  -- 'kids' retired, kept for rollback safety
  price       DECIMAL(10,2)                       NULL,      -- legacy: mirrors price_mwk, drop in a later release
  price_mwk   DECIMAL(10,2)                       NULL,      -- Malawian Kwacha
  price_zar   DECIMAL(10,2)                       NULL,      -- South African Rand
  description TEXT,
  image_url   VARCHAR(500),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table (admin + future customer accounts)
-- Photos: up to 4 per product, position 0 is the main photo (products.image_url mirrors it)
CREATE TABLE IF NOT EXISTS product_images (
  id          INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  product_id  INT           NOT NULL,
  url         VARCHAR(500)  NOT NULL,
  position    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_product_position (product_id, position),
  CONSTRAINT fk_product_images_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(255)                       NOT NULL,
  email         VARCHAR(255)                       NOT NULL UNIQUE,
  password_hash VARCHAR(255)                       NOT NULL,
  role          ENUM('admin','customer')           NOT NULL DEFAULT 'customer',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SELECT 'CarterTheTownWear schema ready.' AS status;
