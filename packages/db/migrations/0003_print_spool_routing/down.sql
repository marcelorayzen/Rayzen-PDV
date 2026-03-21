ALTER TABLE print_jobs RENAME TO print_jobs_routing;

CREATE TABLE print_jobs (
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

INSERT INTO print_jobs (
  print_job_id,
  source_entity,
  source_entity_id,
  setor,
  status,
  dedup_key,
  payload_json,
  attempts,
  second_copy_count,
  last_error_code,
  last_error_message,
  next_retry_at,
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
  dedup_key,
  payload_json,
  attempts,
  second_copy_count,
  last_error_code,
  last_error_message,
  next_retry_at,
  printed_at,
  created_at,
  updated_at
FROM print_jobs_routing;

DROP TABLE print_jobs_routing;

CREATE INDEX idx_print_jobs_status_retry
  ON print_jobs (status, next_retry_at, created_at);

CREATE INDEX idx_print_jobs_setor_status
  ON print_jobs (setor, status, created_at);

CREATE UNIQUE INDEX idx_print_jobs_dedup_key
  ON print_jobs (dedup_key)
  WHERE dedup_key IS NOT NULL;
