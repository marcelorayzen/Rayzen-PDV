import { randomUUID } from "node:crypto";

import type {
  RayzenDatabaseClient,
  AuditEventRecord,
  JsonValue,
  PersistedCashSessionAggregate,
  PersistedComandaAggregate
} from "@rayzen/db";
import {
  addComandaItem,
  calculateComandaTotals,
  cancelComandaItem,
  checkoutComanda,
  exportCashSessionAudit,
  generateComandaPreConta,
  openCashSession,
  openComanda,
  reopenComanda,
  requestComandaCashCheckout,
  receiveCashPayment,
  registerCashSupply,
  registerCashWithdrawal,
  sendComandaToProduction,
  startCashClosure,
  closeCashSession,
  type CashActor,
  type CashAuditEvent,
  type CashAuditExport,
  type CashSessionAggregate,
  type ComandaActor,
  type ComandaAggregate,
  type ComandaAuditEvent,
  type PreContaSnapshot
} from "@rayzen/pdv";

import type {
  AddComandaItemRequest,
  CancelComandaItemRequest,
  CashWorkspaceSnapshot,
  CloseCashSessionRequest,
  ComandaWorkspaceSnapshot,
  ComandaMesaGroupSnapshot,
  ConfirmComandaPaymentRequest,
  GetComandaWorkspaceRequest,
  OpenCashSessionRequest,
  OpenComandaRequest,
  OperationalSnapshot,
  RegisterCashReceiptRequest,
  RegisterCashSupplyRequest,
  RegisterCashWithdrawalRequest,
  ReopenComandaRequest,
  RequestComandaCashCheckoutRequest,
  SendComandaToProductionRequest,
  StartCashClosureRequest,
  StartComandaCheckoutRequest
} from "../../contracts/ipc.js";
import type { FiscalService } from "../fiscal/service.js";
import type { MainProcessLogStore } from "../log-store.js";
import type { PrintSpoolService } from "../printing/service.js";

export interface PdvRoundtripServiceOptions {
  defaultTerminalId?: string;
  fiscal?: FiscalService;
}

export class PdvRoundtripService {
  readonly #database: RayzenDatabaseClient;
  readonly #logger: MainProcessLogStore;
  readonly #printing: PrintSpoolService;
  readonly #fiscal: FiscalService | null;
  readonly #defaultTerminalId: string;

  constructor(
    database: RayzenDatabaseClient,
    logger: MainProcessLogStore,
    printing: PrintSpoolService,
    options: PdvRoundtripServiceOptions = {}
  ) {
    this.#database = database;
    this.#logger = logger;
    this.#printing = printing;
    this.#fiscal = options.fiscal ?? null;
    this.#defaultTerminalId = options.defaultTerminalId ?? "pdv-main";
  }

  getOperationalSnapshot(terminalId = this.#defaultTerminalId): OperationalSnapshot {
    const activeComandas = this.#database.comandas.listActive().map((persisted) => hydratePersistedComandaAggregate(this.#database, persisted));
    const activeComanda = activeComandas[0] ?? null;
    const activeCash = this.#database.cashSessions.findActiveByTerminalId(terminalId);

    return {
      comanda: activeComanda ? this.#loadComandaWorkspace(activeComanda.comandaId, activeComandas) : emptyComandaWorkspace(),
      cash: activeCash ? this.#loadCashWorkspace(activeCash.session.cashSessionId) : emptyCashWorkspace()
    };
  }

  getComandaWorkspace(request: GetComandaWorkspaceRequest): ComandaWorkspaceSnapshot {
    return this.#loadComandaWorkspace(request.comandaId);
  }

