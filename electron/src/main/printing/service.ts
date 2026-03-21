import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { JsonValue, PrintJobRecord } from "@rayzen/db";

import type {
  EnqueueProductionPrintRequest,
  EnqueueProductionPrintResult,
  ListPrintJobsRequest,
  PrintDriverPrinterSnapshot,
  PrintRouteSnapshot,
  PrintSpoolJobSnapshot,
  PrintSpoolStatusSnapshot,
  ProcessPrintQueueRequest,
  ProcessPrintQueueResult,
  ReprocessPrintJobRequest,
  ReprintSecondCopyRequest
} from "../../contracts/ipc.js";
import type { RayzenDatabaseClient } from "@rayzen/db";
import type { MainProcessLogStore } from "../log-store.js";
import type { MainProcessPaths } from "../paths.js";
import {
  DEFAULT_PRINT_ROUTING_CONFIG,
  listSetorRoutes,
  resolvePrinterTargetsForSetor,
  type PrintRoutingConfig
} from "./routing-config.js";
import {
  isTicketPayload,
  renderKitchenTicket,
  type TicketPayload
} from "./ticket-renderer.js";
import {
  WindowsThermalPrinterDriver,
  type DriverPrintFailure,
  type DriverPrinterSnapshot,
  type ThermalPrinterDriver
} from "./windows-driver.js";

const MAX_AUTOMATIC_ATTEMPTS = 3;

export interface PrintSpoolServiceOptions {
  routingConfig?: PrintRoutingConfig;
  driver?: ThermalPrinterDriver;
  autoStart?: boolean;
  pollIntervalMs?: number;
  leaseDurationMs?: number;
}

export class PrintSpoolService {
  readonly #database: RayzenDatabaseClient;
  readonly #logger: MainProcessLogStore;
  readonly #paths: MainProcessPaths;
  readonly #routingConfig: PrintRoutingConfig;
  readonly #driver: ThermalPrinterDriver;
  readonly #pollIntervalMs: number;
  readonly #leaseDurationMs: number;
  #intervalHandle: NodeJS.Timeout | null = null;

  constructor(
    database: RayzenDatabaseClient,
    logger: MainProcessLogStore,
    paths: MainProcessPaths,
    options: PrintSpoolServiceOptions = {}
  ) {
    this.#database = database;
    this.#logger = logger;
    this.#paths = paths;
    this.#routingConfig = options.routingConfig ?? DEFAULT_PRINT_ROUTING_CONFIG;
    this.#driver = options.driver ?? new WindowsThermalPrinterDriver();
    this.#pollIntervalMs = options.pollIntervalMs ?? 15000;
    this.#leaseDurationMs = options.leaseDurationMs ?? 45000;

    if (options.autoStart ?? true) {
      this.start();
    }
  }

