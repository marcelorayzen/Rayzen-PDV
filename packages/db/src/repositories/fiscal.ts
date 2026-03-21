import type { DatabaseSync } from "node:sqlite";

import { parseJson, serializeJson } from "../json.js";
import type {
  AppendFiscalDocumentStateInput,
  AuditEventInput,
  FiscalDocumentEventRecord,
  FiscalDocumentRecord,
  FiscalEmitterRecord,
  FiscalQueueRecord,
  PersistedFiscalDocumentTrail,
  SaveFiscalDocumentDraftInput,
  SaveFiscalEmitterInput
} from "../types.js";

interface FiscalEmitterRow {
  emitterId: string;
  provider: FiscalEmitterRecord["provider"];
  environment: FiscalEmitterRecord["environment"];
  stateCode: FiscalEmitterRecord["stateCode"];
  documentModel: FiscalEmitterRecord["documentModel"];
  certificateKind: FiscalEmitterRecord["certificateKind"];
  legalName: string;
  tradeName: string | null;
  cnpj: string;
  stateRegistration: string;
  cscId: string;
  certificateSubject: string | null;
  certificateValidFrom: string | null;
  certificateValidUntil: string | null;
  status: FiscalEmitterRecord["status"];
  settingsJson: string;
  createdAt: string;
  updatedAt: string;
}

interface FiscalDocumentRow {
  fiscalDocId: string;
  emitterId: string;
  terminalId: string;
  referenceType: string;
  referenceId: string;
  provider: FiscalDocumentRecord["provider"];
  environment: FiscalDocumentRecord["environment"];
  stateCode: FiscalDocumentRecord["stateCode"];
  documentModel: FiscalDocumentRecord["documentModel"];
  serie: string;
  numero: number;
  accessKey: string | null;
  nsReferenceId: string | null;
  status: FiscalDocumentRecord["status"];
  emissionMode: FiscalDocumentRecord["emissionMode"];
  contingencyRequired: number;
  contingencyStartedAt: string | null;
  contingencyJustification: string | null;
  contingencyPrintedAt: string | null;
  contingencyDanfePath: string | null;
  payloadJson: string;
  responseJson: string;
  xmlStoragePath: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  issuedAt: string | null;
  authorizedAt: string | null;
  lastStatusCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

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
  status: FiscalQueueRecord["status"];
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

interface FiscalEventRow {
  fiscalEventId: string;
  fiscalDocId: string;
  emitterId: string;
  eventType: string;
  status: FiscalDocumentEventRecord["status"];
  provider: FiscalDocumentEventRecord["provider"];
  providerReferenceId: string | null;
  occurredAt: string;
  payloadJson: string;
  createdAt: string;
}

export class FiscalRepository {
  readonly #db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.#db = db;
  }

  upsertEmitter(input: SaveFiscalEmitterInput): FiscalEmitterRecord {
    executeTransaction(this.#db, () => {
      this.#upsertEmitterRecord(input.emitter);

      for (const event of input.auditEvents ?? []) {
        this.#appendAuditEvent(event);
      }
    });

    const emitter = this.findEmitterById(input.emitter.emitterId);

    if (!emitter) {
      throw new Error(`Emitente fiscal nao encontrado apos persistencia: ${input.emitter.emitterId}`);
    }

