DROP INDEX IF EXISTS idx_fiscal_queue_dedup_key;
DROP INDEX IF EXISTS idx_fiscal_queue_provider_status;
DROP INDEX IF EXISTS idx_fiscal_queue_status_retry;
DROP TABLE IF EXISTS fiscal_queue;

DROP INDEX IF EXISTS idx_print_jobs_dedup_key;
DROP INDEX IF EXISTS idx_print_jobs_setor_status;
DROP INDEX IF EXISTS idx_print_jobs_status_retry;
DROP TABLE IF EXISTS print_jobs;

DROP INDEX IF EXISTS idx_audit_events_action;
DROP INDEX IF EXISTS idx_audit_events_entity_ref;
DROP TABLE IF EXISTS audit_events;
