-- =====================================================================
-- Store Support Agent: database schema (PostgreSQL on Neon)
-- Run on an empty database to rebuild all 12 tables.
-- =====================================================================

-- Vector search for the knowledge base (needed before knowledge_base)
CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------
-- Store catalog
-- ---------------------------------------------------------------------

CREATE TABLE categories (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE suppliers (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  phone      TEXT,
  email      TEXT,
  address    TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sku            TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  description    TEXT,
  image_url      TEXT,
  category_id    BIGINT NOT NULL REFERENCES categories(id),
  supplier_id    BIGINT REFERENCES suppliers(id),
  cost           NUMERIC(10,2) NOT NULL CHECK (cost >= 0),
  price          NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  reorder_level  INTEGER NOT NULL DEFAULT 5 CHECK (reorder_level >= 0),
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Orders (guest checkout: customer details are stored on the order)
-- ---------------------------------------------------------------------

CREATE TABLE orders (
  id                      BIGINT GENERATED ALWAYS AS IDENTITY (START WITH 1001) PRIMARY KEY,
  customer_name           TEXT NOT NULL,
  customer_email          TEXT NOT NULL CHECK (customer_email = lower(customer_email)),
  customer_phone          TEXT NOT NULL,
  shipping_address        TEXT NOT NULL,
  city                    TEXT NOT NULL,
  notes                   TEXT,
  status                  TEXT NOT NULL DEFAULT 'processing'
                          CHECK (status IN ('processing','shipped','out_for_delivery','delivered','cancelled')),
  payment_method          TEXT NOT NULL DEFAULT 'cash_on_delivery'
                          CHECK (payment_method IN ('cash_on_delivery','bank_transfer','other')),
  payment_status          TEXT NOT NULL DEFAULT 'unpaid'
                          CHECK (payment_status IN ('unpaid','paid','refunded')),
  subtotal                NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
  shipping_fee            NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (shipping_fee >= 0),
  total                   NUMERIC(10,2) NOT NULL,
  tracking_number         TEXT UNIQUE,
  estimated_delivery_date DATE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT orders_total_matches CHECK (total = subtotal + shipping_fee)
);

-- unit_price is the price at the time of purchase
CREATE TABLE order_items (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id   BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id),
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  UNIQUE (order_id, product_id)
);

-- Order history and tracking timeline
CREATE TABLE order_events (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id   BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status     TEXT NOT NULL
             CHECK (status IN ('processing','shipped','out_for_delivery','delivered','cancelled')),
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE return_requests (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id      BIGINT NOT NULL REFERENCES orders(id),
  reason        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'requested'
                CHECK (status IN ('requested','approved','rejected','refunded')),
  refund_amount NUMERIC(10,2) CHECK (refund_amount >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at   TIMESTAMPTZ
);

-- ---------------------------------------------------------------------
-- AI agent
-- ---------------------------------------------------------------------

-- Store policies and FAQs, searched by meaning (RAG).
-- embedding: 768 numbers calculated by the embedding model.
CREATE TABLE knowledge_base (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  topic      TEXT NOT NULL,
  embedding  vector(768),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- verified_order_id is set only after the customer proves ownership
-- (order number + email). The agent may only act on that order.
CREATE TABLE conversations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email    TEXT CHECK (customer_email IS NULL OR customer_email = lower(customer_email)),
  verified_order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user','assistant','tool')),
  content         TEXT NOT NULL,
  tool_call       JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Human handoff: when the agent cannot help, the owner gets a ticket
CREATE TABLE support_tickets (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  order_id        BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  customer_name   TEXT NOT NULL,
  customer_email  TEXT NOT NULL CHECK (customer_email = lower(customer_email)),
  message         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','in_progress','resolved')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ
);

-- ---------------------------------------------------------------------
-- Owner admin login (store only the password hash, never the password)
-- ---------------------------------------------------------------------

CREATE TABLE admin_users (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Automatic updated_at
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_set_updated_at BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER knowledge_base_set_updated_at BEFORE UPDATE ON knowledge_base
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- Indexes (PostgreSQL does not index foreign keys automatically)
-- ---------------------------------------------------------------------

CREATE INDEX products_category_id_idx ON products(category_id);
CREATE INDEX products_supplier_id_idx ON products(supplier_id);
CREATE INDEX orders_customer_email_idx ON orders(customer_email);
CREATE INDEX orders_status_idx ON orders(status);
CREATE INDEX order_items_product_id_idx ON order_items(product_id);
CREATE INDEX order_events_order_id_idx ON order_events(order_id, created_at);
CREATE INDEX return_requests_order_id_idx ON return_requests(order_id);
CREATE INDEX messages_conversation_id_idx ON messages(conversation_id, created_at);
CREATE INDEX support_tickets_status_idx ON support_tickets(status);