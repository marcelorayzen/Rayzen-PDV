DROP INDEX IF EXISTS idx_fiscal_queue_dedup_key;
DROP INDEX IF EXISTS idx_fiscal_queue_provider_status;
DROP INDEX IF EXISTS idx_fiscal_queue_status_retry;

ALTER TABLE fiscal_queue RENAME TO fiscal_queue_legacy;

CREATE TABLE IF NOT EXISTS fiscal_emitters (
  emitter_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider = 'NS_TECNOLOGIA'),
  environment TEXT NOT NULL CHECK (environment IN ('HOMOLOGACAO', 'PRODUCAO')),
  state_code TEXT NOT NULL CHECK (state_code = 'SP'),
  document_model TEXT NOT NULL CHECK (document_model = '65'),
  certificate_kind TEXT NOT NULL CHECK (certificate_kind = 'E_CNPJ_A1'),
  legal_name TEXT NOT NULL,
  trade_name TEXT,
  cnpj TEXT NOT NULL,
  state_registration TEXT NOT NULL,
  csc_id TEXT NOT NULL,
  certificate_subject TEXT,
  certificate_valid_from TEXT,
  certificate_valid_until TEXT,
  status TEXT NOT NULL CHECK (
    status IN ('PENDENTE_CONFIGURACAO', 'CONFIGURADO', 'HABILITADO', 'BLOQUEADO')
  ),
  settings_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_fiscal_emitters_cnpj
  ON fiscal_emitters (cnpj);

CREATE INDEX IF NOT EXISTS idx_fiscal_emitters_provider_status
  ON fiscal_emitters (provider, environment, status);

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_fiscal_documents_access_key
  ON fiscal_documents (access_key)
  WHERE access_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fiscal_documents_status
  ON fiscal_documents (status, created_at);

CREATE INDEX IF NOT EXISTS idx_fiscal_documents_emitter
  ON fiscal_documents (emitter_id, status, created_at);

CREATE TABLE IF NOT EXISTS fiscal_document_events (
  fiscal_event_id TEXT PRIMARY KEY,
  fiscal_doc_id TEXT NOT NULL,
  emitter_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('DRAFT', 'SIGNED', 'SENT', 'AUTHORIZED', 'CONTINGENCY', 'REJECTED')
  ),
  provider TEXT NOT NULL CHECK (provider = 'NS_TECNOLOGIA'),
  provider_reference_id TEXT,
  occurred_at TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (fiscal_doc_id) REFERENCES fiscal_documents (fiscal_doc_id),
  FOREIGN KEY (emitter_id) REFERENCES fiscal_emitters (emitter_id)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_document_events_doc
  ON fiscal_document_events (fiscal_doc_id, occurred_at, fiscal_event_id);

CREATE INDEX IF NOT EXISTS idx_fiscal_document_events_status
  ON fiscal_document_events (status, occurred_at);

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
FROM fiscal_queue_legacy;

INSERT INTO fiscal_emitters (
  emitter_id,
  provider,
  environment,
  state_code,
  document_model,
  certificate_kind,
  legal_name,
  cnpj,
  state_registration,
  csc_id,
  status,
  settings_json
)
SELECT
  'legacy-sp',
  'NS_TECNOLOGIA',
  'HOMOLOGACAO',
  'SP',
  '65',
  'E_CNPJ_A1',
  'Emitente legado migrado',
  '00000000000000',
  'ISENTO',
  'LEGACY',
  'PENDENTE_CONFIGURACAO',
  '{}'
WHERE EXISTS (
  SELECT 1
  FROM fiscal_queue_legacy
  WHERE provider = 'NS_TECNOLOGIA'
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
  status,
  contingency_required,
  payload_json,
  response_json,
  last_error_code,
  last_error_message,
  issued_at,
  created_at,
  updated_at
)
SELECT
  fiscal_doc_id,
  'legacy-sp',
  'legacy-terminal',
  'LEGACY',
  fiscal_doc_id,
  provider,
  'HOMOLOGACAO',
  'SP',
  '65',
  '0',
  0,
  status,
  contingency_required,
  payload_json,
  context_json,
  last_error_code,
  last_error_message,
  issued_at,
  created_at,
  updated_at
FROM fiscal_queue_legacy
WHERE provider = 'NS_TECNOLOGIA';

INSERT INTO fiscal_document_events (
  fiscal_event_id,
  fiscal_doc_id,
  emitter_id,
  event_type,
  status,
  provider,
  occurred_at,
  payload_json,
  created_at
)
SELECT
  'evt_legacy_' || fiscal_queue_id,
  fiscal_doc_id,
  'legacy-sp',
  'LEGACY_IMPORT',
  status,
  provider,
  created_at,
  context_json,
  created_at
FROM fiscal_queue_legacy
WHERE provider = 'NS_TECNOLOGIA';

DROP TABLE fiscal_queue_legacy;

CREATE INDEX IF NOT EXISTS idx_fiscal_queue_status_retry
  ON fiscal_queue (status, next_retry_at, lease_expires_at, created_at);

CREATE INDEX IF NOT EXISTS idx_fiscal_queue_provider_status
  ON fiscal_queue (provider, environment, status, created_at);

CREATE INDEX IF NOT EXISTS idx_fiscal_queue_emitter_status
  ON fiscal_queue (emitter_id, status, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fiscal_queue_dedup_key
  ON fiscal_queue (dedup_key)
  WHERE dedup_key IS NOT NULL;