  openComanda(request: OpenComandaRequest): ComandaWorkspaceSnapshot {
    const existingByNumero = this.#database.comandas.findLatestActiveByNumero(request.numero.trim());

    if (existingByNumero) {
      return this.#loadComandaWorkspace(existingByNumero.comanda.comandaId);
    }

    const mutation = openComanda({
      comandaId: this.#nextId("cmd"),
      numero: request.numero.trim(),
      mesaId: request.mesaId ?? null,
      actor: request.actor,
      openedAt: this.#nowIso(),
      auditEventId: this.#nextId("evt"),
      currentOwnerUserId: request.actor.userId
    });

    this.#database.comandas.saveAggregate(mapComandaAggregateForSave(mutation.comanda, mutation.auditEvents));
    this.#logger.info("pdv.comanda.opened", {
      comandaId: mutation.comanda.comandaId,
      numero: mutation.comanda.numero,
      actorUserId: request.actor.userId
    });

    return this.#loadComandaWorkspace(mutation.comanda.comandaId);
  }

  addComandaItem(request: AddComandaItemRequest): ComandaWorkspaceSnapshot {
    const aggregate = this.#requireComanda(request.comandaId);
    const mutation = addComandaItem(aggregate, {
      itemId: this.#nextId("item"),
      produtoId: request.produtoId,
      productLabel: request.productLabel,
      setor: request.setor,
      quantity: request.quantity,
      unitPriceCents: request.unitPriceCents,
      note: request.note ?? null,
      actor: request.actor,
      occurredAt: this.#nowIso(),
      auditEventId: this.#nextId("evt")
    });

    this.#database.comandas.saveAggregate(mapComandaAggregateForSave(mutation.comanda, mutation.auditEvents));
    return this.#loadComandaWorkspace(request.comandaId);
  }

  cancelComandaItem(request: CancelComandaItemRequest): ComandaWorkspaceSnapshot {
    const aggregate = this.#requireComanda(request.comandaId);
    const mutation = cancelComandaItem(aggregate, {
      itemId: request.itemId,
      reason: request.reason,
      actor: request.actor,
      occurredAt: this.#nowIso(),
      auditEventId: this.#nextId("evt")
    });

    this.#database.comandas.saveAggregate(mapComandaAggregateForSave(mutation.comanda, mutation.auditEvents));
    return this.#loadComandaWorkspace(request.comandaId);
  }

  sendComandaToProduction(request: SendComandaToProductionRequest): ComandaWorkspaceSnapshot {
    const aggregate = this.#requireComanda(request.comandaId);
    const mutation = sendComandaToProduction(aggregate, {
      batchId: this.#nextId("batch"),
      actor: request.actor,
      occurredAt: this.#nowIso(),
      auditEventId: this.#nextId("evt")
    });

    this.#database.transaction(() => {
      this.#database.comandas.saveAggregate(mapComandaAggregateForSave(mutation.comanda, mutation.auditEvents));

      if (mutation.productionBatch) {
        const batchItems = mutation.comanda.items
          .filter((item) => item.productionBatchId === mutation.productionBatch?.batchId && item.status === "ENVIADO")
          .map((item) => ({
            itemId: item.itemId,
            productLabel: item.productLabel,
            quantity: item.quantity,
            setor: item.setor,
            note: item.note
          }));

        this.#printing.enqueueProductionTickets({
          sourceEntity: "COMANDA",
          sourceEntityId: mutation.comanda.comandaId,
          comandaNumero: mutation.comanda.numero,
          mesaId: mutation.comanda.mesaId,
          batchId: mutation.productionBatch.batchId,
          requestedAt: mutation.productionBatch.sentAt,
          actor: toPrintRequestActor(request.actor),
          items: batchItems
        });
      }
    });

    return this.#loadComandaWorkspace(request.comandaId);
  }

  startComandaCheckout(request: StartComandaCheckoutRequest): ComandaWorkspaceSnapshot {
    const aggregate = this.#requireComanda(request.comandaId);
    const mutation = generateComandaPreConta(aggregate, {
      preContaId: this.#nextId("pre"),
      actor: request.actor,
      occurredAt: this.#nowIso(),
      auditEventId: this.#nextId("evt")
    });

    this.#database.comandas.saveAggregate(mapComandaAggregateForSave(mutation.comanda, mutation.auditEvents));
    return this.#loadComandaWorkspace(request.comandaId);
  }

  reopenComanda(request: ReopenComandaRequest): ComandaWorkspaceSnapshot {
    const aggregate = this.#requireComanda(request.comandaId);
    const mutation = reopenComanda(aggregate, {
      actor: request.actor,
      occurredAt: this.#nowIso(),
      auditEventId: this.#nextId("evt")
    });

    this.#database.comandas.saveAggregate(mapComandaAggregateForSave(mutation.comanda, mutation.auditEvents));
    return this.#loadComandaWorkspace(request.comandaId);
  }

  requestComandaCashCheckout(request: RequestComandaCashCheckoutRequest): ComandaWorkspaceSnapshot {
    const aggregate = this.#requireComanda(request.comandaId);
    const mutation = requestComandaCashCheckout(aggregate, {
      actor: request.actor,
      occurredAt: this.#nowIso(),
      auditEventId: this.#nextId("evt")
    });

    this.#database.comandas.saveAggregate(mapComandaAggregateForSave(mutation.comanda, mutation.auditEvents));
    return this.#loadComandaWorkspace(request.comandaId);
  }

  confirmComandaPayment(request: ConfirmComandaPaymentRequest): OperationalSnapshot {
    const comanda = this.#requireComanda(request.comandaId);
    const cash = this.#requireActiveCashSession(request.actor.terminalId);
    const occurredAt = this.#nowIso();
    const paymentMutation = checkoutComanda(comanda, {
      actor: request.actor,
      occurredAt,
      auditEventId: this.#nextId("evt"),
      payments: [
        {
          paymentId: this.#nextId("pay"),
          method: request.paymentMethod,
          amountCents: request.amountCents
        }
      ]
    });
    const cashMutation = receiveCashPayment(cash, {
      movementId: this.#nextId("cashmov"),
      actor: request.actor,
      occurredAt,
      auditEventId: this.#nextId("evt"),
      method: request.paymentMethod,
      amountCents: request.amountCents,
      sourceEntity: "COMANDA",
      sourceEntityId: request.comandaId,
      reason: `Checkout da comanda ${paymentMutation.comanda.numero}`
    });

    this.#database.transaction(() => {
      this.#database.comandas.saveAggregate(mapComandaAggregateForSave(paymentMutation.comanda, paymentMutation.auditEvents));
      this.#database.cashSessions.saveAggregate(mapCashSessionAggregateForSave(cashMutation.session, cashMutation.auditEvents));
    });

    if (this.#fiscal) {
      try {
        const totals = calculateComandaTotals(paymentMutation.comanda);
        this.#fiscal.queueCheckoutNfce({
          terminalId: request.actor.terminalId,
          comandaId: paymentMutation.comanda.comandaId,
          comandaNumero: paymentMutation.comanda.numero,
          totalAmountCents: totals.itemSubtotalCents,
          paymentMethod: request.paymentMethod,
          actor: toPrintRequestActor(request.actor),
          occurredAt,
          items: paymentMutation.comanda.items.map((item) => ({
            itemId: item.itemId,
            produtoId: item.produtoId,
            productLabel: item.productLabel,
            setor: item.setor,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            note: item.note
          }))
        });
      } catch (error) {
        this.#database.auditEvents.append({
          eventId: this.#nextId("evt"),
          entity: "COMANDA",
          entityId: paymentMutation.comanda.comandaId,
          action: "FISCAL_DOCUMENTO_NAO_ENFILEIRADO",
          actorUserId: request.actor.userId,
          actorTerminalId: request.actor.terminalId,
          actorRole: request.actor.role ?? null,
          occurredAt,
          payload: {
            reasonCode: "FISCAL_QUEUE_ERROR",
            message: error instanceof Error ? error.message : "Falha desconhecida no enfileiramento fiscal."
          }
        });
        this.#logger.warn("pdv.comanda.fiscal-queue-failed", {
          comandaId: paymentMutation.comanda.comandaId,
          terminalId: request.actor.terminalId,
          message: error instanceof Error ? error.message : "Falha desconhecida no enfileiramento fiscal."
        });
      }
    }

    return {
      comanda: this.#loadComandaWorkspace(request.comandaId),
      cash: this.#loadCashWorkspace(cashMutation.session.cashSessionId)
    };
  }

  openCashSession(request: OpenCashSessionRequest): CashWorkspaceSnapshot {
    const active = this.#database.cashSessions.findActiveByTerminalId(request.actor.terminalId);

    if (active && active.session.status !== "FECHADO") {
      return this.#loadCashWorkspace(active.session.cashSessionId);
    }

    const mutation = openCashSession({
      cashSessionId: this.#nextId("cash"),
      terminalId: request.actor.terminalId,
      actor: request.actor,
      openedAt: this.#nowIso(),
      auditEventId: this.#nextId("evt"),
      openingFundAmountCents: request.openingFundAmountCents,
      openingReason: request.openingReason ?? null
    });

    this.#database.cashSessions.saveAggregate(mapCashSessionAggregateForSave(mutation.session, mutation.auditEvents));
    return this.#loadCashWorkspace(mutation.session.cashSessionId);
  }

  registerCashReceipt(request: RegisterCashReceiptRequest): CashWorkspaceSnapshot {
    const session = this.#requireActiveCashSession(request.actor.terminalId);
    const mutation = receiveCashPayment(session, {
      movementId: this.#nextId("cashmov"),
      actor: request.actor,
      occurredAt: this.#nowIso(),
      auditEventId: this.#nextId("evt"),
      method: request.method,
      amountCents: request.amountCents,
      reason: request.reason ?? null
    });

    this.#database.cashSessions.saveAggregate(mapCashSessionAggregateForSave(mutation.session, mutation.auditEvents));
    return this.#loadCashWorkspace(mutation.session.cashSessionId);
  }

  registerCashSupply(request: RegisterCashSupplyRequest): CashWorkspaceSnapshot {
    const session = this.#requireActiveCashSession(request.actor.terminalId);
    const mutation = registerCashSupply(session, {
      movementId: this.#nextId("cashmov"),
      actor: request.actor,
      occurredAt: this.#nowIso(),
      auditEventId: this.#nextId("evt"),
      amountCents: request.amountCents,
      reason: request.reason
    });

    this.#database.cashSessions.saveAggregate(mapCashSessionAggregateForSave(mutation.session, mutation.auditEvents));
    return this.#loadCashWorkspace(mutation.session.cashSessionId);
  }

  registerCashWithdrawal(request: RegisterCashWithdrawalRequest): CashWorkspaceSnapshot {
    const session = this.#requireActiveCashSession(request.actor.terminalId);
    const mutation = registerCashWithdrawal(session, {
      movementId: this.#nextId("cashmov"),
      actor: request.actor,
      occurredAt: this.#nowIso(),
      auditEventId: this.#nextId("evt"),
      amountCents: request.amountCents,
      reason: request.reason
    });

    this.#database.cashSessions.saveAggregate(mapCashSessionAggregateForSave(mutation.session, mutation.auditEvents));
    return this.#loadCashWorkspace(mutation.session.cashSessionId);
  }

  startCashClosure(request: StartCashClosureRequest): CashWorkspaceSnapshot {
    const session = this.#requireActiveCashSession(request.actor.terminalId);
    const mutation = startCashClosure(session, {
      actor: request.actor,
      occurredAt: this.#nowIso(),
      auditEventId: this.#nextId("evt"),
      pendingComandasInPaymentCount: this.#database.comandas.countByStatus("EM_PAGAMENTO")
    });

    this.#database.cashSessions.saveAggregate(mapCashSessionAggregateForSave(mutation.session, mutation.auditEvents));
    return this.#loadCashWorkspace(mutation.session.cashSessionId);
  }

  closeCashSession(request: CloseCashSessionRequest): CashWorkspaceSnapshot {
    const session = this.#requireActiveCashSession(request.actor.terminalId);
    const mutation = closeCashSession(session, {
      actor: request.actor,
      occurredAt: this.#nowIso(),
      auditEventId: this.#nextId("evt"),
      counts: request.counts,
      note: request.note ?? null,
      divergenceReason: request.divergenceReason ?? null
    });

    this.#database.cashSessions.saveAggregate(mapCashSessionAggregateForSave(mutation.session, mutation.auditEvents));
    return this.#loadCashWorkspace(mutation.session.cashSessionId);
  }

  exportCashAudit(terminalId = this.#defaultTerminalId): CashWorkspaceSnapshot {
    const session = this.#requireActiveOrLastCashSession(terminalId);
    return this.#loadCashWorkspace(session.cashSessionId);
  }

  getCashStatus(terminalId = this.#defaultTerminalId): CashWorkspaceSnapshot {
    const active = this.#database.cashSessions.findActiveByTerminalId(terminalId);

    if (active) {
      return this.#loadCashWorkspace(active.session.cashSessionId);
    }

    const latest = this.#database.cashSessions.findLatestByTerminalId(terminalId);
    return latest ? this.#loadCashWorkspace(latest.session.cashSessionId) : emptyCashWorkspace();
  }

  getCashSummary(terminalId = this.#defaultTerminalId): CashAuditExport | null {
    return this.getCashStatus(terminalId).auditExport;
  }

  #requireComanda(comandaId: string): ComandaAggregate {
    const persisted = this.#database.comandas.findById(comandaId);

    if (!persisted) {
      throw new Error(`Comanda nao encontrada: ${comandaId}`);
    }

    return hydratePersistedComandaAggregate(this.#database, persisted);
  }

  #requireActiveCashSession(terminalId: string): CashSessionAggregate {
    const persisted = this.#database.cashSessions.findActiveByTerminalId(terminalId);

    if (!persisted) {
      throw new Error("Abra o caixa antes de confirmar recebimentos e checkout.");
    }

    return mapPersistedCashSessionAggregate(persisted);
  }

  #requireActiveOrLastCashSession(terminalId: string): CashSessionAggregate {
    const active = this.#database.cashSessions.findActiveByTerminalId(terminalId);

    if (active) {
      return mapPersistedCashSessionAggregate(active);
    }

    const latest = this.#database.cashSessions.findLatestByTerminalId(terminalId);

    if (latest) {
      return mapPersistedCashSessionAggregate(latest);
    }

    throw new Error("Abra ou conclua um caixa antes de exportar a auditoria.");
  }

  #loadComandaWorkspace(comandaId: string, activeComandas = this.#database.comandas.listActive().map((persisted) => hydratePersistedComandaAggregate(this.#database, persisted))): ComandaWorkspaceSnapshot {
    const persisted = this.#database.comandas.findById(comandaId);

    if (!persisted) {
      return emptyComandaWorkspace();
    }

    const auditTrail = loadComandaAuditTrail(this.#database, persisted);
    const currentComanda = applyDerivedComandaState(mapPersistedComandaAggregate(persisted), auditTrail);

    return {
      currentComanda,
      activeComandas,
      mesaGroups: groupComandasByMesa(activeComandas),
      auditTrail,
      lastPreContaSnapshot: currentComanda.preContas.at(-1) ?? null
    };
  }

  #loadCashWorkspace(cashSessionId: string): CashWorkspaceSnapshot {
    const persisted = this.#database.cashSessions.findById(cashSessionId);

    if (!persisted) {
      return emptyCashWorkspace();
    }

    const currentSession = mapPersistedCashSessionAggregate(persisted);
    const auditTrail = this.#database.auditEvents.findByEntity("CAIXA", cashSessionId).map(mapAuditRecordToCashEvent);
    const auditExport = exportCashSessionAudit(currentSession, auditTrail);

    return {
      currentSession,
      auditTrail,
      auditExport
    };
  }

  #nextId(prefix: string): string {
    return `${prefix}_${randomUUID()}`;
  }

  #nowIso(): string {
    return new Date().toISOString();
  }
}

