DROP INDEX IF EXISTS idx_fiscal_queue_emission_mode;
DROP INDEX IF EXISTS idx_fiscal_documents_emission_mode;

ALTER TABLE fiscal_queue RENAME TO fiscal_queue_v6;

CREATE TABLE IF NOT EXISTS fiscal_queue (
  fiscal_queue_id TEXT PRIMARY KEY,
  fiscal_doc_id TEXT NOT NULL,
  emitter_id TEXT,
  terminal_id TEXT,
  provider TEXT NOT NULL CHECK (provider = 'NS_TECNOLOGIA'),
  environment TEXT NOT NULL DEFAULT 'HOMOLOGACAO' CHECK (environment IN ('HOMOLOGACAO', 'PRODUCAO')),
  state_code TEXT NOT NULL DEFAULT 'SP' CHECK (state_code = 'SP'),
  document_model TEXT NOT NULL DEFAULT '65' CHECK (document_model = '65'),
  document_type TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  serie TEXT,
  numero INTEGER,
  access_key TEXT,
  status TEXT NOT NULL CHECK (
    status IN ('DRAFT', 'SIGNED', 'SENT', 'AUTHORIZED', 'CONTINGENCY', 'REJECTED')
  ),
  dedup_key TEXT,
  payload_json TEXT NOT NULL,
  context_json TEXT NOT NULL DEFAULT '{}',
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  contingency_required INTEGER NOT NULL DEFAULT 0 CHECK (contingency_required IN (0, 1)),
  provider_reference_id TEXT,
  lease_expires_at TEXT,
  last_error_code TEXT,
  last_error_message TEXT,
  next_retry_at TEXT,
  issued_at TEXT,
  authorized_at TEXT,
  created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (fiscal_doc_id)
);

INSERT INTO fiscal_queue (
  fiscal_queue_id,
  fiscal_doc_id,
  emitter_id,
  terminal_id,
  provider,
  environment,
  state_code,
  document_model,
  document_type,
  reference_type,
  reference_id,
  serie,
  numero,
  access_key,
  status,
  dedup_key,
  payload_json,
  context_json,
  attempts,
  contingency_required,
  provider_reference_id,
  lease_expires_at,
  last_error_code,
  last_error_message,
  next_retry_at,
  issued_at,
  authorized_at,
  created_at,
  updated_at
)
SELECT
  fiscal_queue_id,
  fiscal_doc_id,
  emitter_id,
  terminal_id,
  provider,
  environment,
  state_code,
  document_model,
  document_type,
  reference_type,
  reference_id,
  serie,
  numero,
  access_key,
  status,
  dedup_key,
  payload_json,
  context_json,
  attempts,
  contingency_required,
  provider_reference_id,
  lease_expires_at,
  last_error_code,
  last_error_message,
  next_retry_at,
  issued_at,
  authorized_at,
  created_at,
  updated_at
FROM fiscal_queue_v6;

DROP TABLE fiscal_queue_v6;

ALTER TABLE fiscal_documents RENAME TO fiscal_documents_v6;

CREATE TABLE IF NOT EXISTS fiscal_documents (
  fiscal_doc_id TEXT PRIMARY KEY,
  emitter_id TEXT NOT NULL,
  terminal_id TEXT NOT NULL,
  reference_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider = 'NS_TECNOLOGIA'),
  environment TEXT NOT NULL CHECK (environment IN ('HOMOLOGACAO', 'PRODUCAO')),
  state_code TEXT NOT NULL CHECK (state_code = 'SP'),
  document_model TEXT NOT NULL CHECK (document_model = '65'),
  serie TEXT NOT NULL,
  numero INTEGER NOT NULL CHECK (numero >= 0),
  access_key TEXT,
  ns_reference_id TEXT,
  status TEXT NOT NULL CHECK (
    status IN ('DRAFT', 'SIGNED', 'SENT', 'AUTHORIZED', 'CONTINGENCY', 'REJECTED')
  ),
  contingency_required INTEGER NOT NULL DEFAULT 0 CHECK (contingency_required IN (0, 1)),
  contingency_justification TEXT,
  payload_json TEXT NOT NULL,
  response_json TEXT NOT NULL DEFAULT '{}',
  xml_storage_path TEXT,
  last_error_code TEXT,
  last_error_message TEXT,
  issued_at TEXT,
  authorized_at TEXT,
  created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (emitter_id) REFERENCES fiscal_emitters (emitter_id),
  UNIQUE (emitter_id, serie, numero)
);

INSERT INTO fiscal_documents (
  fiscal_doc_id,
  emitter_id,
  terminal_id,
  reference_type,
  reference_id,
  provider,
  environment,
  state_code,
  document_model,
  serie,
  numero,
  access_key,
  ns_reference_id,
  status,
  contingency_required,
  contingency_justification,
  payload_json,
  response_json,
  xml_storage_path,
  last_error_code,
  last_error_message,
  issued_at,
  authorized_at,
  created_at,
  updated_at
)
SELECT
  fiscal_doc_id,
  emitter_id,
  terminal_id,
  reference_type,
  reference_id,
  provider,
  environment,
  state_code,
  document_model,
  serie,
  numero,
  access_key,
  ns_reference_id,
  status,
  contingency_required,
  contingency_justification,
  payload_json,
  response_json,
  xml_storage_path,
  last_error_code,
  last_error_message,
  issued_at,
  authorized_at,
  created_at,
  updated_at
FROM fiscal_documents_v6;

DROP TABLE fiscal_documents_v6;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fiscal_documents_access_key
  ON fiscal_documents (access_key)
  WHERE access_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fiscal_documents_status
  ON fiscal_documents (status, created_at);

CREATE INDEX IF NOT EXISTS idx_fiscal_documents_emitter
  ON fiscal_documents (emitter_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_fiscal_queue_status_retry
  ON fiscal_queue (status, next_retry_at, lease_expires_at, created_at);

CREATE INDEX IF NOT EXISTS idx_fiscal_queue_provider_status
  ON fiscal_queue (provider, environment, status, created_at);

CREATE INDEX IF NOT EXISTS idx_fiscal_queue_emitter_status
  ON fiscal_queue (emitter_id, status, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fiscal_queue_dedup_key
  ON fiscal_queue (dedup_key)
  WHERE dedup_key IS NOT NULL;
