CREATE TABLE IF NOT EXISTS audit_events (
  event_id TEXT PRIMARY KEY,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_user_id TEXT,
  actor_terminal_id TEXT,
  actor_role TEXT,
  occurred_at TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_events_entity_ref
  ON audit_events (entity, entity_id, occurred_at);

CREATE INDEX IF NOT EXISTS idx_audit_events_action
  ON audit_events (action, occurred_at);

CREATE TABLE IF NOT EXISTS print_jobs (
  print_job_id TEXT PRIMARY KEY,
  source_entity TEXT,
  source_entity_id TEXT,
  setor TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('QUEUED', 'PRINTING', 'WAITING_PRINTER', 'NEEDS_ATTENTION', 'DONE')
  ),
  dedup_key TEXT,
  payload_json TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  second_copy_count INTEGER NOT NULL DEFAULT 0 CHECK (second_copy_count >= 0),
  last_error_code TEXT,
  last_error_message TEXT,
  next_retry_at TEXT,
  printed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_print_jobs_status_retry
  ON print_jobs (status, next_retry_at, created_at);

CREATE INDEX IF NOT EXISTS idx_print_jobs_setor_status
  ON print_jobs (setor, status, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_print_jobs_dedup_key
  ON print_jobs (dedup_key)
  WHERE dedup_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS fiscal_queue (
  fiscal_queue_id TEXT PRIMARY KEY,
  fiscal_doc_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  document_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('DRAFT', 'SIGNED', 'SENT', 'AUTHORIZED', 'CONTINGENCY', 'REJECTED')
  ),
  dedup_key TEXT,
  payload_json TEXT NOT NULL,
  context_json TEXT NOT NULL DEFAULT '{}',
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  contingency_required INTEGER NOT NULL DEFAULT 0 CHECK (contingency_required IN (0, 1)),
  last_error_code TEXT,
  last_error_message TEXT,
  next_retry_at TEXT,
  issued_at TEXT,
  created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (fiscal_doc_id)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_queue_status_retry
  ON fiscal_queue (status, next_retry_at, created_at);

CREATE INDEX IF NOT EXISTS idx_fiscal_queue_provider_status
  ON fiscal_queue (provider, status, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fiscal_queue_dedup_key
  ON fiscal_queue (dedup_key)
  WHERE dedup_key IS NOT NULL;
