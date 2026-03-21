import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { JsonValue, RayzenDatabaseClient } from "@rayzen/db";

import type {
  ConfigureFiscalEmitterRequest,
  FiscalDocumentSnapshot,
  FiscalEmitterSnapshot,
  FiscalQueueJobSnapshot,
  FiscalStatusSnapshot,
  PrintRequestActor,
  ProcessFiscalQueueRequest,
  ProcessFiscalQueueResult,
  QueryFiscalStatusByAccessKeyRequest,
  QueueFiscalNfceRequest
} from "../../contracts/ipc.js";
import type { MainProcessLogStore } from "../log-store.js";
import type { MainProcessPaths } from "../paths.js";
import {
  type DriverPrintFailure,
  type ThermalPrinterDriver,
  WindowsThermalPrinterDriver
} from "../printing/windows-driver.js";
import {
  NsTecnologiaFiscalProvider,
  type NsFiscalProviderIssueResult,
  type NsFiscalProviderLike,
  type NsFiscalProviderQueryStatusResult
} from "./ns-provider.js";
import { FiscalSecretStore, type SafeStorageLike } from "./secret-store.js";

export interface FiscalServiceOptions {
  provider?: NsFiscalProviderLike;
  safeStorage: SafeStorageLike;
  printerDriver?: ThermalPrinterDriver;
  pollIntervalMs?: number;
}

export class FiscalService {
  readonly #database: RayzenDatabaseClient;
  readonly #logger: MainProcessLogStore;
  readonly #paths: MainProcessPaths;
  readonly #secretStore: FiscalSecretStore;
  readonly #provider: NsFiscalProviderLike;
  readonly #printerDriver: ThermalPrinterDriver;
  readonly #pollIntervalMs: number;
  #intervalHandle: ReturnType<typeof setInterval> | null = null;

  constructor(
    database: RayzenDatabaseClient,
    logger: MainProcessLogStore,
    paths: MainProcessPaths,
    options: FiscalServiceOptions
  ) {
    this.#database = database;
    this.#logger = logger;
    this.#paths = paths;
    this.#secretStore = new FiscalSecretStore(paths, options.safeStorage);
    this.#provider = options.provider ?? new NsTecnologiaFiscalProvider();
    this.#printerDriver = options.printerDriver ?? new WindowsThermalPrinterDriver();
    this.#pollIntervalMs = options.pollIntervalMs ?? 15_000;
  }