    return emitter;
  }

  findEmitterById(emitterId: string): FiscalEmitterRecord | null {
    const row = this.#db.prepare(
      `
        SELECT
          emitter_id AS emitterId,
          provider,
          environment,
          state_code AS stateCode,
          document_model AS documentModel,
          certificate_kind AS certificateKind,
          legal_name AS legalName,
          trade_name AS tradeName,
          cnpj,
          state_registration AS stateRegistration,
          csc_id AS cscId,
          certificate_subject AS certificateSubject,
          certificate_valid_from AS certificateValidFrom,
          certificate_valid_until AS certificateValidUntil,
          status,
          settings_json AS settingsJson,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM fiscal_emitters
        WHERE emitter_id = :emitterId
      `
    ).get({ emitterId }) as FiscalEmitterRow | undefined;

    return row ? mapFiscalEmitter(row) : null;
  }

  listEmitters(limit = 20): FiscalEmitterRecord[] {
    return (this.#db.prepare(
      `
        SELECT
          emitter_id AS emitterId,
          provider,
          environment,
          state_code AS stateCode,
          document_model AS documentModel,
          certificate_kind AS certificateKind,
          legal_name AS legalName,
          trade_name AS tradeName,
          cnpj,
          state_registration AS stateRegistration,
          csc_id AS cscId,
          certificate_subject AS certificateSubject,
          certificate_valid_from AS certificateValidFrom,
          certificate_valid_until AS certificateValidUntil,
          status,
          settings_json AS settingsJson,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM fiscal_emitters
        ORDER BY updated_at DESC, emitter_id ASC
        LIMIT :limit
      `
    ).all({ limit }) as unknown as FiscalEmitterRow[]).map(mapFiscalEmitter);
  }

  saveDraft(input: SaveFiscalDocumentDraftInput): PersistedFiscalDocumentTrail {
    executeTransaction(this.#db, () => {
      this.#upsertDocument(input.document);
      this.#upsertQueue(input.queue);
      this.#insertEvent(input.initialEvent);

      for (const event of input.auditEvents ?? []) {
        this.#appendAuditEvent(event);
      }
    });

    return this.getDocumentTrail(input.document.fiscalDocId);
  }

  appendState(input: AppendFiscalDocumentStateInput): PersistedFiscalDocumentTrail {
    executeTransaction(this.#db, () => {
      const currentDocument = this.#mustFindDocumentRow(input.fiscalDocId);
      const currentQueue = this.#mustFindQueueRow(input.fiscalQueueId);

      this.#db.prepare(
        `
          UPDATE fiscal_documents
          SET
            status = :status,
            access_key = :accessKey,
            ns_reference_id = :nsReferenceId,
            emission_mode = :emissionMode,
            contingency_required = :contingencyRequired,
            contingency_started_at = :contingencyStartedAt,
            contingency_justification = :contingencyJustification,
            contingency_printed_at = :contingencyPrintedAt,
            contingency_danfe_path = :contingencyDanfePath,
            response_json = :responseJson,
            xml_storage_path = :xmlStoragePath,
            last_error_code = :lastErrorCode,
            last_error_message = :lastErrorMessage,
            issued_at = :issuedAt,
            authorized_at = :authorizedAt,
            last_status_checked_at = :lastStatusCheckedAt,
            updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE fiscal_doc_id = :fiscalDocId
        `
      ).run({
        fiscalDocId: input.fiscalDocId,
        status: input.status,
        accessKey: resolveNullable(input, "accessKey", currentDocument.accessKey),
        nsReferenceId: resolveNullable(input, "providerReferenceId", currentDocument.nsReferenceId),
        emissionMode: resolveValue(input, "emissionMode", currentDocument.emissionMode) ?? currentDocument.emissionMode,
        contingencyRequired: resolveBooleanFlag(
          input,
          "contingencyRequired",
          currentDocument.contingencyRequired === 1
        ),
        contingencyStartedAt: resolveNullable(
          input,
          "contingencyStartedAt",
          currentDocument.contingencyStartedAt
        ),
        contingencyJustification: resolveNullable(
          input,
          "contingencyJustification",
          currentDocument.contingencyJustification
        ),
        contingencyPrintedAt: resolveNullable(
          input,
          "contingencyPrintedAt",
          currentDocument.contingencyPrintedAt
        ),
        contingencyDanfePath: resolveNullable(
          input,
          "contingencyDanfePath",
          currentDocument.contingencyDanfePath
        ),
        responseJson: serializeJson(resolveValue(input, "response", parseJson(currentDocument.responseJson))),
        xmlStoragePath: resolveNullable(input, "xmlStoragePath", currentDocument.xmlStoragePath),
        lastErrorCode: resolveNullable(input, "lastErrorCode", currentDocument.lastErrorCode),
        lastErrorMessage: resolveNullable(input, "lastErrorMessage", currentDocument.lastErrorMessage),
        issuedAt: resolveNullable(input, "issuedAt", currentDocument.issuedAt),
        authorizedAt: resolveNullable(input, "authorizedAt", currentDocument.authorizedAt),
        lastStatusCheckedAt: resolveNullable(
          input,
          "lastStatusCheckedAt",
          currentDocument.lastStatusCheckedAt
        )
      });

      this.#db.prepare(
        `
          UPDATE fiscal_queue
          SET
            status = :status,
            access_key = :accessKey,
            emission_mode = :emissionMode,
            contingency_required = :contingencyRequired,
            contingency_started_at = :contingencyStartedAt,
            provider_reference_id = :providerReferenceId,
            lease_expires_at = :leaseExpiresAt,
            last_error_code = :lastErrorCode,
            last_error_message = :lastErrorMessage,
            next_retry_at = :nextRetryAt,
            issued_at = :issuedAt,
            authorized_at = :authorizedAt,
            last_status_checked_at = :lastStatusCheckedAt,
            updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE fiscal_queue_id = :fiscalQueueId
        `
      ).run({
        fiscalQueueId: input.fiscalQueueId,
        status: input.status,
        accessKey: resolveNullable(input, "accessKey", currentQueue.accessKey),
        emissionMode: resolveValue(input, "emissionMode", currentQueue.emissionMode) ?? currentQueue.emissionMode,
        contingencyRequired: resolveBooleanFlag(
          input,
          "contingencyRequired",
          currentQueue.contingencyRequired === 1
        ),
        contingencyStartedAt: resolveNullable(
          input,
          "contingencyStartedAt",
          currentQueue.contingencyStartedAt
        ),
        providerReferenceId: resolveNullable(
          input,
          "providerReferenceId",
          currentQueue.providerReferenceId
        ),
        leaseExpiresAt: resolveNullable(input, "leaseExpiresAt", currentQueue.leaseExpiresAt),
        lastErrorCode: resolveNullable(input, "lastErrorCode", currentQueue.lastErrorCode),
        lastErrorMessage: resolveNullable(input, "lastErrorMessage", currentQueue.lastErrorMessage),
        nextRetryAt: resolveNullable(input, "nextRetryAt", currentQueue.nextRetryAt),
        issuedAt: resolveNullable(input, "issuedAt", currentQueue.issuedAt),
        authorizedAt: resolveNullable(input, "authorizedAt", currentQueue.authorizedAt),
        lastStatusCheckedAt: resolveNullable(
          input,
          "lastStatusCheckedAt",
          currentQueue.lastStatusCheckedAt
        )
      });

      this.#insertEvent({
        ...input.event,
        fiscalDocId: input.fiscalDocId
      });

      for (const event of input.auditEvents ?? []) {
        this.#appendAuditEvent(event);
      }
    });

    return this.getDocumentTrail(input.fiscalDocId);
  }

  findDocumentById(fiscalDocId: string): FiscalDocumentRecord | null {
    const row = this.#findDocumentRow(fiscalDocId);
    return row ? mapFiscalDocument(row) : null;
  }

  findDocumentByAccessKey(accessKey: string): FiscalDocumentRecord | null {
    const row = this.#db.prepare(
      `
        SELECT
          fiscal_doc_id AS fiscalDocId,
          emitter_id AS emitterId,
          terminal_id AS terminalId,
          reference_type AS referenceType,
          reference_id AS referenceId,
          provider,
          environment,
          state_code AS stateCode,
          document_model AS documentModel,
          serie,
          numero,
          access_key AS accessKey,
          ns_reference_id AS nsReferenceId,
          status,
          emission_mode AS emissionMode,
          contingency_required AS contingencyRequired,
          contingency_started_at AS contingencyStartedAt,
          contingency_justification AS contingencyJustification,
          contingency_printed_at AS contingencyPrintedAt,
          contingency_danfe_path AS contingencyDanfePath,
          payload_json AS payloadJson,
          response_json AS responseJson,
          xml_storage_path AS xmlStoragePath,
          last_error_code AS lastErrorCode,
          last_error_message AS lastErrorMessage,
          issued_at AS issuedAt,
          authorized_at AS authorizedAt,
          last_status_checked_at AS lastStatusCheckedAt,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM fiscal_documents
        WHERE access_key = :accessKey
      `
    ).get({ accessKey }) as FiscalDocumentRow | undefined;

    return row ? mapFiscalDocument(row) : null;
  }

  listDocuments(limit = 20): FiscalDocumentRecord[] {
    return (this.#db.prepare(
      `
        SELECT
          fiscal_doc_id AS fiscalDocId,
          emitter_id AS emitterId,
          terminal_id AS terminalId,
          reference_type AS referenceType,
          reference_id AS referenceId,
          provider,
          environment,
          state_code AS stateCode,
          document_model AS documentModel,
          serie,
          numero,
          access_key AS accessKey,
          ns_reference_id AS nsReferenceId,
          status,
          emission_mode AS emissionMode,
          contingency_required AS contingencyRequired,
          contingency_started_at AS contingencyStartedAt,
          contingency_justification AS contingencyJustification,
          contingency_printed_at AS contingencyPrintedAt,
          contingency_danfe_path AS contingencyDanfePath,
          payload_json AS payloadJson,
          response_json AS responseJson,
          xml_storage_path AS xmlStoragePath,
          last_error_code AS lastErrorCode,
          last_error_message AS lastErrorMessage,
          issued_at AS issuedAt,
          authorized_at AS authorizedAt,
          last_status_checked_at AS lastStatusCheckedAt,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM fiscal_documents
        ORDER BY created_at DESC, fiscal_doc_id DESC
        LIMIT :limit
      `
    ).all({ limit }) as unknown as FiscalDocumentRow[]).map(mapFiscalDocument);
  }

  findLatestDocumentByReference(referenceType: string, referenceId: string): FiscalDocumentRecord | null {
    const row = this.#db.prepare(
      `
        SELECT
          fiscal_doc_id AS fiscalDocId,
          emitter_id AS emitterId,
          terminal_id AS terminalId,
          reference_type AS referenceType,
          reference_id AS referenceId,
          provider,
          environment,
          state_code AS stateCode,
          document_model AS documentModel,
          serie,
          numero,
          access_key AS accessKey,
          ns_reference_id AS nsReferenceId,
          status,
          emission_mode AS emissionMode,
          contingency_required AS contingencyRequired,
          contingency_started_at AS contingencyStartedAt,
          contingency_justification AS contingencyJustification,
          contingency_printed_at AS contingencyPrintedAt,
          contingency_danfe_path AS contingencyDanfePath,
          payload_json AS payloadJson,
          response_json AS responseJson,
          xml_storage_path AS xmlStoragePath,
          last_error_code AS lastErrorCode,
          last_error_message AS lastErrorMessage,
          issued_at AS issuedAt,
          authorized_at AS authorizedAt,
          last_status_checked_at AS lastStatusCheckedAt,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM fiscal_documents
        WHERE reference_type = :referenceType
          AND reference_id = :referenceId
        ORDER BY created_at DESC, fiscal_doc_id DESC
        LIMIT 1
      `
    ).get({ referenceType, referenceId }) as FiscalDocumentRow | undefined;

    return row ? mapFiscalDocument(row) : null;
  }

  getNextDocumentNumber(emitterId: string, serie: string): number {
    const row = this.#db.prepare(
      `
        SELECT COALESCE(MAX(numero), 0) AS currentMax
        FROM fiscal_documents
        WHERE emitter_id = :emitterId
          AND serie = :serie
      `
    ).get({ emitterId, serie }) as { currentMax: number } | undefined;

    return (row?.currentMax ?? 0) + 1;
  }

  listEventsByDocument(fiscalDocId: string): FiscalDocumentEventRecord[] {
    return (this.#db.prepare(
      `
        SELECT
          fiscal_event_id AS fiscalEventId,
          fiscal_doc_id AS fiscalDocId,
          emitter_id AS emitterId,
          event_type AS eventType,
          status,
          provider,
          provider_reference_id AS providerReferenceId,
          occurred_at AS occurredAt,
          payload_json AS payloadJson,
          created_at AS createdAt
        FROM fiscal_document_events
        WHERE fiscal_doc_id = :fiscalDocId
        ORDER BY occurred_at ASC, fiscal_event_id ASC
      `
    ).all({ fiscalDocId }) as unknown as FiscalEventRow[]).map(mapFiscalEvent);
  }

  getDocumentTrail(fiscalDocId: string): PersistedFiscalDocumentTrail {
    const document = this.findDocumentById(fiscalDocId);

    if (!document) {
      throw new Error(`Documento fiscal nao encontrado: ${fiscalDocId}`);
    }

    return {
      document,
      queue: this.#findQueueByDocumentId(fiscalDocId),
      events: this.listEventsByDocument(fiscalDocId)
    };
  }

  #upsertEmitterRecord(emitter: SaveFiscalEmitterInput["emitter"]): void {
    this.#db.prepare(
      `
        INSERT INTO fiscal_emitters (
          emitter_id,
          provider,
          environment,
          state_code,
          document_model,
          certificate_kind,
          legal_name,
          trade_name,
          cnpj,
          state_registration,
          csc_id,
          certificate_subject,
          certificate_valid_from,
          certificate_valid_until,
          status,
          settings_json
        )
        VALUES (
          :emitterId,
          :provider,
          :environment,
          :stateCode,
          :documentModel,
          :certificateKind,
          :legalName,
          :tradeName,
          :cnpj,
          :stateRegistration,
          :cscId,
          :certificateSubject,
          :certificateValidFrom,
          :certificateValidUntil,
          :status,
          :settingsJson
        )
        ON CONFLICT(emitter_id) DO UPDATE SET
          provider = excluded.provider,
          environment = excluded.environment,
          state_code = excluded.state_code,
          document_model = excluded.document_model,
          certificate_kind = excluded.certificate_kind,
          legal_name = excluded.legal_name,
          trade_name = excluded.trade_name,
          cnpj = excluded.cnpj,
          state_registration = excluded.state_registration,
          csc_id = excluded.csc_id,
          certificate_subject = excluded.certificate_subject,
          certificate_valid_from = excluded.certificate_valid_from,
          certificate_valid_until = excluded.certificate_valid_until,
          status = excluded.status,
          settings_json = excluded.settings_json,
          updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
      `
    ).run({
      emitterId: emitter.emitterId,
      provider: emitter.provider,
      environment: emitter.environment,
      stateCode: emitter.stateCode,
      documentModel: emitter.documentModel,
      certificateKind: emitter.certificateKind,
      legalName: emitter.legalName,
      tradeName: emitter.tradeName,
      cnpj: emitter.cnpj,
      stateRegistration: emitter.stateRegistration,
      cscId: emitter.cscId,
      certificateSubject: emitter.certificateSubject,
      certificateValidFrom: emitter.certificateValidFrom,
      certificateValidUntil: emitter.certificateValidUntil,
      status: emitter.status,
      settingsJson: serializeJson(emitter.settings)
    });
  }

  #upsertDocument(document: SaveFiscalDocumentDraftInput["document"]): void {
    this.#db.prepare(
      `
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
          emission_mode,
          contingency_required,
          contingency_started_at,
          contingency_justification,
          contingency_printed_at,
          contingency_danfe_path,
          payload_json,
          response_json,
          xml_storage_path,
          last_error_code,
          last_error_message,
          issued_at,
          authorized_at,
          last_status_checked_at
        )
        VALUES (
          :fiscalDocId,
          :emitterId,
          :terminalId,
          :referenceType,
          :referenceId,
          :provider,
          :environment,
          :stateCode,
          :documentModel,
          :serie,
          :numero,
          :accessKey,
          :nsReferenceId,
          :status,
          :emissionMode,
          :contingencyRequired,
          :contingencyStartedAt,
          :contingencyJustification,
          :contingencyPrintedAt,
          :contingencyDanfePath,
          :payloadJson,
          :responseJson,
          :xmlStoragePath,
          :lastErrorCode,
          :lastErrorMessage,
          :issuedAt,
          :authorizedAt,
          :lastStatusCheckedAt
        )
        ON CONFLICT(fiscal_doc_id) DO UPDATE SET
          emitter_id = excluded.emitter_id,
          terminal_id = excluded.terminal_id,
          reference_type = excluded.reference_type,
          reference_id = excluded.reference_id,
          provider = excluded.provider,
          environment = excluded.environment,
          state_code = excluded.state_code,
          document_model = excluded.document_model,
          serie = excluded.serie,
          numero = excluded.numero,
          access_key = excluded.access_key,
          ns_reference_id = excluded.ns_reference_id,
          status = excluded.status,
          emission_mode = excluded.emission_mode,
          contingency_required = excluded.contingency_required,
          contingency_started_at = excluded.contingency_started_at,
          contingency_justification = excluded.contingency_justification,
          contingency_printed_at = excluded.contingency_printed_at,
          contingency_danfe_path = excluded.contingency_danfe_path,
          payload_json = excluded.payload_json,
          response_json = excluded.response_json,
          xml_storage_path = excluded.xml_storage_path,
          last_error_code = excluded.last_error_code,
          last_error_message = excluded.last_error_message,
          issued_at = excluded.issued_at,
          authorized_at = excluded.authorized_at,
          last_status_checked_at = excluded.last_status_checked_at,
          updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
      `
    ).run({
      fiscalDocId: document.fiscalDocId,
      emitterId: document.emitterId,
      terminalId: document.terminalId,
      referenceType: document.referenceType,
      referenceId: document.referenceId,
      provider: document.provider,
      environment: document.environment,
      stateCode: document.stateCode,
      documentModel: document.documentModel,
      serie: document.serie,
      numero: document.numero,
      accessKey: document.accessKey,
      nsReferenceId: document.nsReferenceId,
      status: document.status,
      emissionMode: document.emissionMode,
      contingencyRequired: document.contingencyRequired ? 1 : 0,
      contingencyStartedAt: document.contingencyStartedAt,
      contingencyJustification: document.contingencyJustification,
      contingencyPrintedAt: document.contingencyPrintedAt,
      contingencyDanfePath: document.contingencyDanfePath,
      payloadJson: serializeJson(document.payload),
      responseJson: serializeJson(document.response),
      xmlStoragePath: document.xmlStoragePath,
      lastErrorCode: document.lastErrorCode,
      lastErrorMessage: document.lastErrorMessage,
      issuedAt: document.issuedAt,
      authorizedAt: document.authorizedAt,
      lastStatusCheckedAt: document.lastStatusCheckedAt
    });
  }

  #upsertQueue(queue: SaveFiscalDocumentDraftInput["queue"]): void {
    this.#db.prepare(
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
          attempts,
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
          0,
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
    ).run({
      fiscalQueueId: queue.fiscalQueueId,
      fiscalDocId: queue.fiscalDocId,
      emitterId: queue.emitterId,
      terminalId: queue.terminalId,
      provider: queue.provider,
      environment: queue.environment,
      stateCode: queue.stateCode,
      documentModel: queue.documentModel,
      documentType: queue.documentType,
      referenceType: queue.referenceType,
      referenceId: queue.referenceId,
      serie: queue.serie,
      numero: queue.numero,
      accessKey: queue.accessKey,
      status: queue.status,
      emissionMode: queue.emissionMode,
      dedupKey: queue.dedupKey,
      payloadJson: serializeJson(queue.payload),
      contextJson: serializeJson(queue.context),
      contingencyRequired: queue.contingencyRequired ? 1 : 0,
      contingencyStartedAt: queue.contingencyStartedAt,
      providerReferenceId: queue.providerReferenceId,
      leaseExpiresAt: queue.leaseExpiresAt,
      nextRetryAt: queue.nextRetryAt,
      issuedAt: queue.issuedAt,
      authorizedAt: queue.authorizedAt,
      lastStatusCheckedAt: queue.lastStatusCheckedAt
    });
  }

  #insertEvent(event: SaveFiscalDocumentDraftInput["initialEvent"]): void {
    this.#db.prepare(
      `
        INSERT INTO fiscal_document_events (
          fiscal_event_id,
          fiscal_doc_id,
          emitter_id,
          event_type,
          status,
          provider,
          provider_reference_id,
          occurred_at,
          payload_json
        )
        VALUES (
          :fiscalEventId,
          :fiscalDocId,
          :emitterId,
          :eventType,
          :status,
          :provider,
          :providerReferenceId,
          :occurredAt,
          :payloadJson
        )
        ON CONFLICT(fiscal_event_id) DO NOTHING
      `
    ).run({
      fiscalEventId: event.fiscalEventId,
      fiscalDocId: event.fiscalDocId,
      emitterId: event.emitterId,
      eventType: event.eventType,
      status: event.status,
      provider: event.provider,
      providerReferenceId: event.providerReferenceId,
      occurredAt: event.occurredAt,
      payloadJson: serializeJson(event.payload)
    });
  }

  #appendAuditEvent(event: AuditEventInput): void {
    this.#db.prepare(
      `
        INSERT INTO audit_events (
          event_id,
          entity,
          entity_id,
          action,
          actor_user_id,
          actor_terminal_id,
          actor_role,
          occurred_at,
          payload_json
        )
        VALUES (
          :eventId,
          :entity,
          :entityId,
          :action,
          :actorUserId,
          :actorTerminalId,
          :actorRole,
          :occurredAt,
          :payloadJson
        )
        ON CONFLICT(event_id) DO NOTHING
      `
    ).run({
      eventId: event.eventId,
      entity: event.entity,
      entityId: event.entityId,
      action: event.action,
      actorUserId: event.actorUserId ?? null,
      actorTerminalId: event.actorTerminalId ?? null,
      actorRole: event.actorRole ?? null,
      occurredAt: event.occurredAt,
      payloadJson: serializeJson(event.payload)
    });
  }

  #findDocumentRow(fiscalDocId: string): FiscalDocumentRow | undefined {
    return this.#db.prepare(
      `
        SELECT
          fiscal_doc_id AS fiscalDocId,
          emitter_id AS emitterId,
          terminal_id AS terminalId,
          reference_type AS referenceType,
          reference_id AS referenceId,
          provider,
          environment,
          state_code AS stateCode,
          document_model AS documentModel,
          serie,
          numero,
          access_key AS accessKey,
          ns_reference_id AS nsReferenceId,
          status,
          emission_mode AS emissionMode,
          contingency_required AS contingencyRequired,
          contingency_started_at AS contingencyStartedAt,
          contingency_justification AS contingencyJustification,
          contingency_printed_at AS contingencyPrintedAt,
          contingency_danfe_path AS contingencyDanfePath,
          payload_json AS payloadJson,
          response_json AS responseJson,
          xml_storage_path AS xmlStoragePath,
          last_error_code AS lastErrorCode,
          last_error_message AS lastErrorMessage,
          issued_at AS issuedAt,
          authorized_at AS authorizedAt,
          last_status_checked_at AS lastStatusCheckedAt,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM fiscal_documents
        WHERE fiscal_doc_id = :fiscalDocId
      `
    ).get({ fiscalDocId }) as FiscalDocumentRow | undefined;
  }

  #mustFindDocumentRow(fiscalDocId: string): FiscalDocumentRow {
    const row = this.#findDocumentRow(fiscalDocId);

    if (!row) {
      throw new Error(`Documento fiscal nao encontrado: ${fiscalDocId}`);
    }

    return row;
  }

  #findQueueByDocumentId(fiscalDocId: string): FiscalQueueRecord | null {
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
        WHERE fiscal_doc_id = :fiscalDocId
        ORDER BY created_at DESC, fiscal_queue_id DESC
        LIMIT 1
      `
    ).get({ fiscalDocId }) as FiscalQueueRow | undefined;

    return row ? mapFiscalQueue(row) : null;
  }

  #mustFindQueueRow(fiscalQueueId: string): FiscalQueueRow {
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
      throw new Error(`Job fiscal nao encontrado: ${fiscalQueueId}`);
    }

    return row;
  }
}

function executeTransaction(db: DatabaseSync, callback: () => void): void {
  db.exec("BEGIN IMMEDIATE");

  try {
    callback();
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function resolveValue<TRecord extends object, TKey extends keyof TRecord>(
  record: TRecord,
  key: TKey,
  fallback: TRecord[TKey]
): TRecord[TKey] {
  return Object.prototype.hasOwnProperty.call(record, key) && record[key] !== undefined ? record[key] : fallback;
}

function resolveNullable<TRecord extends object, TKey extends keyof TRecord>(
  record: TRecord,
  key: TKey,
  fallback: string | null
): string | null {
  return Object.prototype.hasOwnProperty.call(record, key) && record[key] !== undefined
    ? (record[key] as string | null)
    : fallback;
}

function resolveBooleanFlag<TRecord extends object, TKey extends keyof TRecord>(
  record: TRecord,
  key: TKey,
  fallback: boolean
): number {
  return Object.prototype.hasOwnProperty.call(record, key) && record[key] !== undefined
    ? ((record[key] as boolean) ? 1 : 0)
    : fallback
      ? 1
      : 0;
}

function mapFiscalEmitter(row: FiscalEmitterRow): FiscalEmitterRecord {
  return {
    emitterId: row.emitterId,
    provider: row.provider,
    environment: row.environment,
    stateCode: row.stateCode,
    documentModel: row.documentModel,
    certificateKind: row.certificateKind,
    legalName: row.legalName,
    tradeName: row.tradeName,
    cnpj: row.cnpj,
    stateRegistration: row.stateRegistration,
    cscId: row.cscId,
    certificateSubject: row.certificateSubject,
    certificateValidFrom: row.certificateValidFrom,
    certificateValidUntil: row.certificateValidUntil,
    status: row.status,
    settings: parseJson(row.settingsJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapFiscalDocument(row: FiscalDocumentRow): FiscalDocumentRecord {
  return {
    fiscalDocId: row.fiscalDocId,
    emitterId: row.emitterId,
    terminalId: row.terminalId,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    provider: row.provider,
    environment: row.environment,
    stateCode: row.stateCode,
    documentModel: row.documentModel,
    serie: row.serie,
    numero: row.numero,
    accessKey: row.accessKey,
    nsReferenceId: row.nsReferenceId,
    status: row.status,
    emissionMode: row.emissionMode,
    contingencyRequired: row.contingencyRequired === 1,
    contingencyStartedAt: row.contingencyStartedAt,
    contingencyJustification: row.contingencyJustification,
    contingencyPrintedAt: row.contingencyPrintedAt,
    contingencyDanfePath: row.contingencyDanfePath,
    payload: parseJson(row.payloadJson),
    response: parseJson(row.responseJson),
    xmlStoragePath: row.xmlStoragePath,
    lastErrorCode: row.lastErrorCode,
    lastErrorMessage: row.lastErrorMessage,
    issuedAt: row.issuedAt,
    authorizedAt: row.authorizedAt,
    lastStatusCheckedAt: row.lastStatusCheckedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
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

function mapFiscalEvent(row: FiscalEventRow): FiscalDocumentEventRecord {
  return {
    fiscalEventId: row.fiscalEventId,
    fiscalDocId: row.fiscalDocId,
    emitterId: row.emitterId,
    eventType: row.eventType,
    status: row.status,
    provider: row.provider,
    providerReferenceId: row.providerReferenceId,
    occurredAt: row.occurredAt,
    payload: parseJson(row.payloadJson),
    createdAt: row.createdAt
  };
}
