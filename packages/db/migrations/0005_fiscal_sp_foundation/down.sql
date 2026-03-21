DROP INDEX IF EXISTS idx_fiscal_queue_dedup_key;
DROP INDEX IF EXISTS idx_fiscal_queue_emitter_status;
DROP INDEX IF EXISTS idx_fiscal_queue_provider_status;
DROP INDEX IF EXISTS idx_fiscal_queue_status_retry;

ALTER TABLE fiscal_queue RENAME TO fiscal_queue_v5;

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

INSERT INTO fiscal_queue (
  fiscal_queue_id,
  fiscal_doc_id,
  provider,
  document_type,
  status,
  dedup_key,
  payload_json,
  context_json,
  attempts,
  contingency_required,
  last_error_code,
  last_error_message,
  next_retry_at,
  issued_at,
  created_at,
  updated_at
)
SELECT
  fiscal_queue_id,
  fiscal_doc_id,
  provider,
  document_type,
  status,
  dedup_key,
  payload_json,
  context_json,
  attempts,
  contingency_required,
  last_error_code,
  last_error_message,
  next_retry_at,
  issued_at,
  created_at,
  updated_at
FROM fiscal_queue_v5;

DROP TABLE fiscal_queue_v5;
DROP INDEX IF EXISTS idx_fiscal_documents_access_key;
DROP INDEX IF EXISTS idx_fiscal_documents_status;
DROP INDEX IF EXISTS idx_fiscal_documents_emitter;
DROP INDEX IF EXISTS idx_fiscal_document_events_doc;
DROP INDEX IF EXISTS idx_fiscal_document_events_status;
DROP INDEX IF EXISTS idx_fiscal_emitters_cnpj;
DROP INDEX IF EXISTS idx_fiscal_emitters_provider_status;
DROP TABLE IF EXISTS fiscal_document_events;
DROP TABLE IF EXISTS fiscal_documents;
DROP TABLE IF EXISTS fiscal_emitters;

CREATE INDEX IF NOT EXISTS idx_fiscal_queue_status_retry
  ON fiscal_queue (status, next_retry_at, created_at);

CREATE INDEX IF NOT EXISTS idx_fiscal_queue_provider_status
  ON fiscal_queue (provider, status, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fiscal_queue_dedup_key
  ON fiscal_queue (dedup_key)
  WHERE dedup_key IS NOT NULL;
