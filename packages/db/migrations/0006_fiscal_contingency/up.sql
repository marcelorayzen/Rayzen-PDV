ALTER TABLE fiscal_documents ADD COLUMN emission_mode TEXT NOT NULL DEFAULT 'NORMAL' CHECK (
  emission_mode IN ('NORMAL', 'CONTINGENCY_OFFLINE')
);
ALTER TABLE fiscal_documents ADD COLUMN contingency_started_at TEXT;
ALTER TABLE fiscal_documents ADD COLUMN contingency_printed_at TEXT;
ALTER TABLE fiscal_documents ADD COLUMN contingency_danfe_path TEXT;
ALTER TABLE fiscal_documents ADD COLUMN last_status_checked_at TEXT;

ALTER TABLE fiscal_queue ADD COLUMN emission_mode TEXT NOT NULL DEFAULT 'NORMAL' CHECK (
  emission_mode IN ('NORMAL', 'CONTINGENCY_OFFLINE')
);
ALTER TABLE fiscal_queue ADD COLUMN contingency_started_at TEXT;
ALTER TABLE fiscal_queue ADD COLUMN last_status_checked_at TEXT;

CREATE INDEX IF NOT EXISTS idx_fiscal_documents_emission_mode
  ON fiscal_documents (emission_mode, status, updated_at);

CREATE INDEX IF NOT EXISTS idx_fiscal_queue_emission_mode
  ON fiscal_queue (emission_mode, status, next_retry_at, updated_at);
