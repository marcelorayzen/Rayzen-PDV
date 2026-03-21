import type { DatabaseSync } from "node:sqlite";

import { parseJson, serializeJson } from "../json.js";
import type {
  ClaimFiscalQueueInput,
  FiscalQueueAttemptInput,
  FiscalQueueInput,
  FiscalQueueRecord,
  FiscalQueueStatus
} from "../types.js";

interface FiscalQueueRow {
  fiscalQueueId: string;
  fiscalDocId: string;
  emitterId: string | null;
  terminalId: string | null;
  provider: FiscalQueueRecord["provider"];
  environment: FiscalQueueRecord["environment"];
  stateCode: FiscalQueueRecord["stateCode"];
  documentModel: FiscalQueueRecord["documentModel"];
  documentType: string;
  referenceType: string | null;
  referenceId: string | null;
  serie: string | null;
  numero: number | null;
  accessKey: string | null;
  status: FiscalQueueStatus;
  emissionMode: FiscalQueueRecord["emissionMode"];
  dedupKey: string | null;
  payloadJson: string;
  contextJson: string;
  attempts: number;
  contingencyRequired: number;
  contingencyStartedAt: string | null;
  providerReferenceId: string | null;
  leaseExpiresAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  nextRetryAt: string | null;
  issuedAt: string | null;
  authorizedAt: string | null;
  lastStatusCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export class FiscalQueueRepository {
  readonly #db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.#db = db;
  }

  enqueue(entry: FiscalQueueInput): FiscalQueueRecord {
    this.#db
      .prepare(
        `
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
            emission_mode,
            dedup_key,
            payload_json,
            context_json,
            contingency_required,
            contingency_started_at,
            provider_reference_id,
            lease_expires_at,
            next_retry_at,
            issued_at,
            authorized_at,
            last_status_checked_at
          )
          VALUES (
            :fiscalQueueId,
            :fiscalDocId,
            :emitterId,
            :terminalId,
            :provider,
            :environment,
            :stateCode,
            :documentModel,
            :documentType,
            :referenceType,
            :referenceId,
            :serie,
            :numero,
            :accessKey,
            :status,
            :emissionMode,
            :dedupKey,
            :payloadJson,
            :contextJson,
            :contingencyRequired,
            :contingencyStartedAt,
            :providerReferenceId,
            :leaseExpiresAt,
            :nextRetryAt,
            :issuedAt,
            :authorizedAt,
            :lastStatusCheckedAt
          )
          ON CONFLICT(fiscal_queue_id) DO UPDATE SET
            fiscal_doc_id = excluded.fiscal_doc_id,
            emitter_id = excluded.emitter_id,
            terminal_id = excluded.terminal_id,
            provider = excluded.provider,
            environment = excluded.environment,
            state_code = excluded.state_code,
            document_model = excluded.document_model,
            document_type = excluded.document_type,
            reference_type = excluded.reference_type,
            reference_id = excluded.reference_id,
            serie = excluded.serie,
            numero = excluded.numero,
            access_key = excluded.access_key,
            status = excluded.status,
            emission_mode = excluded.emission_mode,
            dedup_key = excluded.dedup_key,
            payload_json = excluded.payload_json,
            context_json = excluded.context_json,
            contingency_required = excluded.contingency_required,
            contingency_started_at = excluded.contingency_started_at,
            provider_reference_id = excluded.provider_reference_id,
            lease_expires_at = excluded.lease_expires_at,
            next_retry_at = excluded.next_retry_at,
            issued_at = excluded.issued_at,
            authorized_at = excluded.authorized_at,
            last_status_checked_at = excluded.last_status_checked_at,
            updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
        `
      )
      .run({
        fiscalQueueId: entry.fiscalQueueId,
        fiscalDocId: entry.fiscalDocId,
        emitterId: entry.emitterId ?? null,
        terminalId: entry.terminalId ?? null,
        provider: entry.provider,
        environment: entry.environment ?? "HOMOLOGACAO",
        stateCode: entry.stateCode ?? "SP",
        documentModel: entry.documentModel ?? "65",
        documentType: entry.documentType,
        referenceType: entry.referenceType ?? null,
        referenceId: entry.referenceId ?? null,
        serie: entry.serie ?? null,
        numero: entry.numero ?? null,
        accessKey: entry.accessKey ?? null,
        status: entry.status ?? "DRAFT",
        emissionMode: entry.emissionMode ?? "NORMAL",
        dedupKey: entry.dedupKey ?? null,
        payloadJson: serializeJson(entry.payload),
        contextJson: serializeJson(entry.context),
        contingencyRequired: entry.contingencyRequired ? 1 : 0,
        contingencyStartedAt: entry.contingencyStartedAt ?? null,
        providerReferenceId: entry.providerReferenceId ?? null,
        leaseExpiresAt: entry.leaseExpiresAt ?? null,
        nextRetryAt: entry.nextRetryAt ?? null,
        issuedAt: entry.issuedAt ?? null,
        authorizedAt: entry.authorizedAt ?? null,
        lastStatusCheckedAt: entry.lastStatusCheckedAt ?? null
      });

    return this.findById(entry.fiscalQueueId);
  }