function mapPersistedComandaAggregate(persisted: PersistedComandaAggregate): ComandaAggregate {
  return {
    comandaId: persisted.comanda.comandaId,
    numero: persisted.comanda.numero,
    mesaId: persisted.comanda.mesaId,
    atendimentoRef: persisted.comanda.atendimentoRef,
    cashCheckoutRequestedAt: null,
    status: persisted.comanda.status,
    openedAt: persisted.comanda.openedAt,
    currentOwnerUserId: persisted.comanda.currentOwnerUserId,
    cancelledAt: persisted.comanda.cancelledAt,
    cancellationReason: persisted.comanda.cancellationReason,
    closedAt: persisted.comanda.closedAt,
    items: persisted.items.map((item) => ({
      itemId: item.itemId,
      produtoId: item.produtoId,
      productLabel: item.productLabel,
      setor: item.setor,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      status: item.status,
      note: item.note,
      createdAt: item.createdAt,
      sentAt: item.sentAt,
      cancelledAt: item.cancelledAt,
      cancellationReason: item.cancellationReason,
      productionBatchId: item.productionBatchId
    })),
    payments: persisted.payments.map((payment) => ({
      paymentId: payment.paymentId,
      method: payment.method as ComandaAggregate["payments"][number]["method"],
      amountCents: payment.amountCents,
      status: payment.status,
      confirmedAt: payment.confirmedAt
    })),
    preContas: persisted.preContas.map((preConta) => preConta.snapshot as unknown as PreContaSnapshot),
    productionBatches: persisted.comanda.productionBatches as unknown as ComandaAggregate["productionBatches"]
  };
}