  start(): void {
    if (this.#intervalHandle) {
      return;
    }

    this.#intervalHandle = setInterval(() => {
      try {
        this.processPendingJobs();
      } catch (error) {
        this.#logger.error("electron.print.worker-cycle-failed", {
          reason: error instanceof Error ? error.message : "Falha desconhecida."
        });
      }
    }, this.#pollIntervalMs);
    this.#intervalHandle.unref();
  }

  stop(): void {
    if (!this.#intervalHandle) {
      return;
    }

    clearInterval(this.#intervalHandle);
    this.#intervalHandle = null;
  }

  listRoutes(): PrintRouteSnapshot[] {
    return this.#resolveRoutingConfig().setores.map((setor) => ({
      setor: setor.id,
      impressoras: [...setor.impressoras]
    }));
  }

  listPrinters(): PrintDriverPrinterSnapshot[] {
    return this.#driver.listPrinters().map(mapDriverPrinterSnapshot);
  }

  getStatusSnapshot(limit = 25): PrintSpoolStatusSnapshot {
    return {
      routes: this.listRoutes(),
      pendingJobs: this.#database.printSpool.listPending(limit).map(mapPrintJobSnapshot)
    };
  }

  listJobs(request: ListPrintJobsRequest = {}): PrintSpoolJobSnapshot[] {
    return this.#database.printSpool.listRecent(request.limit ?? 50).map(mapPrintJobSnapshot);
  }

  enqueueProductionTickets(request: EnqueueProductionPrintRequest): EnqueueProductionPrintResult {
    const createdJobs: PrintSpoolJobSnapshot[] = [];
    const reusedJobs: PrintSpoolJobSnapshot[] = [];

    for (const [setor, items] of groupItemsBySetor(request.items)) {
      const dedupKey = `${request.sourceEntityId}:${request.batchId}:${setor}:PRODUCAO`;
      const existing = this.#database.printSpool.findByDedupKey(dedupKey);

      if (existing) {
        reusedJobs.push(mapPrintJobSnapshot(existing));
        continue;
      }

      const printerTargets = resolvePrinterTargetsForSetor(this.#resolveRoutingConfig(), setor);
      const printJobId = `job_${randomUUID()}`;
      const record = this.#database.printSpool.enqueue({
        printJobId,
        sourceEntity: request.sourceEntity,
        sourceEntityId: request.sourceEntityId,
        setor,
        dedupKey,
        printerTargetId: printerTargets[0] ?? null,
        printerTargetName: printerTargets[0] ?? null,
        ticketKind: "PRODUCAO",
        payload: createProductionPayload(printJobId, setor, request, items)
      });

      this.#appendAuditEvent({
        entityId: record.printJobId,
        action: "PRINT_JOB_ENQUEUED",
        occurredAt: request.requestedAt,
        actor: request.actor,
        payload: {
          setor,
          batchId: request.batchId,
          sourceEntityId: request.sourceEntityId,
          printerTargetName: record.printerTargetName,
          ticketKind: record.ticketKind,
          itemCount: items.length
        }
      });
      createdJobs.push(mapPrintJobSnapshot(record));
    }

    this.#logger.info("electron.print.jobs-enqueued", {
      sourceEntityId: request.sourceEntityId,
      batchId: request.batchId,
      createdJobs: createdJobs.length,
      reusedJobs: reusedJobs.length
    });

    return {
      createdJobs,
      reusedJobs
    };
  }

  reprintSecondCopy(request: ReprintSecondCopyRequest): PrintSpoolJobSnapshot {
    const record = this.#database.printSpool.createSecondCopy({
      originalJobId: request.originalJobId,
      secondCopyJobId: `job_${randomUUID()}`,
      queuedAt: request.requestedAt
    });

    this.#appendAuditEvent({
      entityId: record.printJobId,
      action: "PRINT_JOB_SECOND_COPY_ENQUEUED",
      occurredAt: request.requestedAt,
      actor: request.actor,
      payload: {
        originalJobId: request.originalJobId,
        secondCopyJobId: record.printJobId,
        reason: request.reason
      }
    });

    this.#logger.info("electron.print.second-copy-enqueued", {
      originalJobId: request.originalJobId,
      secondCopyJobId: record.printJobId
    });

    return mapPrintJobSnapshot(record);
  }

  reprocessJob(request: ReprocessPrintJobRequest): PrintSpoolJobSnapshot {
    const current = this.#database.printSpool.findById(request.printJobId);
    const requeued = this.#database.printSpool.registerAttempt({
      printJobId: current.printJobId,
      status: "QUEUED",
      incrementAttempts: false,
      lastAttemptAt: request.requestedAt,
      leaseExpiresAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      nextRetryAt: null,
      printedAt: current.printedAt
    });

    this.#appendAuditEvent({
      entityId: requeued.printJobId,
      action: "PRINT_JOB_REQUEUED",
      occurredAt: request.requestedAt,
      actor: request.actor,
      payload: {
        reason: request.reason,
        previousStatus: current.status,
        attempts: current.attempts
      }
    });

    return mapPrintJobSnapshot(requeued);
  }

  processPendingJobs(request: ProcessPrintQueueRequest = {}): ProcessPrintQueueResult {
    const asOf = request.asOf ?? new Date().toISOString();
    const limit = request.limit ?? 10;
    const processedJobs: PrintSpoolJobSnapshot[] = [];
    const printers = this.#driver.listPrinters();

    for (let index = 0; index < limit; index += 1) {
      const claimed = this.#database.printSpool.claimNextReady({
        asOf,
        leaseExpiresAt: new Date(Date.parse(asOf) + this.#leaseDurationMs).toISOString()
      });

      if (!claimed) {
        break;
      }

      const processed = this.#processClaimedJob(claimed, asOf, printers);
      processedJobs.push(mapPrintJobSnapshot(processed));
    }

    return {
      processedCount: processedJobs.length,
      doneCount: processedJobs.filter((job) => job.status === "DONE").length,
      waitingPrinterCount: processedJobs.filter((job) => job.status === "WAITING_PRINTER").length,
      needsAttentionCount: processedJobs.filter((job) => job.status === "NEEDS_ATTENTION").length,
      jobs: processedJobs
    };
  }

  #processClaimedJob(
    claimed: PrintJobRecord,
    asOf: string,
    printers: DriverPrinterSnapshot[]
  ): PrintJobRecord {
    if (!claimed.printerTargetName) {
      const updated = this.#database.printSpool.registerAttempt({
        printJobId: claimed.printJobId,
        status: "NEEDS_ATTENTION",
        incrementAttempts: true,
        lastAttemptAt: asOf,
        leaseExpiresAt: null,
        lastErrorCode: "PRINTER_ROUTE_MISSING",
        lastErrorMessage: "Setor sem impressora configurada para impressao.",
        nextRetryAt: null
      });
      this.#appendAuditEvent({
        entityId: claimed.printJobId,
        action: "PRINT_JOB_FAILED",
        occurredAt: asOf,
        actor: {
          userId: "system",
          terminalId: "pdv-main",
          role: "SYSTEM"
        },
        payload: {
          status: "NEEDS_ATTENTION",
          code: "PRINTER_ROUTE_MISSING",
          message: "Setor sem impressora configurada para impressao.",
          attempts: claimed.attempts + 1
        }
      });
      return updated;
    }

    const printer = printers.find((item) => item.printerName === claimed.printerTargetName);

    if (!printer || printer.isOffline || !printer.isAvailable) {
      return this.#handleDriverFailure(claimed, {
        ok: false,
        code: "PRINTER_OFFLINE",
        message: `Impressora ${claimed.printerTargetName} indisponivel no Windows.`,
        retryable: true
      }, asOf);
    }

    const ticket = this.#renderTicket(claimed);
    const ticketFilePath = path.join(this.#paths.spoolDir, `${claimed.printJobId}.txt`);
    fs.writeFileSync(ticketFilePath, ticket, "utf8");

    const result = this.#driver.printText({
      printerName: claimed.printerTargetName,
      ticketFilePath
    });

    if (result.ok) {
      const printed = this.#database.printSpool.registerAttempt({
        printJobId: claimed.printJobId,
        status: "DONE",
        incrementAttempts: true,
        lastAttemptAt: asOf,
        leaseExpiresAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        nextRetryAt: null,
        printedAt: asOf
      });

      this.#logger.info("electron.print.job-printed", {
        printJobId: claimed.printJobId,
        setor: claimed.setor,
        printerTargetName: claimed.printerTargetName
      });
      this.#appendAuditEvent({
        entityId: claimed.printJobId,
        action: "PRINT_JOB_DONE",
        occurredAt: asOf,
        actor: {
          userId: "system",
          terminalId: "pdv-main",
          role: "SYSTEM"
        },
        payload: {
          setor: claimed.setor,
          printerTargetName: claimed.printerTargetName
        }
      });

      return printed;
    }

    return this.#handleDriverFailure(claimed, result, asOf);
  }

  #handleDriverFailure(
    claimed: PrintJobRecord,
    failure: DriverPrintFailure,
    asOf: string
  ): PrintJobRecord {
    const nextAttemptNumber = claimed.attempts + 1;
    const allowAutomaticRetry = failure.retryable && nextAttemptNumber < MAX_AUTOMATIC_ATTEMPTS;
    const nextStatus = allowAutomaticRetry ? "WAITING_PRINTER" : "NEEDS_ATTENTION";
    const nextRetryAt = allowAutomaticRetry ? computeRetryAt(asOf, claimed.attempts) : null;
    const updated = this.#database.printSpool.registerAttempt({
      printJobId: claimed.printJobId,
      status: nextStatus,
      incrementAttempts: true,
      lastAttemptAt: asOf,
      leaseExpiresAt: null,
      lastErrorCode: failure.code,
      lastErrorMessage: failure.message,
      nextRetryAt
    });

    if (nextStatus === "WAITING_PRINTER") {
      this.#logger.warn("electron.print.job-failed", {
        printJobId: claimed.printJobId,
        setor: claimed.setor,
        printerTargetName: claimed.printerTargetName,
        code: failure.code
      });
    } else {
      this.#logger.error("electron.print.job-failed", {
        printJobId: claimed.printJobId,
        setor: claimed.setor,
        printerTargetName: claimed.printerTargetName,
        code: failure.code
      });
    }

    this.#appendAuditEvent({
      entityId: claimed.printJobId,
      action: nextStatus === "WAITING_PRINTER" ? "PRINT_JOB_RETRY_SCHEDULED" : "PRINT_JOB_FAILED",
      occurredAt: asOf,
      actor: {
        userId: "system",
        terminalId: "pdv-main",
        role: "SYSTEM"
      },
      payload: {
        status: nextStatus,
        code: failure.code,
        message: failure.message,
        attempts: nextAttemptNumber
      }
    });

    return updated;
  }

  #resolveRoutingConfig(): PrintRoutingConfig {
    const persistedRoutes = this.#database.printRouting.listAll();

    if (persistedRoutes.length > 0) {
      return {
        setores: persistedRoutes.map((route) => ({
          id: route.setor,
          impressoras: [route.printerName]
        }))
      };
    }

    return {
      setores: listSetorRoutes(this.#routingConfig).map((setor) => ({
        id: setor.id,
        impressoras: [...setor.impressoras]
      }))
    };
  }

  #renderTicket(job: PrintJobRecord): string {
    if (!isTicketPayload(job.payload)) {
      throw new Error(`Payload do job ${job.printJobId} nao segue o contrato esperado do ticket.`);
    }

    return renderKitchenTicket(job.payload as TicketPayload);
  }

  #appendAuditEvent(input: {
    entityId: string;
    action: string;
    occurredAt: string;
    actor: { userId: string; terminalId: string; role: string };
    payload: JsonValue;
  }): void {
    this.#database.auditEvents.append({
      eventId: `evt_${randomUUID()}`,
      entity: "PRINT_JOB",
      entityId: input.entityId,
      action: input.action,
      actorUserId: input.actor.userId,
      actorTerminalId: input.actor.terminalId,
      actorRole: input.actor.role,
      occurredAt: input.occurredAt,
      payload: input.payload
    });
  }
}