  getStatusSnapshot(): FiscalStatusSnapshot {
    return {
      emitters: this.#database.fiscal.listEmitters().map((emitter) => ({
        emitterId: emitter.emitterId,
        provider: emitter.provider,
        environment: emitter.environment,
        stateCode: emitter.stateCode,
        documentModel: emitter.documentModel,
        legalName: emitter.legalName,
        cnpj: emitter.cnpj,
        stateRegistration: emitter.stateRegistration,
        cscId: emitter.cscId,
        certificateSubject: emitter.certificateSubject,
        certificateValidFrom: emitter.certificateValidFrom,
        certificateValidUntil: emitter.certificateValidUntil,
        status: emitter.status,
        hasSecrets: this.#secretStore.hasSecrets(emitter.emitterId),
        updatedAt: emitter.updatedAt
      })),
      pendingQueue: this.#database.fiscalQueue.listPending(20).map(mapQueueSnapshot),
      recentDocuments: this.#database.fiscal.listDocuments(20).map(mapDocumentSnapshot)
    };
  }

  start(): void {
    if (this.#intervalHandle) {
      return;
    }

    this.#intervalHandle = setInterval(() => {
      void this.processQueue({
        limit: 5
      }).catch((error: unknown) => {
        this.#logger.warn("electron.fiscal.worker-failed", {
          message: error instanceof Error ? error.message : "Falha desconhecida no worker fiscal."
        });
      });
    }, this.#pollIntervalMs);
  }

  stop(): void {
    if (!this.#intervalHandle) {
      return;
    }

    clearInterval(this.#intervalHandle);
    this.#intervalHandle = null;
  }

  getDocumentStatus(fiscalDocId: string): FiscalDocumentSnapshot | null {
    const document = this.#database.fiscal.findDocumentById(fiscalDocId);
    return document ? mapDocumentSnapshot(document) : null;
  }

  listPending(limit = 20): FiscalQueueJobSnapshot[] {
    return this.#database.fiscalQueue.listPending(limit).map(mapQueueSnapshot);
  }

  async reprocess(request: ProcessFiscalQueueRequest | undefined): Promise<ProcessFiscalQueueResult> {
    const nextRequest: ProcessFiscalQueueRequest = {
      asOf: request?.asOf ?? new Date().toISOString()
    };

    if (typeof request?.limit === "number") {
      nextRequest.limit = request.limit;
    }

    return this.processQueue(nextRequest);
  }

  queueCheckoutNfce(input: {
    terminalId: string;
    comandaId: string;
    comandaNumero: string;
    totalAmountCents: number;
    paymentMethod: string;
    actor: PrintRequestActor;
    occurredAt: string;
    items: Array<{
      itemId: string;
      produtoId: string;
      productLabel: string;
      setor: string;
      quantity: number;
      unitPriceCents: number;
      note: string | null;
    }>;
  }): FiscalDocumentSnapshot | null {
    const existing = this.#database.fiscal.findLatestDocumentByReference("COMANDA", input.comandaId);

    if (existing) {
      return mapDocumentSnapshot(existing);
    }

    const emitter = this.#findPreferredEmitter();

    if (!emitter) {
      this.#database.auditEvents.append({
        eventId: `evt_${input.comandaId}_fiscal_not_queued_${sanitizeId(input.occurredAt)}`,
        entity: "COMANDA",
        entityId: input.comandaId,
        action: "FISCAL_DOCUMENTO_NAO_ENFILEIRADO",
        actorUserId: input.actor.userId,
        actorTerminalId: input.actor.terminalId,
        actorRole: input.actor.role,
        occurredAt: input.occurredAt,
        payload: {
          reasonCode: "FISCAL_EMITTER_NOT_CONFIGURED"
        }
      });
      this.#logger.warn("electron.fiscal.checkout-skipped", {
        comandaId: input.comandaId,
        reasonCode: "FISCAL_EMITTER_NOT_CONFIGURED"
      });
      return null;
    }

    const serie = "1";
    const numero = this.#database.fiscal.getNextDocumentNumber(emitter.emitterId, serie);
    const fiscalDocId = `nfce_${input.comandaId}`;
    const fiscalQueueId = `fq_${fiscalDocId}_${randomUUID().slice(0, 8)}`;

    return this.queueNfce({
      fiscalDocId,
      fiscalQueueId,
      emitterId: emitter.emitterId,
      terminalId: input.terminalId,
      referenceType: "COMANDA",
      referenceId: input.comandaId,
      serie,
      numero,
      dedupKey: `${emitter.emitterId}:${serie}:${numero}`,
      payload: {
        comandaId: input.comandaId,
        comandaNumero: input.comandaNumero,
        totalAmountCents: input.totalAmountCents,
        paymentMethod: input.paymentMethod,
        items: input.items.map((item) => ({
          itemId: item.itemId,
          produtoId: item.produtoId,
          productLabel: item.productLabel,
          setor: item.setor,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          note: item.note
        }))
      },
      actor: input.actor,
      occurredAt: input.occurredAt
    });
  }

  configureEmitter(request: ConfigureFiscalEmitterRequest): FiscalEmitterSnapshot {
    if (!this.#secretStore.isAvailable()) {
      throw new Error("DPAPI local indisponivel para configurar segredos fiscais.");
    }

    this.#secretStore.store(
      request.emitterId,
      {
        provider: request.provider,
        environment: request.environment,
        updatedAt: request.occurredAt
      },
      {
        certificateBase64: request.certificateBase64,
        certificatePassword: request.certificatePassword,
        csc: request.csc
      }
    );

    const emitter = this.#database.fiscal.upsertEmitter({
      emitter: {
        emitterId: request.emitterId,
        provider: request.provider,
        environment: request.environment,
        stateCode: request.stateCode,
        documentModel: request.documentModel,
        certificateKind: "E_CNPJ_A1",
        legalName: request.legalName,
        tradeName: request.tradeName ?? null,
        cnpj: request.cnpj,
        stateRegistration: request.stateRegistration,
        cscId: request.cscId,
        certificateSubject: request.certificateSubject ?? null,
        certificateValidFrom: request.certificateValidFrom ?? null,
        certificateValidUntil: request.certificateValidUntil ?? null,
        status: "HABILITADO",
        settings: toJsonValue(request.settings ?? {})
      },
      auditEvents: [
        {
          eventId: `evt_fiscal_emitter_${request.emitterId}_${request.occurredAt}`,
          entity: "FISCAL_EMITTER",
          entityId: request.emitterId,
          action: "FISCAL_EMITENTE_CONFIGURADO",
          actorUserId: request.actor.userId,
          actorTerminalId: request.actor.terminalId,
          actorRole: request.actor.role,
          occurredAt: request.occurredAt,
          payload: {
            provider: request.provider,
            environment: request.environment,
            stateCode: request.stateCode,
            documentModel: request.documentModel
          }
        }
      ]
    });

    this.#logger.info("electron.fiscal.emitter-configured", {
      emitterId: emitter.emitterId,
      provider: emitter.provider,
      environment: emitter.environment
    });

    return mapEmitterSnapshot(emitter, true);
  }

  queueNfce(request: QueueFiscalNfceRequest): FiscalDocumentSnapshot {
    const emitter = this.#database.fiscal.findEmitterById(request.emitterId);

    if (!emitter || emitter.status !== "HABILITADO") {
      throw new Error("Emitente fiscal nao habilitado para enfileirar NFC-e.");
    }

    if (!this.#secretStore.hasSecrets(request.emitterId)) {
      throw new Error("Segredos fiscais ausentes para o emitente selecionado.");
    }

    const trail = this.#database.fiscal.saveDraft({
      document: {
        fiscalDocId: request.fiscalDocId,
        emitterId: emitter.emitterId,
        terminalId: request.terminalId,
        referenceType: request.referenceType,
        referenceId: request.referenceId,
        provider: emitter.provider,
        environment: emitter.environment,
        stateCode: emitter.stateCode,
        documentModel: emitter.documentModel,
        serie: request.serie,
        numero: request.numero,
        accessKey: null,
        nsReferenceId: null,
        status: "DRAFT",
        emissionMode: "NORMAL",
        contingencyRequired: false,
        contingencyStartedAt: null,
        contingencyJustification: null,
        contingencyPrintedAt: null,
        contingencyDanfePath: null,
        payload: toJsonValue(request.payload),
        response: {},
        xmlStoragePath: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        issuedAt: null,
        authorizedAt: null,
        lastStatusCheckedAt: null
      },
      queue: {
        fiscalQueueId: request.fiscalQueueId,
        fiscalDocId: request.fiscalDocId,
        emitterId: emitter.emitterId,
        terminalId: request.terminalId,
        provider: emitter.provider,
        environment: emitter.environment,
        stateCode: emitter.stateCode,
        documentModel: emitter.documentModel,
        documentType: "NFCE_65",
        referenceType: request.referenceType,
        referenceId: request.referenceId,
        serie: request.serie,
        numero: request.numero,
        accessKey: null,
        status: "DRAFT",
        emissionMode: "NORMAL",
        dedupKey: request.dedupKey ?? null,
        payload: toJsonValue(request.payload),
        context: {
          queuedAt: request.occurredAt
        },
        contingencyRequired: false,
        contingencyStartedAt: null,
        providerReferenceId: null,
        leaseExpiresAt: null,
        nextRetryAt: null,
        issuedAt: null,
        authorizedAt: null,
        lastStatusCheckedAt: null
      },
      initialEvent: {
        fiscalEventId: `fevt_${request.fiscalDocId}_draft`,
        fiscalDocId: request.fiscalDocId,
        emitterId: emitter.emitterId,
        eventType: "FISCAL_DOCUMENT_ENQUEUED",
        status: "DRAFT",
        provider: emitter.provider,
        providerReferenceId: null,
        occurredAt: request.occurredAt,
        payload: {
          referenceType: request.referenceType,
          referenceId: request.referenceId,
          serie: request.serie,
          numero: request.numero
        }
      },
      auditEvents: [
        {
          eventId: `evt_${request.fiscalDocId}_draft`,
          entity: "FISCAL_DOCUMENT",
          entityId: request.fiscalDocId,
          action: "FISCAL_DOCUMENTO_ENFILEIRADO",
          actorUserId: request.actor.userId,
          actorTerminalId: request.actor.terminalId,
          actorRole: request.actor.role,
          occurredAt: request.occurredAt,
          payload: {
            emitterId: request.emitterId,
            serie: request.serie,
            numero: request.numero
          }
        }
      ]
    });

    this.#logger.info("electron.fiscal.queued", {
      fiscalDocId: request.fiscalDocId,
      emitterId: request.emitterId,
      terminalId: request.terminalId
    });

    return mapDocumentSnapshot(trail.document);
  }

  async processQueue(request: ProcessFiscalQueueRequest | undefined): Promise<ProcessFiscalQueueResult> {
    const asOf = request?.asOf ?? new Date().toISOString();
    const limit = request?.limit ?? 10;
    const jobs: FiscalQueueJobSnapshot[] = [];
    let authorizedCount = 0;
    let rejectedCount = 0;
    let pendingCount = 0;
    let contingencyCount = 0;

    for (let index = 0; index < limit; index += 1) {
      const claimed = this.#database.fiscalQueue.claimNextReady({
        asOf,
        leaseExpiresAt: new Date(Date.parse(asOf) + 30_000).toISOString()
      });

      if (!claimed) {
        break;
      }

      const trail = this.#database.fiscal.getDocumentTrail(claimed.fiscalDocId);
      const emitter = this.#database.fiscal.findEmitterById(trail.document.emitterId);

      if (!emitter) {
        jobs.push(mapQueueSnapshot(this.#markEmitterMissing(claimed, trail.document.emitterId, asOf)));
        rejectedCount += 1;
        continue;
      }

      let resultKind: "AUTHORIZED" | "REJECTED" | "PENDING" | "CONTINGENCY";
      let queueSnapshot: NonNullable<ReturnType<RayzenDatabaseClient["fiscal"]["getDocumentTrail"]>["queue"]>;

      if (trail.document.status === "CONTINGENCY") {
        const processed = await this.#reprocessContingency(claimed, trail, emitter, asOf);
        resultKind = processed.kind;
        queueSnapshot = processed.queue;
      } else {
        if (trail.document.status === "DRAFT" || trail.document.status === "REJECTED") {
          this.#appendSignedState(claimed, trail.document.fiscalDocId, emitter.emitterId, asOf, index);
        }

        const issueResult = await this.#provider.issueNfce({
          fiscalDocId: trail.document.fiscalDocId,
          emitterId: emitter.emitterId,
          terminalId: trail.document.terminalId,
          provider: emitter.provider,
          environment: emitter.environment,
          stateCode: emitter.stateCode,
          documentModel: emitter.documentModel,
          serie: trail.document.serie,
          numero: trail.document.numero,
          payload: trail.document.payload as Record<string, unknown>,
          secrets: this.#secretStore.read(emitter.emitterId),
          issuedAt: asOf,
          accessKey: trail.document.accessKey,
          emissionMode: trail.document.emissionMode,
          contingencyStartedAt: trail.document.contingencyStartedAt,
          contingencyJustification: trail.document.contingencyJustification
        });
        const processed = this.#handleIssueResult(claimed, trail.document.fiscalDocId, emitter, asOf, issueResult);
        resultKind = processed.kind;
        queueSnapshot = processed.queue;
      }

      jobs.push(mapQueueSnapshot(queueSnapshot));

      switch (resultKind) {
        case "AUTHORIZED":
          authorizedCount += 1;
          break;
        case "REJECTED":
          rejectedCount += 1;
          break;
        case "PENDING":
          pendingCount += 1;
          break;
        case "CONTINGENCY":
          contingencyCount += 1;
          break;
      }
    }

    return {
      processedCount: jobs.length,
      authorizedCount,
      rejectedCount,
      pendingCount,
      contingencyCount,
      jobs
    };
  }

  async queryStatusByAccessKey(request: QueryFiscalStatusByAccessKeyRequest): Promise<FiscalDocumentSnapshot> {
    const asOf = request.asOf ?? new Date().toISOString();
    const document = this.#database.fiscal.findDocumentByAccessKey(request.accessKey);

    if (!document) {
      throw new Error("Documento fiscal nao encontrado para a chave consultada.");
    }

    const emitter = this.#database.fiscal.findEmitterById(document.emitterId);

    if (!emitter) {
      throw new Error("Emitente fiscal ausente para consulta de situacao.");
    }

    const queue = this.#database.fiscal.getDocumentTrail(document.fiscalDocId).queue;

    if (!queue) {
      throw new Error("Fila fiscal ausente para o documento consultado.");
    }

    const result = await this.#provider.queryStatusByAccessKey({
      emitterId: emitter.emitterId,
      accessKey: request.accessKey,
      provider: emitter.provider,
      environment: emitter.environment,
      stateCode: emitter.stateCode,
      documentModel: emitter.documentModel,
      secrets: this.#secretStore.read(emitter.emitterId),
      asOf
    });

    const processed = this.#handleStatusQueryResult(queue, document, emitter, result, asOf, request);
    return mapDocumentSnapshot(processed.document);
  }

  #markEmitterMissing(claimed: NonNullable<ReturnType<RayzenDatabaseClient["fiscalQueue"]["claimNextReady"]>>, emitterId: string, occurredAt: string) {
    const trail = this.#database.fiscal.appendState({
      fiscalDocId: claimed.fiscalDocId,
      fiscalQueueId: claimed.fiscalQueueId,
      status: "REJECTED",
      event: {
        fiscalEventId: `fevt_${claimed.fiscalDocId}_missing_emitter`,
        emitterId,
        eventType: "FISCAL_EMITTER_NOT_FOUND",
        status: "REJECTED",
        provider: claimed.provider,
        providerReferenceId: null,
        occurredAt,
        payload: {}
      },
      lastErrorCode: "EMITTER_NOT_FOUND",
      lastErrorMessage: "Emitente fiscal ausente para processamento.",
      leaseExpiresAt: null
    });

    return trail.queue!;
  }

  #appendSignedState(
    claimed: NonNullable<ReturnType<RayzenDatabaseClient["fiscalQueue"]["claimNextReady"]>>,
    fiscalDocId: string,
    emitterId: string,
    occurredAt: string,
    index: number
  ): void {
    this.#database.fiscal.appendState({
      fiscalDocId,
      fiscalQueueId: claimed.fiscalQueueId,
      status: "SIGNED",
      event: {
        fiscalEventId: `fevt_${fiscalDocId}_signed_${index}`,
        emitterId,
        eventType: "FISCAL_DOCUMENT_SIGNED",
        status: "SIGNED",
        provider: claimed.provider,
        providerReferenceId: null,
        occurredAt,
        payload: {
          documentModel: claimed.documentModel
        }
      },
      issuedAt: occurredAt,
      leaseExpiresAt: claimed.leaseExpiresAt
    });
  }

  async #reprocessContingency(
    claimed: NonNullable<ReturnType<RayzenDatabaseClient["fiscalQueue"]["claimNextReady"]>>,
    trail: ReturnType<RayzenDatabaseClient["fiscal"]["getDocumentTrail"]>,
    emitter: NonNullable<ReturnType<RayzenDatabaseClient["fiscal"]["findEmitterById"]>>,
    asOf: string
  ): Promise<{ kind: "AUTHORIZED" | "REJECTED" | "PENDING" | "CONTINGENCY"; queue: NonNullable<typeof trail.queue> }> {
    if (trail.document.accessKey) {
      const queryResult = await this.#provider.queryStatusByAccessKey({
        emitterId: emitter.emitterId,
        accessKey: trail.document.accessKey,
        provider: emitter.provider,
        environment: emitter.environment,
        stateCode: emitter.stateCode,
        documentModel: emitter.documentModel,
        secrets: this.#secretStore.read(emitter.emitterId),
        asOf
      });

      switch (queryResult.kind) {
        case "AUTHORIZED":
          return {
            kind: "AUTHORIZED",
            queue: this.#applyAuthorizedState(claimed, trail.document.fiscalDocId, emitter.emitterId, asOf, queryResult).queue!
          };
        case "REJECTED":
          return {
            kind: "REJECTED",
            queue: this.#applyRejectedState(claimed, trail.document.fiscalDocId, emitter.emitterId, asOf, queryResult).queue!
          };
        case "PENDING":
          return {
            kind: "PENDING",
            queue: this.#applyPendingState(claimed, trail.document.fiscalDocId, emitter.emitterId, asOf, {
              kind: "PENDING",
              nsReferenceId: trail.document.nsReferenceId ?? `nsref_${trail.document.fiscalDocId}`,
              nextRetryAt: queryResult.nextRetryAt,
              message: queryResult.message
            }).queue!
          };
        case "NOT_FOUND":
          break;
      }
    }

    const resendResult = await this.#provider.issueNfce({
      fiscalDocId: trail.document.fiscalDocId,
      emitterId: emitter.emitterId,
      terminalId: trail.document.terminalId,
      provider: emitter.provider,
      environment: emitter.environment,
      stateCode: emitter.stateCode,
      documentModel: emitter.documentModel,
      serie: trail.document.serie,
      numero: trail.document.numero,
      payload: trail.document.payload as Record<string, unknown>,
      secrets: this.#secretStore.read(emitter.emitterId),
      issuedAt: asOf,
      accessKey: trail.document.accessKey,
      emissionMode: "CONTINGENCY_OFFLINE",
      contingencyStartedAt: trail.document.contingencyStartedAt,
      contingencyJustification: trail.document.contingencyJustification
    });

    return this.#handleIssueResult(claimed, trail.document.fiscalDocId, emitter, asOf, resendResult);
  }

  #handleIssueResult(
    claimed: NonNullable<ReturnType<RayzenDatabaseClient["fiscalQueue"]["claimNextReady"]>>,
    fiscalDocId: string,
    emitter: NonNullable<ReturnType<RayzenDatabaseClient["fiscal"]["findEmitterById"]>>,
    occurredAt: string,
    result: NsFiscalProviderIssueResult
  ): {
    kind: "AUTHORIZED" | "REJECTED" | "PENDING" | "CONTINGENCY";
    queue: NonNullable<ReturnType<RayzenDatabaseClient["fiscal"]["getDocumentTrail"]>["queue"]>;
  } {
    switch (result.kind) {
      case "AUTHORIZED":
        return {
          kind: "AUTHORIZED",
          queue: this.#applyAuthorizedState(claimed, fiscalDocId, emitter.emitterId, occurredAt, result).queue!
        };
      case "REJECTED":
        return {
          kind: "REJECTED",
          queue: this.#applyRejectedState(claimed, fiscalDocId, emitter.emitterId, occurredAt, result).queue!
        };
      case "PENDING":
        return {
          kind: "PENDING",
          queue: this.#applyPendingState(claimed, fiscalDocId, emitter.emitterId, occurredAt, result).queue!
        };
      case "CONTINGENCY_REQUIRED":
        return {
          kind: "CONTINGENCY",
          queue: this.#enterContingency(claimed, fiscalDocId, emitter, occurredAt, result).queue!
        };
    }
  }

  #applyAuthorizedState(
    claimed: NonNullable<ReturnType<RayzenDatabaseClient["fiscalQueue"]["claimNextReady"]>>,
    fiscalDocId: string,
    emitterId: string,
    occurredAt: string,
    result: Extract<NsFiscalProviderIssueResult | NsFiscalProviderQueryStatusResult, { kind: "AUTHORIZED" }>
  ) {
    const xmlStoragePath = this.#storeAuthorizedXml(emitterId, result.accessKey, result.xmlContent);
    const trail = this.#database.fiscal.appendState({
      fiscalDocId,
      fiscalQueueId: claimed.fiscalQueueId,
      status: "AUTHORIZED",
      event: {
        fiscalEventId: `fevt_${fiscalDocId}_authorized_${sanitizeId(occurredAt)}`,
        emitterId,
        eventType: "FISCAL_DOCUMENT_AUTHORIZED",
        status: "AUTHORIZED",
        provider: "NS_TECNOLOGIA",
        providerReferenceId: result.nsReferenceId,
        occurredAt,
        payload: {
          accessKey: result.accessKey,
          protocolNumber: result.protocolNumber
        }
      },
      providerReferenceId: result.nsReferenceId,
      accessKey: result.accessKey,
      response: {
        protocolNumber: result.protocolNumber
      },
      xmlStoragePath,
      issuedAt: occurredAt,
      authorizedAt: result.authorizedAt,
      lastErrorCode: null,
      lastErrorMessage: null,
      nextRetryAt: null,
      leaseExpiresAt: null,
      lastStatusCheckedAt: occurredAt
    });

    this.#logger.info("electron.fiscal.authorized", {
      fiscalDocId,
      emitterId,
      accessKey: result.accessKey
    });

    return trail;
  }

  #applyRejectedState(
    claimed: NonNullable<ReturnType<RayzenDatabaseClient["fiscalQueue"]["claimNextReady"]>>,
    fiscalDocId: string,
    emitterId: string,
    occurredAt: string,
    result: Extract<NsFiscalProviderIssueResult | NsFiscalProviderQueryStatusResult, { kind: "REJECTED" }>
  ) {
    const trail = this.#database.fiscal.appendState({
      fiscalDocId,
      fiscalQueueId: claimed.fiscalQueueId,
      status: "REJECTED",
      event: {
        fiscalEventId: `fevt_${fiscalDocId}_rejected_${sanitizeId(occurredAt)}`,
        emitterId,
        eventType: "FISCAL_DOCUMENT_REJECTED",
        status: "REJECTED",
        provider: "NS_TECNOLOGIA",
        providerReferenceId: null,
        occurredAt,
        payload: {
          code: result.code,
          retryable: result.retryable
        }
      },
      lastErrorCode: result.code,
      lastErrorMessage: result.message,
      nextRetryAt: result.retryable ? result.nextRetryAt ?? occurredAt : null,
      leaseExpiresAt: null,
      lastStatusCheckedAt: occurredAt
    });

    this.#logger.warn("electron.fiscal.rejected", {
      fiscalDocId,
      emitterId,
      code: result.code
    });

    return trail;
  }

  #applyPendingState(
    claimed: NonNullable<ReturnType<RayzenDatabaseClient["fiscalQueue"]["claimNextReady"]>>,
    fiscalDocId: string,
    emitterId: string,
    occurredAt: string,
    result: Extract<NsFiscalProviderIssueResult, { kind: "PENDING" }>
  ) {
    const trail = this.#database.fiscal.appendState({
      fiscalDocId,
      fiscalQueueId: claimed.fiscalQueueId,
      status: "SENT",
      event: {
        fiscalEventId: `fevt_${fiscalDocId}_sent_${sanitizeId(occurredAt)}`,
        emitterId,
        eventType: "FISCAL_DOCUMENT_SENT",
        status: "SENT",
        provider: "NS_TECNOLOGIA",
        providerReferenceId: result.nsReferenceId,
        occurredAt,
        payload: {
          message: result.message
        }
      },
      providerReferenceId: result.nsReferenceId,
      nextRetryAt: result.nextRetryAt,
      issuedAt: occurredAt,
      leaseExpiresAt: null,
      lastStatusCheckedAt: occurredAt
    });

    this.#logger.info("electron.fiscal.sent", {
      fiscalDocId,
      emitterId,
      nextRetryAt: result.nextRetryAt
    });

    return trail;
  }

  #enterContingency(
    claimed: NonNullable<ReturnType<RayzenDatabaseClient["fiscalQueue"]["claimNextReady"]>>,
    fiscalDocId: string,
    emitter: NonNullable<ReturnType<RayzenDatabaseClient["fiscal"]["findEmitterById"]>>,
    occurredAt: string,
    result: Extract<NsFiscalProviderIssueResult, { kind: "CONTINGENCY_REQUIRED" }>
  ) {
    const existingDocument = this.#database.fiscal.findDocumentById(fiscalDocId);

    if (!existingDocument) {
      throw new Error(`Documento fiscal nao encontrado para contingencia: ${fiscalDocId}`);
    }

    const danfePath = this.#storeContingencyDanfe({
      emitterId: emitter.emitterId,
      accessKey: result.accessKey,
      content: renderContingencyDanfe({
        emitterLegalName: emitter.legalName,
        fiscalDocId,
        referenceId: existingDocument.referenceId,
        serie: existingDocument.serie,
        numero: existingDocument.numero,
        accessKey: result.accessKey,
        dhCont: result.contingencyStartedAt,
        xJust: result.contingencyJustification
      })
    });
    const printResult = this.#printContingencyDanfe(emitter, danfePath);
    const printedAt = printResult.ok ? occurredAt : null;
    const auditEvents: Array<{
      eventId: string;
      entity: "FISCAL_DOCUMENT";
      entityId: string;
      action: string;
      actorUserId: string | null;
      actorTerminalId: string | null;
      actorRole: string | null;
      occurredAt: string;
      payload: Record<string, string | number>;
    }> = [
      {
        eventId: `evt_${fiscalDocId}_contingency_enabled_${sanitizeId(occurredAt)}`,
        entity: "FISCAL_DOCUMENT",
        entityId: fiscalDocId,
        action: "FISCAL_CONTINGENCIA_ATIVADA",
        actorUserId: null,
        actorTerminalId: existingDocument.terminalId,
        actorRole: null,
        occurredAt,
        payload: {
          accessKey: result.accessKey,
          tpEmis: 9,
          dhCont: result.contingencyStartedAt,
          xJust: result.contingencyJustification
        }
      }
    ];

    if (!printResult.ok) {
      auditEvents.push({
        eventId: `evt_${fiscalDocId}_contingency_print_failed_${sanitizeId(occurredAt)}`,
        entity: "FISCAL_DOCUMENT",
        entityId: fiscalDocId,
        action: "FISCAL_DANFE_CONTINGENCIA_FALHA_IMPRESSAO",
        actorUserId: null,
        actorTerminalId: existingDocument.terminalId,
        actorRole: null,
        occurredAt,
        payload: {
          code: printResult.code
        }
      });
    }

    const trail = this.#database.fiscal.appendState({
      fiscalDocId,
      fiscalQueueId: claimed.fiscalQueueId,
      status: "CONTINGENCY",
      event: {
        fiscalEventId: `fevt_${fiscalDocId}_contingency_${sanitizeId(occurredAt)}`,
        emitterId: emitter.emitterId,
        eventType: "FISCAL_DOCUMENT_CONTINGENCY_ENABLED",
        status: "CONTINGENCY",
        provider: emitter.provider,
        providerReferenceId: null,
        occurredAt,
        payload: {
          accessKey: result.accessKey,
          tpEmis: 9,
          dhCont: result.contingencyStartedAt,
          xJust: result.contingencyJustification,
          danfePath
        }
      },
      accessKey: result.accessKey,
      emissionMode: "CONTINGENCY_OFFLINE",
      contingencyRequired: true,
      contingencyStartedAt: result.contingencyStartedAt,
      contingencyJustification: result.contingencyJustification,
      contingencyPrintedAt: printedAt,
      contingencyDanfePath: danfePath,
      lastErrorCode: result.code,
      lastErrorMessage: result.message,
      nextRetryAt: result.nextRetryAt,
      issuedAt: occurredAt,
      leaseExpiresAt: null,
      auditEvents
    });

    if (!printResult.ok) {
      this.#logger.warn("electron.fiscal.contingency-print-failed", {
        fiscalDocId,
        emitterId: emitter.emitterId,
        code: printResult.code
      });
    }

    this.#logger.warn("electron.fiscal.contingency-enabled", {
      fiscalDocId,
      emitterId: emitter.emitterId,
      accessKey: result.accessKey
    });

    return trail;
  }

  #handleStatusQueryResult(
    queue: NonNullable<ReturnType<RayzenDatabaseClient["fiscal"]["getDocumentTrail"]>["queue"]>,
    document: NonNullable<ReturnType<RayzenDatabaseClient["fiscal"]["findDocumentByAccessKey"]>>,
    emitter: NonNullable<ReturnType<RayzenDatabaseClient["fiscal"]["findEmitterById"]>>,
    result: NsFiscalProviderQueryStatusResult,
    occurredAt: string,
    request: QueryFiscalStatusByAccessKeyRequest
  ) {
    switch (result.kind) {
      case "AUTHORIZED":
        return this.#applyAuthorizedState(queue, document.fiscalDocId, emitter.emitterId, occurredAt, result);
      case "REJECTED":
        return this.#applyRejectedState(queue, document.fiscalDocId, emitter.emitterId, occurredAt, result);
      case "PENDING":
        return this.#database.fiscal.appendState({
          fiscalDocId: document.fiscalDocId,
          fiscalQueueId: queue.fiscalQueueId,
          status: document.status,
          event: {
            fiscalEventId: `fevt_${document.fiscalDocId}_query_pending_${sanitizeId(occurredAt)}`,
            emitterId: emitter.emitterId,
            eventType: "FISCAL_STATUS_QUERY_PENDING",
            status: document.status,
            provider: emitter.provider,
            providerReferenceId: document.nsReferenceId,
            occurredAt,
            payload: {
              accessKey: request.accessKey,
              message: result.message
            }
          },
          lastStatusCheckedAt: occurredAt,
          nextRetryAt: result.nextRetryAt,
          leaseExpiresAt: null
        });
      case "NOT_FOUND":
        return this.#database.fiscal.appendState({
          fiscalDocId: document.fiscalDocId,
          fiscalQueueId: queue.fiscalQueueId,
          status: document.status,
          event: {
            fiscalEventId: `fevt_${document.fiscalDocId}_query_not_found_${sanitizeId(occurredAt)}`,
            emitterId: emitter.emitterId,
            eventType: "FISCAL_STATUS_QUERY_NOT_FOUND",
            status: document.status,
            provider: emitter.provider,
            providerReferenceId: document.nsReferenceId,
            occurredAt,
            payload: {
              accessKey: request.accessKey
            }
          },
          lastStatusCheckedAt: occurredAt,
          nextRetryAt: result.nextRetryAt,
          leaseExpiresAt: null
        });
    }
  }

  #storeAuthorizedXml(emitterId: string, accessKey: string, xmlContent: string): string {
    const emitterDir = path.join(this.#paths.fiscalXmlDir, emitterId);
    fs.mkdirSync(emitterDir, { recursive: true });

    const filePath = path.join(emitterDir, `${accessKey}.xml`);
    fs.writeFileSync(filePath, xmlContent);
    return filePath;
  }

  #storeContingencyDanfe(input: { emitterId: string; accessKey: string; content: string }): string {
    const emitterDir = path.join(this.#paths.fiscalDanfeDir, input.emitterId);
    fs.mkdirSync(emitterDir, { recursive: true });

    const filePath = path.join(emitterDir, `${input.accessKey}-contingencia.txt`);
    fs.writeFileSync(filePath, input.content);
    return filePath;
  }

  #printContingencyDanfe(
    emitter: NonNullable<ReturnType<RayzenDatabaseClient["fiscal"]["findEmitterById"]>>,
    danfePath: string
  ): { ok: true } | DriverPrintFailure {
    const printerName = resolveContingencyPrinterName(emitter.settings);

    if (!printerName) {
      return {
        ok: false,
        code: "PRINTER_NOT_FOUND",
        message: "Impressora de DANFE em contingencia nao configurada para o emitente.",
        retryable: true
      };
    }

    return this.#printerDriver.printText({
      printerName,
      ticketFilePath: danfePath
    });
  }

  #findPreferredEmitter(): NonNullable<ReturnType<RayzenDatabaseClient["fiscal"]["findEmitterById"]>> | null {
    for (const emitter of this.#database.fiscal.listEmitters()) {
      if (emitter.status === "HABILITADO" && this.#secretStore.hasSecrets(emitter.emitterId)) {
        return emitter;
      }
    }

    return null;
  }
}

