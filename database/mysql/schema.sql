CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(32) NOT NULL PRIMARY KEY,
  email VARCHAR(190) NOT NULL,
  full_name VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NULL,
  social_google_enabled TINYINT(1) NOT NULL DEFAULT 0,
  social_facebook_enabled TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NULL,
  UNIQUE KEY uniq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_addresses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL,
  label VARCHAR(80) NOT NULL DEFAULT 'Principal',
  phone VARCHAR(40) NULL,
  district VARCHAR(120) NULL,
  address_line1 VARCHAR(255) NOT NULL,
  address_line2 VARCHAR(255) NULL,
  reference_text VARCHAR(255) NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NULL,
  CONSTRAINT fk_user_addresses_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admins (
  id VARCHAR(32) NOT NULL PRIMARY KEY,
  email VARCHAR(190) NOT NULL,
  full_name VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(40) NOT NULL DEFAULT 'owner',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NULL,
  UNIQUE KEY uniq_admins_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  public_order_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(32) NULL,
  account_email VARCHAR(190) NULL,
  customer_name VARCHAR(190) NOT NULL,
  customer_email VARCHAR(190) NULL,
  customer_phone VARCHAR(40) NULL,
  district VARCHAR(120) NULL,
  address_line1 VARCHAR(255) NULL,
  address_line2 VARCHAR(255) NULL,
  reference_text VARCHAR(255) NULL,
  payment_method VARCHAR(60) NOT NULL,
  notes TEXT NULL,
  status_code VARCHAR(60) NOT NULL,
  status_label VARCHAR(190) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'PEN',
  minimum_order DECIMAL(10,2) NOT NULL DEFAULT 50.00,
  total DECIMAL(10,2) NOT NULL,
  created_at DATETIME NOT NULL,
  saved_at DATETIME NOT NULL,
  UNIQUE KEY uniq_orders_public_order_id (public_order_id),
  KEY idx_orders_user_id (user_id),
  KEY idx_orders_saved_at (saved_at),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  product_id VARCHAR(80) NULL,
  product_name VARCHAR(255) NOT NULL,
  image_url VARCHAR(500) NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  KEY idx_order_items_order_id (order_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  provider VARCHAR(60) NOT NULL,
  channel_reference VARCHAR(190) NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'PEN',
  status_code VARCHAR(60) NOT NULL DEFAULT 'pending_review',
  proof_url VARCHAR(500) NULL,
  created_at DATETIME NOT NULL,
  reviewed_at DATETIME NULL,
  KEY idx_payments_order_id (order_id),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor_type VARCHAR(30) NOT NULL,
  actor_id VARCHAR(32) NULL,
  action_name VARCHAR(120) NOT NULL,
  target_type VARCHAR(60) NULL,
  target_id VARCHAR(64) NULL,
  payload_json JSON NULL,
  created_at DATETIME NOT NULL,
  KEY idx_audit_actor (actor_type, actor_id),
  KEY idx_audit_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