  findById(fiscalQueueId: string): FiscalQueueRecord {
    const row = this.#db.prepare(
      `
        SELECT
          fiscal_queue_id AS fiscalQueueId,
          fiscal_doc_id AS fiscalDocId,
          emitter_id AS emitterId,
          terminal_id AS terminalId,
          provider,
          environment,
          state_code AS stateCode,
          document_model AS documentModel,
          document_type AS documentType,
          reference_type AS referenceType,
          reference_id AS referenceId,
          serie,
          numero,
          access_key AS accessKey,
          status,
          emission_mode AS emissionMode,
          dedup_key AS dedupKey,
          payload_json AS payloadJson,
          context_json AS contextJson,
          attempts,
          contingency_required AS contingencyRequired,
          contingency_started_at AS contingencyStartedAt,
          provider_reference_id AS providerReferenceId,
          lease_expires_at AS leaseExpiresAt,
          last_error_code AS lastErrorCode,
          last_error_message AS lastErrorMessage,
          next_retry_at AS nextRetryAt,
          issued_at AS issuedAt,
          authorized_at AS authorizedAt,
          last_status_checked_at AS lastStatusCheckedAt,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM fiscal_queue
        WHERE fiscal_queue_id = :fiscalQueueId
      `
    ).get({ fiscalQueueId }) as FiscalQueueRow | undefined;

    if (!row) {
      throw new Error(`Item da fila fiscal nao encontrado: ${fiscalQueueId}`);
    }