function mapPersistedCashSessionAggregate(persisted: PersistedCashSessionAggregate): CashSessionAggregate {
  const closureSummary = persisted.session.closureSummary as unknown as Record<string, unknown>;
  const closure = closureSummary && Object.keys(closureSummary).length > 0
    ? persisted.session.closureSummary as unknown as CashSessionAggregate["closure"]
    : null;

  return {
    cashSessionId: persisted.session.cashSessionId,
    terminalId: persisted.session.terminalId,
    openedBy: createCashActor(
      persisted.session.openedByUserId,
      persisted.session.openedByTerminalId,
      persisted.session.openedByRole
    ),
    openedAt: persisted.session.openedAt,
    openingFundAmountCents: persisted.session.openingFundAmountCents,
    openingReason: persisted.session.openingReason,
    status: persisted.session.status,
    closingStartedAt: persisted.session.closingStartedAt,
    closedAt: persisted.session.closedAt,
    movements: persisted.movements.map((movement) => ({
      movementId: movement.cashMovementId,
      type: movement.movementType,
      method: movement.paymentMethod,
      amountCents: movement.amountCents,
      reason: movement.reason,
      sourceEntity: movement.sourceEntity,
      sourceEntityId: movement.sourceEntityId,
      occurredAt: movement.occurredAt,
      actor: createCashActor(movement.actorUserId, movement.actorTerminalId, movement.actorRole)
    })),
    closure
  };
}