function mapEmitterSnapshot(
  emitter: NonNullable<ReturnType<RayzenDatabaseClient["fiscal"]["findEmitterById"]>>,
  hasSecrets: boolean
): FiscalEmitterSnapshot {
  return {
    emitterId: emitter.emitterId,
    provider: emitter.provider,
    environment: emitter.environment,
    stateCode: emitter.stateCode,
    documentModel: emitter.documentModel,
    legalName: emitter.legalName,
    cnpj: emitter.cnpj,
    stateRegistration: emitter.stateRegistration,
    cscId: emitter.cscId,
    certificateSubject: emitter.certificateSubject,
    certificateValidFrom: emitter.certificateValidFrom,
    certificateValidUntil: emitter.certificateValidUntil,
    status: emitter.status,
    hasSecrets,
    updatedAt: emitter.updatedAt
  };
}

function mapQueueSnapshot(
  queue: ReturnType<RayzenDatabaseClient["fiscalQueue"]["findById"]> | ReturnType<RayzenDatabaseClient["fiscalQueue"]["listPending"]>[number]
): FiscalQueueJobSnapshot {
  return {
    fiscalQueueId: queue.fiscalQueueId,
    fiscalDocId: queue.fiscalDocId,
    emitterId: queue.emitterId,
    terminalId: queue.terminalId,
    referenceType: queue.referenceType,
    referenceId: queue.referenceId,
    provider: queue.provider,
    environment: queue.environment,
    documentModel: queue.documentModel,
    status: queue.status,
    emissionMode: queue.emissionMode,
    attempts: queue.attempts,
    contingencyRequired: queue.contingencyRequired,
    contingencyStartedAt: queue.contingencyStartedAt,
    leaseExpiresAt: queue.leaseExpiresAt,
    nextRetryAt: queue.nextRetryAt,
    lastErrorCode: queue.lastErrorCode,
    lastErrorMessage: queue.lastErrorMessage,
    issuedAt: queue.issuedAt,
    authorizedAt: queue.authorizedAt,
    lastStatusCheckedAt: queue.lastStatusCheckedAt,
    createdAt: queue.createdAt,
    updatedAt: queue.updatedAt
  };
}

