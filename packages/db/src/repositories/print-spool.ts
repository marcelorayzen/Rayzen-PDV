import type { DatabaseSync } from "node:sqlite";

import { parseJson, serializeJson } from "../json.js";
import { executeTransaction } from "../transaction.js";
import type {
  JsonValue,
  PrintJobAttemptInput,
  PrintJobInput,
  PrintJobRecord,
  PrintJobStatus
} from "../types.js";

interface PrintJobRow {
  printJobId: string;
  sourceEntity: string | null;
  sourceEntityId: string | null;
  setor: string;
  status: PrintJobStatus;
  ticketKind: "PRODUCAO" | "SEGUNDA_VIA";
  dedupKey: string | null;
  printerTargetId: string | null;
  printerTargetName: string | null;
  secondCopyOfJobId: string | null;
  payloadJson: string;
  attempts: number;
  secondCopyCount: number;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  nextRetryAt: string | null;
  lastAttemptAt: string | null;
  leaseExpiresAt: string | null;
  printedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClaimPrintJobOptions {
  asOf?: string;
  leaseExpiresAt: string;
  setor?: string | null;
}

export interface CreateSecondCopyInput {
  originalJobId: string;
  secondCopyJobId: string;
  queuedAt: string;
  dedupKey?: string | null;
}

export class PrintSpoolRepository {
  readonly #db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.#db = db;
  }

  enqueue(job: PrintJobInput): PrintJobRecord {
    if (job.dedupKey) {
      const existing = this.findByDedupKey(job.dedupKey);

      if (existing) {
        return existing;
      }
    }

    try {
      this.#db
        .prepare(
          `
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
              next_retry_at
            )
            VALUES (
              :printJobId,
              :sourceEntity,
              :sourceEntityId,
              :setor,
              :status,
              :ticketKind,
              :dedupKey,
              :printerTargetId,
              :printerTargetName,
              :secondCopyOfJobId,
              :payloadJson,
              :nextRetryAt
            )
          `
        )
        .run({
          printJobId: job.printJobId,
          sourceEntity: job.sourceEntity ?? null,
          sourceEntityId: job.sourceEntityId ?? null,
          setor: job.setor,
          status: job.status ?? "QUEUED",
          ticketKind: job.ticketKind ?? "PRODUCAO",
          dedupKey: job.dedupKey ?? null,
          printerTargetId: job.printerTargetId ?? null,
          printerTargetName: job.printerTargetName ?? null,
          secondCopyOfJobId: job.secondCopyOfJobId ?? null,
          payloadJson: serializeJson(job.payload),
          nextRetryAt: job.nextRetryAt ?? null
        });
    } catch (error) {
      if (job.dedupKey && isUniqueConstraintError(error)) {
        const existing = this.findByDedupKey(job.dedupKey);

        if (existing) {
          return existing;
        }
      }

      throw error;
    }

    return this.findById(job.printJobId);
  }

  createSecondCopy(input: CreateSecondCopyInput): PrintJobRecord {
    executeTransaction(this.#db, () => {
      const original = this.findById(input.originalJobId);
      const secondCopySequence = original.secondCopyCount + 1;

      this.enqueue({
        printJobId: input.secondCopyJobId,
        sourceEntity: original.sourceEntity,
        sourceEntityId: original.sourceEntityId,
        setor: original.setor,
        status: "QUEUED",
        ticketKind: "SEGUNDA_VIA",
        dedupKey: input.dedupKey ?? `${original.printJobId}:copy:${secondCopySequence}`,
        printerTargetId: original.printerTargetId,
        printerTargetName: original.printerTargetName,
        secondCopyOfJobId: original.printJobId,
        payload: buildSecondCopyPayload(original.payload, secondCopySequence, input.queuedAt)
      });

      this.#db
        .prepare(
          `
            UPDATE print_jobs
            SET
              second_copy_count = second_copy_count + 1,
              updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE print_job_id = :printJobId
          `
        )
        .run({
          printJobId: input.originalJobId
        });
    });