function mapComandaAggregateForSave(
  aggregate: ComandaAggregate,
  auditEvents: ComandaAuditEvent[]
) {
  const totals = calculateComandaTotals(aggregate);

  return {
    comanda: {
      comandaId: aggregate.comandaId,
      numero: aggregate.numero,
      mesaId: aggregate.mesaId,
      atendimentoRef: aggregate.atendimentoRef,
      status: aggregate.status,
      currentOwnerUserId: aggregate.currentOwnerUserId,
      openedAt: aggregate.openedAt,
      closedAt: aggregate.closedAt,
      cancelledAt: aggregate.cancelledAt,
      cancellationReason: aggregate.cancellationReason,
      subtotalAmountCents: totals.itemSubtotalCents,
      paidAmountCents: totals.paidAmountCents,
      changeAmountCents: totals.changeAmountCents,
      productionBatches: aggregate.productionBatches as unknown as JsonValue
    },
    items: aggregate.items.map((item) => ({
      itemId: item.itemId,
      comandaId: aggregate.comandaId,
      produtoId: item.produtoId,
      productLabel: item.productLabel,
      setor: item.setor,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      status: item.status,
      note: item.note,
      productionBatchId: item.productionBatchId,
      createdAt: item.createdAt,
      sentAt: item.sentAt,
      cancelledAt: item.cancelledAt,
      cancellationReason: item.cancellationReason
    })),
    payments: aggregate.payments.map((payment) => ({
      paymentId: payment.paymentId,
      comandaId: aggregate.comandaId,
      method: payment.method,
      amountCents: payment.amountCents,
      status: payment.status,
      confirmedAt: payment.confirmedAt
    })),
    preContas: aggregate.preContas.map((preConta) => ({
      preContaId: preConta.preContaId,
      comandaId: aggregate.comandaId,
      version: preConta.version,
      totalAmountCents: preConta.totalAmountCents,
      snapshot: preConta as unknown as JsonValue,
      generatedAt: preConta.generatedAt
    })),
    auditEvents: auditEvents.map(mapComandaAuditEventForSave)
  };
}

