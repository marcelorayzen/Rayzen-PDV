ALTER TABLE print_jobs RENAME TO print_jobs_legacy;

CREATE TABLE print_jobs (
  print_job_id TEXT PRIMARY KEY,
  source_entity TEXT,
  source_entity_id TEXT,
  setor TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('QUEUED', 'PRINTING', 'WAITING_PRINTER', 'NEEDS_ATTENTION', 'DONE')
  ),
  ticket_kind TEXT NOT NULL DEFAULT 'PRODUCAO' CHECK (
    ticket_kind IN ('PRODUCAO', 'SEGUNDA_VIA')
  ),
  dedup_key TEXT,
  printer_target_id TEXT,
  printer_target_name TEXT,
  second_copy_of_job_id TEXT REFERENCES print_jobs (print_job_id),
  payload_json TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  second_copy_count INTEGER NOT NULL DEFAULT 0 CHECK (second_copy_count >= 0),
  last_error_code TEXT,
  last_error_message TEXT,
  next_retry_at TEXT,
  last_attempt_at TEXT,
  lease_expires_at TEXT,
  printed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO print_jobs (
  print_job_id,
  source_entity,
  source_entity_id,
  setor,
  status,
  ticket_kind,
  dedup_key,
  printer_target_id,
  printer_target_name,
  second_copy_of_job_id,
  payload_json,
  attempts,
  second_copy_count,
  last_error_code,
  last_error_message,
  next_retry_at,
  last_attempt_at,
  lease_expires_at,
  printed_at,
  created_at,
  updated_at
)
SELECT
  print_job_id,
  source_entity,
  source_entity_id,
  setor,
  status,
  'PRODUCAO',
  dedup_key,
  NULL,
  NULL,
  NULL,
  payload_json,
  attempts,
  second_copy_count,
  last_error_code,
  last_error_message,
  next_retry_at,
  NULL,
  NULL,
  printed_at,
  created_at,
  updated_at
FROM print_jobs_legacy;

DROP TABLE print_jobs_legacy;

CREATE INDEX idx_print_jobs_status_retry
  ON print_jobs (status, next_retry_at, lease_expires_at, created_at);

CREATE INDEX idx_print_jobs_setor_status
  ON print_jobs (setor, status, created_at);

CREATE INDEX idx_print_jobs_second_copy
  ON print_jobs (second_copy_of_job_id, ticket_kind, created_at);

CREATE UNIQUE INDEX idx_print_jobs_dedup_key
  ON print_jobs (dedup_key)
  WHERE dedup_key IS NOT NULL;
