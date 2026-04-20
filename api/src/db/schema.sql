-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── USERS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  username      VARCHAR(50) UNIQUE NOT NULL,
  email         VARCHAR(120) UNIQUE NOT NULL,
  password_hash TEXT        NOT NULL,
  phone         VARCHAR(20),
  role          VARCHAR(20) NOT NULL DEFAULT 'cashier'
                CHECK (role IN ('admin','cashier')),
  is_verified   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── TABLES ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tables (
  id       UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  label    VARCHAR(10) UNIQUE NOT NULL,
  capacity SMALLINT    NOT NULL DEFAULT 4,
  status   VARCHAR(20) NOT NULL DEFAULT 'available'
           CHECK (status IN ('available','occupied','reserved'))
);

-- Seed tables T1 to T10
INSERT INTO tables (label, capacity) VALUES
  ('T1',4),('T2',4),('T3',4),('T4',4),('T5',4),
  ('T6',6),('T7',6),('T8',6),('T9',2),('T10',2)
ON CONFLICT DO NOTHING;

-- ── CATEGORIES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR(60) NOT NULL,
  icon_url   VARCHAR(10),
  sort_order SMALLINT    NOT NULL DEFAULT 0,
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed categories
INSERT INTO categories (name, icon_url, sort_order) VALUES
  ('Dosas',        '🫓', 1),
  ('Burgers',      '🍔', 2),
  ('Continental',  '🍝', 3),
  ('Fried Rice',   '🍚', 4),
  ('Noodles',      '🍜', 5),
  ('Biriyani',     '🍛', 6),
  ('Cool Drinks',  '🥤', 7),
  ('Water Bottle', '💧', 8)
ON CONFLICT DO NOTHING;

-- ── MENU ITEMS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_items (
  id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id  UUID         NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name         VARCHAR(80)  NOT NULL,
  price        NUMERIC(8,2) NOT NULL CHECK (price >= 0),
  image_url    TEXT,
  is_available BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── ORDERS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id             UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number   VARCHAR(40)   UNIQUE NOT NULL,
  user_id        UUID          NOT NULL REFERENCES users(id),
  table_id       UUID          REFERENCES tables(id),
  order_type     VARCHAR(20)   NOT NULL DEFAULT 'table'
                 CHECK (order_type IN ('table','takeaway','delivery','fast')),
  status         VARCHAR(20)   NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','preparing','completed','cancelled')),
  subtotal       NUMERIC(10,2) NOT NULL DEFAULT 0,
  cgst           NUMERIC(8,2)  NOT NULL DEFAULT 0,
  sgst           NUMERIC(8,2)  NOT NULL DEFAULT 0,
  discount_pct   NUMERIC(5,2)  NOT NULL DEFAULT 0,
  discount_fixed NUMERIC(8,2)  NOT NULL DEFAULT 0,
  delivery_fee   NUMERIC(8,2)  NOT NULL DEFAULT 0,
  grand_total    NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_printed     BOOLEAN       NOT NULL DEFAULT FALSE,
  printed_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_type       ON orders(order_type);
CREATE INDEX IF NOT EXISTS idx_orders_user       ON orders(user_id);

-- ── ORDER ITEMS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id     UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID          NOT NULL REFERENCES menu_items(id),
  quantity     SMALLINT      NOT NULL CHECK (quantity > 0),
  unit_price   NUMERIC(8,2)  NOT NULL,
  line_total   NUMERIC(10,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- ── AUTO UPDATE updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER items_updated_at
  BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();