function mapCashSessionAggregateForSave(
  aggregate: CashSessionAggregate,
  auditEvents: CashAuditEvent[]
) {
  return {
    session: {
      cashSessionId: aggregate.cashSessionId,
      terminalId: aggregate.terminalId,
      openedByUserId: aggregate.openedBy.userId,
      openedByTerminalId: aggregate.openedBy.terminalId,
      openedByRole: aggregate.openedBy.role ?? null,
      openedAt: aggregate.openedAt,
      openingFundAmountCents: aggregate.openingFundAmountCents,
      openingReason: aggregate.openingReason,
      status: aggregate.status,
      closingStartedAt: aggregate.closingStartedAt,
      closedAt: aggregate.closedAt,
      closedByUserId: aggregate.closure?.closedBy.userId ?? null,
      closedByTerminalId: aggregate.closure?.closedBy.terminalId ?? null,
      closedByRole: aggregate.closure?.closedBy.role ?? null,
      closureNote: aggregate.closure?.note ?? null,
      divergenceReason: aggregate.closure?.divergenceReason ?? null,
      closureSummary: (aggregate.closure ?? {}) as unknown as JsonValue
    },
    movements: aggregate.movements.map((movement) => ({
      cashMovementId: movement.movementId,
      cashSessionId: aggregate.cashSessionId,
      movementType: movement.type,
      paymentMethod: movement.method,
      amountCents: movement.amountCents,
      reason: movement.reason,
      sourceEntity: movement.sourceEntity,
      sourceEntityId: movement.sourceEntityId,
      occurredAt: movement.occurredAt,
      actorUserId: movement.actor.userId,
      actorTerminalId: movement.actor.terminalId,
      actorRole: movement.actor.role ?? null
    })),
    auditEvents: auditEvents.map(mapCashAuditEventForSave)
  };
}