    return mapFiscalQueue(row);
  }

  listPending(limit = 50, asOf = new Date().toISOString()): FiscalQueueRecord[] {
    return (this.#db.prepare(
      `
        SELECT
          fiscal_queue_id AS fiscalQueueId,
          fiscal_doc_id AS fiscalDocId,
          emitter_id AS emitterId,
          terminal_id AS terminalId,
          provider,
          environment,
          state_code AS stateCode,
          document_model AS documentModel,
          document_type AS documentType,
          reference_type AS referenceType,
          reference_id AS referenceId,
          serie,
          numero,
          access_key AS accessKey,
          status,
          emission_mode AS emissionMode,
          dedup_key AS dedupKey,
          payload_json AS payloadJson,
          context_json AS contextJson,
          attempts,
          contingency_required AS contingencyRequired,
          contingency_started_at AS contingencyStartedAt,
          provider_reference_id AS providerReferenceId,
          lease_expires_at AS leaseExpiresAt,
          last_error_code AS lastErrorCode,
          last_error_message AS lastErrorMessage,
          next_retry_at AS nextRetryAt,
          issued_at AS issuedAt,
          authorized_at AS authorizedAt,
          last_status_checked_at AS lastStatusCheckedAt,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM fiscal_queue
        WHERE (
          status IN ('DRAFT', 'SIGNED', 'SENT', 'CONTINGENCY')
          OR (status = 'REJECTED' AND next_retry_at IS NOT NULL)
        )
          AND (next_retry_at IS NULL OR next_retry_at <= :asOf)
          AND (lease_expires_at IS NULL OR lease_expires_at <= :asOf)
        ORDER BY created_at ASC
        LIMIT :limit
      `
    ).all({ asOf, limit }) as unknown as FiscalQueueRow[]).map(mapFiscalQueue);
  }

  claimNextReady(input: ClaimFiscalQueueInput): FiscalQueueRecord | null {
    const next = this.#db.prepare(
      `
        SELECT fiscal_queue_id AS fiscalQueueId
        FROM fiscal_queue
        WHERE (
          status IN ('DRAFT', 'SIGNED', 'SENT', 'CONTINGENCY')
          OR (status = 'REJECTED' AND next_retry_at IS NOT NULL)
        )
          AND (next_retry_at IS NULL OR next_retry_at <= :asOf)
          AND (lease_expires_at IS NULL OR lease_expires_at <= :asOf)
        ORDER BY created_at ASC
        LIMIT 1
      `
    ).get({
      asOf: input.asOf
    }) as { fiscalQueueId: string } | undefined;

    if (!next) {
      return null;
    }

    this.#db.prepare(
      `
        UPDATE fiscal_queue
        SET
          lease_expires_at = :leaseExpiresAt,
          updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE fiscal_queue_id = :fiscalQueueId
      `
    ).run({
      fiscalQueueId: next.fiscalQueueId,
      leaseExpiresAt: input.leaseExpiresAt
    });

    return this.findById(next.fiscalQueueId);
  }

  registerAttempt(input: FiscalQueueAttemptInput): FiscalQueueRecord {
    this.#db
      .prepare(
        `
          UPDATE fiscal_queue
          SET
            status = :status,
            attempts = attempts + :attemptDelta,
            contingency_required = :contingencyRequired,
            emission_mode = COALESCE(:emissionMode, emission_mode),
            contingency_started_at = COALESCE(:contingencyStartedAt, contingency_started_at),
            provider_reference_id = COALESCE(:providerReferenceId, provider_reference_id),
            lease_expires_at = :leaseExpiresAt,
            last_error_code = :lastErrorCode,
            last_error_message = :lastErrorMessage,
            next_retry_at = :nextRetryAt,
            issued_at = COALESCE(:issuedAt, issued_at),
            authorized_at = COALESCE(:authorizedAt, authorized_at),
            access_key = COALESCE(:accessKey, access_key),
            last_status_checked_at = COALESCE(:lastStatusCheckedAt, last_status_checked_at),
            updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE fiscal_queue_id = :fiscalQueueId
        `
      )
      .run({
        fiscalQueueId: input.fiscalQueueId,
        status: input.status,
        attemptDelta: input.incrementAttempts ?? true ? 1 : 0,
        contingencyRequired: input.contingencyRequired ? 1 : 0,
        emissionMode: input.emissionMode ?? null,
        contingencyStartedAt: input.contingencyStartedAt ?? null,
        providerReferenceId: input.providerReferenceId ?? null,
        leaseExpiresAt: input.leaseExpiresAt ?? null,
        lastErrorCode: input.lastErrorCode ?? null,
        lastErrorMessage: input.lastErrorMessage ?? null,
        nextRetryAt: input.nextRetryAt ?? null,
        issuedAt: input.issuedAt ?? null,
        authorizedAt: input.authorizedAt ?? null,
        accessKey: input.accessKey ?? null,
        lastStatusCheckedAt: input.lastStatusCheckedAt ?? null
      });

    return this.findById(input.fiscalQueueId);
  }
}

function mapFiscalQueue(row: FiscalQueueRow): FiscalQueueRecord {
  return {
    fiscalQueueId: row.fiscalQueueId,
    fiscalDocId: row.fiscalDocId,
    emitterId: row.emitterId,
    terminalId: row.terminalId,
    provider: row.provider,
    environment: row.environment,
    stateCode: row.stateCode,
    documentModel: row.documentModel,
    documentType: row.documentType,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    serie: row.serie,
    numero: row.numero,
    accessKey: row.accessKey,
    status: row.status,
    emissionMode: row.emissionMode,
    dedupKey: row.dedupKey,
    payload: parseJson(row.payloadJson),
    context: parseJson(row.contextJson),
    attempts: row.attempts,
    contingencyRequired: row.contingencyRequired === 1,
    contingencyStartedAt: row.contingencyStartedAt,
    providerReferenceId: row.providerReferenceId,
    leaseExpiresAt: row.leaseExpiresAt,
    lastErrorCode: row.lastErrorCode,
    lastErrorMessage: row.lastErrorMessage,
    nextRetryAt: row.nextRetryAt,
    issuedAt: row.issuedAt,
    authorizedAt: row.authorizedAt,
    lastStatusCheckedAt: row.lastStatusCheckedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