function groupItemsBySetor(items: EnqueueProductionPrintRequest["items"]) {
  const grouped = new Map<string, EnqueueProductionPrintRequest["items"]>();

  for (const item of items) {
    const current = grouped.get(item.setor) ?? [];
    current.push(item);
    grouped.set(item.setor, current);
  }

  return grouped;
}

function computeRetryAt(asOf: string, attempts: number): string {
  const nextDelayMinutes = Math.min(15, Math.max(1, attempts + 1));
  return new Date(Date.parse(asOf) + nextDelayMinutes * 60_000).toISOString();
}

function createProductionPayload(
  printJobId: string,
  setor: string,
  request: EnqueueProductionPrintRequest,
  items: EnqueueProductionPrintRequest["items"]
): JsonValue {
  return {
    header: {
      kind: "PRODUCAO",
      printJobId,
      batchId: request.batchId,
      setor,
      comandaNumero: request.comandaNumero,
      mesaId: request.mesaId ?? null,
      requestedAt: request.requestedAt,
      actor: {
        userId: request.actor.userId,
        terminalId: request.actor.terminalId,
        role: request.actor.role
      }
    },
    items: items.map((item) => ({
      itemId: item.itemId,
      productLabel: item.productLabel,
      quantity: item.quantity,
      note: item.note
    }))
  } satisfies JsonValue;
}

function mapPrintJobSnapshot(record: PrintJobRecord): PrintSpoolJobSnapshot {
  return {
    printJobId: record.printJobId,
    sourceEntity: record.sourceEntity,
    sourceEntityId: record.sourceEntityId,
    setor: record.setor,
    status: record.status,
    ticketKind: record.ticketKind,
    printerTargetId: record.printerTargetId,
    printerTargetName: record.printerTargetName,
    secondCopyOfJobId: record.secondCopyOfJobId,
    attempts: record.attempts,
    secondCopyCount: record.secondCopyCount,
    lastErrorCode: record.lastErrorCode,
    lastErrorMessage: record.lastErrorMessage,
    nextRetryAt: record.nextRetryAt,
    lastAttemptAt: record.lastAttemptAt,
    printedAt: record.printedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function mapDriverPrinterSnapshot(printer: DriverPrinterSnapshot): PrintDriverPrinterSnapshot {
  return {
    printerId: printer.printerId,
    printerName: printer.printerName,
    isOffline: printer.isOffline,
    isAvailable: printer.isAvailable,
    status: printer.status
  };
}
