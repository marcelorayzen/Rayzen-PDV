CREATE TABLE IF NOT EXISTS cash_sessions (
  cash_session_id TEXT PRIMARY KEY,
  terminal_id TEXT NOT NULL,
  opened_by_user_id TEXT NOT NULL,
  opened_by_terminal_id TEXT NOT NULL,
  opened_by_role TEXT,
  opened_at TEXT NOT NULL,
  opening_fund_amount_cents INTEGER NOT NULL CHECK (opening_fund_amount_cents >= 0),
  opening_reason TEXT,
  status TEXT NOT NULL CHECK (
    status IN ('ABERTO', 'FECHAMENTO', 'FECHADO')
  ),
  closing_started_at TEXT,
  closed_at TEXT,
  closed_by_user_id TEXT,
  closed_by_terminal_id TEXT,
  closed_by_role TEXT,
  closure_note TEXT,
  divergence_reason TEXT,
  closure_summary_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_terminal_status
  ON cash_sessions (terminal_id, status, opened_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_status
  ON cash_sessions (status, opened_at DESC);

CREATE TABLE IF NOT EXISTS cash_movements (
  cash_movement_id TEXT PRIMARY KEY,
  cash_session_id TEXT NOT NULL REFERENCES cash_sessions (cash_session_id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (
    movement_type IN ('RECEBIMENTO', 'SANGRIA', 'SUPRIMENTO')
  ),
  payment_method TEXT NOT NULL CHECK (
    payment_method IN ('DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'PIX', 'OUTRO')
  ),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  reason TEXT,
  source_entity TEXT,
  source_entity_id TEXT,
  occurred_at TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  actor_terminal_id TEXT NOT NULL,
  actor_role TEXT,
  created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_cash_movements_session_occurred
  ON cash_movements (cash_session_id, occurred_at ASC, cash_movement_id ASC);

CREATE INDEX IF NOT EXISTS idx_cash_movements_type_method
  ON cash_movements (movement_type, payment_method, occurred_at ASC);