    return this.findById(input.secondCopyJobId);
  }

  findById(printJobId: string): PrintJobRecord {
    const row = selectPrintJobByWhereClause(this.#db, "WHERE print_job_id = :value", {
      value: printJobId
    });

    if (!row) {
      throw new Error(`Job de impressao nao encontrado: ${printJobId}`);
    }

    return mapPrintJob(row);
  }

  findByDedupKey(dedupKey: string): PrintJobRecord | null {
    const row = selectPrintJobByWhereClause(this.#db, "WHERE dedup_key = :value", {
      value: dedupKey
    });

    return row ? mapPrintJob(row) : null;
  }

  listPending(limit = 50): PrintJobRecord[] {
    return (this.#db.prepare(
      `
        SELECT
          print_job_id AS printJobId,
          source_entity AS sourceEntity,
          source_entity_id AS sourceEntityId,
          setor,
          status,
          ticket_kind AS ticketKind,
          dedup_key AS dedupKey,
          printer_target_id AS printerTargetId,
          printer_target_name AS printerTargetName,
          second_copy_of_job_id AS secondCopyOfJobId,
          payload_json AS payloadJson,
          attempts,
          second_copy_count AS secondCopyCount,
          last_error_code AS lastErrorCode,
          last_error_message AS lastErrorMessage,
          next_retry_at AS nextRetryAt,
          last_attempt_at AS lastAttemptAt,
          lease_expires_at AS leaseExpiresAt,
          printed_at AS printedAt,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM print_jobs
        WHERE status <> 'DONE'
        ORDER BY created_at ASC
        LIMIT :limit
      `
    ).all({ limit }) as unknown as PrintJobRow[]).map(mapPrintJob);
  }

  listRecent(limit = 100): PrintJobRecord[] {
    return (this.#db.prepare(
      `
        SELECT
          print_job_id AS printJobId,
          source_entity AS sourceEntity,
          source_entity_id AS sourceEntityId,
          setor,
          status,
          ticket_kind AS ticketKind,
          dedup_key AS dedupKey,
          printer_target_id AS printerTargetId,
          printer_target_name AS printerTargetName,
          second_copy_of_job_id AS secondCopyOfJobId,
          payload_json AS payloadJson,
          attempts,
          second_copy_count AS secondCopyCount,
          last_error_code AS lastErrorCode,
          last_error_message AS lastErrorMessage,
          next_retry_at AS nextRetryAt,
          last_attempt_at AS lastAttemptAt,
          lease_expires_at AS leaseExpiresAt,
          printed_at AS printedAt,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM print_jobs
        ORDER BY created_at DESC
        LIMIT :limit
      `
    ).all({ limit }) as unknown as PrintJobRow[]).map(mapPrintJob);
  }

  claimNextReady(options: ClaimPrintJobOptions): PrintJobRecord | null {
    let claimedJobId: string | null = null;
    const asOf = options.asOf ?? new Date().toISOString();
    const setor = options.setor ?? null;

    executeTransaction(this.#db, () => {
      const row = this.#db.prepare(
        `
          SELECT
            print_job_id AS printJobId
          FROM print_jobs
          WHERE
            (
              (
                status IN ('QUEUED', 'WAITING_PRINTER')
                AND (next_retry_at IS NULL OR next_retry_at <= :asOf)
              )
              OR (
                status = 'PRINTING'
                AND lease_expires_at IS NOT NULL
                AND lease_expires_at <= :asOf
              )
            )
            AND (:setor IS NULL OR setor = :setor)
          ORDER BY created_at ASC
          LIMIT 1
        `
      ).get({
        asOf,
        setor
      }) as { printJobId: string } | undefined;

      if (!row) {
        return;
      }

      claimedJobId = row.printJobId;
      this.#db
        .prepare(
          `
            UPDATE print_jobs
            SET
              status = 'PRINTING',
              lease_expires_at = :leaseExpiresAt,
              updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE print_job_id = :printJobId
          `
        )
        .run({
          printJobId: row.printJobId,
          leaseExpiresAt: options.leaseExpiresAt
        });
    });

    return claimedJobId ? this.findById(claimedJobId) : null;
  }

  registerAttempt(input: PrintJobAttemptInput): PrintJobRecord {
    this.#db
      .prepare(
        `
          UPDATE print_jobs
          SET
            status = :status,
            attempts = attempts + :attemptDelta,
            second_copy_count = second_copy_count + :secondCopyDelta,
            last_error_code = :lastErrorCode,
            last_error_message = :lastErrorMessage,
            next_retry_at = :nextRetryAt,
            last_attempt_at = :lastAttemptAt,
            lease_expires_at = :leaseExpiresAt,
            printed_at = :printedAt,
            updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE print_job_id = :printJobId
        `
      )
      .run({
        printJobId: input.printJobId,
        status: input.status,
        attemptDelta: input.incrementAttempts ?? true ? 1 : 0,
        secondCopyDelta: input.incrementSecondCopyCount ?? false ? 1 : 0,
        lastErrorCode: input.lastErrorCode ?? null,
        lastErrorMessage: input.lastErrorMessage ?? null,
        nextRetryAt: input.nextRetryAt ?? null,
        lastAttemptAt: input.lastAttemptAt ?? null,
        leaseExpiresAt: input.leaseExpiresAt ?? null,
        printedAt: input.printedAt ?? null
      });

    return this.findById(input.printJobId);
  }
}