function mapDocumentSnapshot(
  document: NonNullable<ReturnType<RayzenDatabaseClient["fiscal"]["findDocumentById"]>>
): FiscalDocumentSnapshot {
  return {
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
    contingencyRequired: document.contingencyRequired,
    contingencyStartedAt: document.contingencyStartedAt,
    contingencyJustification: document.contingencyJustification,
    contingencyPrintedAt: document.contingencyPrintedAt,
    contingencyDanfePath: document.contingencyDanfePath,
    lastErrorCode: document.lastErrorCode,
    lastErrorMessage: document.lastErrorMessage,
    issuedAt: document.issuedAt,
    authorizedAt: document.authorizedAt,
    lastStatusCheckedAt: document.lastStatusCheckedAt,
    xmlStoragePath: document.xmlStoragePath,
    updatedAt: document.updatedAt
  };
}

function resolveContingencyPrinterName(settings: JsonValue): string | null {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return null;
  }

  const printerName =
    settings["danfePrinterName"] ??
    settings["contingencyPrinterName"] ??
    settings["printerName"];

  return typeof printerName === "string" && printerName.trim().length > 0 ? printerName.trim() : null;
}

function renderContingencyDanfe(input: {
  emitterLegalName: string;
  fiscalDocId: string;
  referenceId: string;
  serie: string;
  numero: number;
  accessKey: string;
  dhCont: string;
  xJust: string;
}): string {
  return [
    "RAYZEN PDV - DANFE NFC-E EM CONTINGENCIA",
    `Emitente: ${input.emitterLegalName}`,
    `Documento: ${input.fiscalDocId}`,
    `Referencia: ${input.referenceId}`,
    `Serie/Numero: ${input.serie}/${input.numero}`,
    `Chave: ${input.accessKey}`,
    "tpEmis: 9",
    `dhCont: ${input.dhCont}`,
    `xJust: ${input.xJust}`,
    "Reenvio posterior pendente."
  ].join("\n");
}

function sanitizeId(value: string): string {
  return value.replace(/[^0-9A-Za-z]/g, "");
}

function toJsonValue(value: Record<string, unknown>): JsonValue {
  return value as JsonValue;
}
