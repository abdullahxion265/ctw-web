-- CarterTheTownWear: Android app (APK) releases that admins upload and customers download
-- Run ONCE on an existing database, as DB root, BEFORE deploying the matching release:
--   sudo mysql < server/migrations/004_app_releases.sql
-- Safe to re-run. Only adds a table.

USE carterthetown;

CREATE TABLE IF NOT EXISTS app_releases (
  id            INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  version_name  VARCHAR(40)   NOT NULL,
  notes         VARCHAR(1000) NULL,
  file_name     VARCHAR(255)  NOT NULL,            -- stored name inside server/apk
  original_name VARCHAR(255)  NOT NULL,
  size_bytes    BIGINT UNSIGNED NOT NULL,
  sha256        CHAR(64)      NOT NULL,
  is_current    TINYINT(1)    NOT NULL DEFAULT 0,  -- the one customers download
  downloads     INT UNSIGNED  NOT NULL DEFAULT 0,
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_app_release_sha (sha256)
) ENGINE=InnoDB;

SELECT COUNT(*) AS releases FROM app_releases;