function selectPrintJobByWhereClause(
  db: DatabaseSync,
  whereClause: string,
  params: Record<string, string | null>
): PrintJobRow | undefined {
  return db.prepare(
    `
      SELECT
        print_job_id AS printJobId,
        source_entity AS sourceEntity,
        source_entity_id AS sourceEntityId,
        setor,
        status,
        ticket_kind AS ticketKind,
        dedup_key AS dedupKey,
        printer_target_id AS printerTargetId,
        printer_target_name AS printerTargetName,
        second_copy_of_job_id AS secondCopyOfJobId,
        payload_json AS payloadJson,
        attempts,
        second_copy_count AS secondCopyCount,
        last_error_code AS lastErrorCode,
        last_error_message AS lastErrorMessage,
        next_retry_at AS nextRetryAt,
        last_attempt_at AS lastAttemptAt,
        lease_expires_at AS leaseExpiresAt,
        printed_at AS printedAt,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM print_jobs
      ${whereClause}
      LIMIT 1
    `
  ).get(params) as PrintJobRow | undefined;
}

function isUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = String((error as { code?: string }).code ?? "");
  const message = error.message.toUpperCase();

  return code.includes("SQLITE_CONSTRAINT") || message.includes("UNIQUE CONSTRAINT");
}

function buildSecondCopyPayload(
  payload: JsonValue,
  secondCopySequence: number,
  queuedAt: string
): JsonValue {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return {
      ...payload,
      ticketKind: "SEGUNDA_VIA",
      secondCopy: true,
      secondCopySequence,
      secondCopyQueuedAt: queuedAt
    };
  }

  return {
    ticketKind: "SEGUNDA_VIA",
    secondCopy: true,
    secondCopySequence,
    secondCopyQueuedAt: queuedAt,
    originalPayload: payload
  };
}

function mapPrintJob(row: PrintJobRow): PrintJobRecord {
  return {
    printJobId: row.printJobId,
    sourceEntity: row.sourceEntity,
    sourceEntityId: row.sourceEntityId,
    setor: row.setor,
    status: row.status,
    ticketKind: row.ticketKind,
    dedupKey: row.dedupKey,
    printerTargetId: row.printerTargetId,
    printerTargetName: row.printerTargetName,
    secondCopyOfJobId: row.secondCopyOfJobId,
    payload: parseJson(row.payloadJson),
    attempts: row.attempts,
    secondCopyCount: row.secondCopyCount,
    lastErrorCode: row.lastErrorCode,
    lastErrorMessage: row.lastErrorMessage,
    nextRetryAt: row.nextRetryAt,
    lastAttemptAt: row.lastAttemptAt,
    leaseExpiresAt: row.leaseExpiresAt,
    printedAt: row.printedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