function loadComandaAuditTrail(database: RayzenDatabaseClient, persisted: PersistedComandaAggregate): ComandaAuditEvent[] {
  const records = [
    ...database.auditEvents.findByEntity("COMANDA", persisted.comanda.comandaId),
    ...persisted.items.flatMap((item) => database.auditEvents.findByEntity("ITEM", item.itemId)),
    ...persisted.payments.flatMap((payment) => database.auditEvents.findByEntity("PAGAMENTO", payment.paymentId))
  ].sort((left, right) => {
    if (left.occurredAt === right.occurredAt) {
      return left.createdAt.localeCompare(right.createdAt);
    }

    return left.occurredAt.localeCompare(right.occurredAt);
  });

  return records.map(mapAuditRecordToComandaEvent);
}

function mapAuditRecordToComandaEvent(record: AuditEventRecord): ComandaAuditEvent {
  return {
    eventId: record.eventId,
    entity: record.entity as ComandaAuditEvent["entity"],
    entityId: record.entityId,
    action: record.action,
    actor: createComandaActor(record.actorUserId ?? "system", record.actorTerminalId ?? "pdv-main", record.actorRole),
    at: record.occurredAt,
    payload: record.payload as unknown as Record<string, unknown>
  };
}

function mapAuditRecordToCashEvent(record: AuditEventRecord): CashAuditEvent {
  return {
    eventId: record.eventId,
    entity: "CAIXA",
    entityId: record.entityId,
    action: record.action,
    actor: createCashActor(record.actorUserId ?? "system", record.actorTerminalId ?? "pdv-main", record.actorRole),
    at: record.occurredAt,
    payload: record.payload as unknown as Record<string, unknown>
  };
}

