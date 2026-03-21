CREATE TABLE IF NOT EXISTS comandas (
  comanda_id TEXT PRIMARY KEY,
  numero TEXT NOT NULL,
  mesa_id TEXT,
  atendimento_ref TEXT,
  status TEXT NOT NULL CHECK (
    status IN ('ABERTA', 'EM_PRODUCAO', 'EM_PAGAMENTO', 'ENCERRADA', 'CANCELADA')
  ),
  current_owner_user_id TEXT,
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  cancelled_at TEXT,
  cancellation_reason TEXT,
  subtotal_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_amount_cents >= 0),
  paid_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (paid_amount_cents >= 0),
  change_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (change_amount_cents >= 0),
  production_batches_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_comandas_status_opened
  ON comandas (status, opened_at);

CREATE INDEX IF NOT EXISTS idx_comandas_numero
  ON comandas (numero, opened_at);

CREATE INDEX IF NOT EXISTS idx_comandas_mesa_status
  ON comandas (mesa_id, status);

CREATE TABLE IF NOT EXISTS comanda_items (
  item_id TEXT PRIMARY KEY,
  comanda_id TEXT NOT NULL REFERENCES comandas(comanda_id) ON DELETE CASCADE,
  produto_id TEXT NOT NULL,
  product_label TEXT NOT NULL,
  setor TEXT NOT NULL,
  quantity REAL NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  status TEXT NOT NULL CHECK (
    status IN ('LANCADO', 'ENVIADO', 'CANCELADO')
  ),
  note TEXT,
  production_batch_id TEXT,
  created_at TEXT NOT NULL,
  sent_at TEXT,
  cancelled_at TEXT,
  cancellation_reason TEXT,
  updated_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_comanda_items_comanda_status
  ON comanda_items (comanda_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_comanda_items_batch
  ON comanda_items (production_batch_id, setor);

CREATE TABLE IF NOT EXISTS comanda_payments (
  payment_id TEXT PRIMARY KEY,
  comanda_id TEXT NOT NULL REFERENCES comandas(comanda_id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  status TEXT NOT NULL CHECK (
    status IN ('CONFIRMADO')
  ),
  confirmed_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_comanda_payments_comanda
  ON comanda_payments (comanda_id, confirmed_at);

CREATE TABLE IF NOT EXISTS comanda_precontas (
  pre_conta_id TEXT PRIMARY KEY,
  comanda_id TEXT NOT NULL REFERENCES comandas(comanda_id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  total_amount_cents INTEGER NOT NULL CHECK (total_amount_cents >= 0),
  snapshot_json TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (comanda_id, version)
);

CREATE INDEX IF NOT EXISTS idx_comanda_precontas_comanda
  ON comanda_precontas (comanda_id, version);
