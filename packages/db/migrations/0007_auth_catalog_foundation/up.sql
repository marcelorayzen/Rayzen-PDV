CREATE TABLE IF NOT EXISTS operators (
  operator_id TEXT PRIMARY KEY,
  operator_code TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  pin_hash TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (
    role IN ('GERENTE', 'CAIXA', 'GARCOM')
  ),
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_operators_role_ativo
  ON operators (role, ativo, nome ASC);

CREATE TABLE IF NOT EXISTS operator_sessions (
  terminal_id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL REFERENCES operators (operator_id) ON DELETE RESTRICT,
  login_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_operator_sessions_operator
  ON operator_sessions (operator_id, login_at DESC);

CREATE TABLE IF NOT EXISTS products (
  product_id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  preco_cents INTEGER NOT NULL CHECK (preco_cents >= 0),
  categoria TEXT NOT NULL,
  setor TEXT NOT NULL,
  shortcut_hint TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_products_ativo_categoria_nome
  ON products (ativo, categoria, nome ASC);