function mapComandaAuditEventForSave(event: ComandaAuditEvent) {
  return {
    eventId: event.eventId,
    entity: event.entity,
    entityId: event.entityId,
    action: event.action,
    actorUserId: event.actor.userId,
    actorTerminalId: event.actor.terminalId,
    actorRole: event.actor.role ?? null,
    occurredAt: event.at,
    payload: event.payload as unknown as JsonValue
  };
}

function mapCashAuditEventForSave(event: CashAuditEvent) {
  return {
    eventId: event.eventId,
    entity: event.entity,
    entityId: event.entityId,
    action: event.action,
    actorUserId: event.actor.userId,
    actorTerminalId: event.actor.terminalId,
    actorRole: event.actor.role ?? null,
    occurredAt: event.at,
    payload: event.payload as unknown as JsonValue
  };
}

function createComandaActor(userId: string, terminalId: string, role: string | null): ComandaActor {
  return role
    ? {
        userId,
        terminalId,
        role
      }
    : {
        userId,
        terminalId
      };
}

function createCashActor(userId: string, terminalId: string, role: string | null): CashActor {
  return role
    ? {
        userId,
        terminalId,
        role
      }
    : {
        userId,
        terminalId
      };
}

function toPrintRequestActor(actor: ComandaActor) {
  return {
    userId: actor.userId,
    terminalId: actor.terminalId,
    role: actor.role ?? "OPERADOR"
  };
}

function emptyComandaWorkspace(): ComandaWorkspaceSnapshot {
  return {
    currentComanda: null,
    activeComandas: [],
    mesaGroups: [],
    auditTrail: [],
    lastPreContaSnapshot: null
  };
}

function hydratePersistedComandaAggregate(
  database: RayzenDatabaseClient,
  persisted: PersistedComandaAggregate
): ComandaAggregate {
  return applyDerivedComandaState(
    mapPersistedComandaAggregate(persisted),
    loadComandaAuditTrail(database, persisted)
  );
}

function applyDerivedComandaState(comanda: ComandaAggregate, auditTrail: ComandaAuditEvent[]): ComandaAggregate {
  const cashCheckoutRequestedAt = comanda.status === "EM_PAGAMENTO"
    ? auditTrail
      .filter((event) => event.entity === "COMANDA" && event.action === "COMANDA_ENCAMINHADA_CAIXA")
      .at(-1)?.at ?? null
    : null;

  return {
    ...comanda,
    cashCheckoutRequestedAt
  };
}

function groupComandasByMesa(activeComandas: ComandaAggregate[]): ComandaMesaGroupSnapshot[] {
  const groups = new Map<string, ComandaAggregate[]>();

  for (const comanda of activeComandas) {
    const key = comanda.mesaId ?? "__SEM_MESA__";
    const current = groups.get(key) ?? [];
    current.push(comanda);
    groups.set(key, current);
  }

  return [...groups.entries()]
    .map(([key, comandas]) => {
      const totals = comandas.map((comanda) => calculateComandaTotals(comanda));

      return {
        mesaId: key === "__SEM_MESA__" ? null : key,
        comandas,
        comandaCount: comandas.length,
        itemCount: totals.reduce((sum, total) => sum + total.activeItemCount, 0),
        totalAmountCents: totals.reduce((sum, total) => sum + total.itemSubtotalCents, 0),
        paidAmountCents: totals.reduce((sum, total) => sum + total.paidAmountCents, 0),
        dueAmountCents: totals.reduce((sum, total) => sum + total.dueAmountCents, 0),
        statuses: [...new Set(comandas.map((comanda) => comanda.status))] as ComandaAggregate["status"][]
      };
    })
    .sort((left, right) => {
      if (left.mesaId === null) {
        return 1;
      }

      if (right.mesaId === null) {
        return -1;
      }

      return left.mesaId.localeCompare(right.mesaId, "pt-BR");
    });
}

function emptyCashWorkspace(): CashWorkspaceSnapshot {
  return {
    currentSession: null,
    auditTrail: [],
    auditExport: null
  };
}
