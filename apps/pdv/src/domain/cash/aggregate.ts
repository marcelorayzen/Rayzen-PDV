import { assertCashInvariant } from "./errors.js";
import type {
  CashActor,
  CashAuditEvent,
  CashAuditExport,
  CashClosureSummary,
  CashMovement,
  CashMutationResult,
  CashPaymentMethod,
  CashSessionAggregate,
  CashSessionTotals,
  CloseCashSessionInput,
  OpenCashSessionInput,
  ReceiveCashPaymentInput,
  RegisterCashSupplyInput,
  RegisterCashWithdrawalInput,
  StartCashClosureInput
} from "./types.js";

const CASH_METHODS: readonly CashPaymentMethod[] = [
  "DINHEIRO",
  "PIX",
  "CARTAO_CREDITO",
  "CARTAO_DEBITO",
  "OUTRO"
];

export function openCashSession(input: OpenCashSessionInput): CashMutationResult {
  assertCashInvariant(input.cashSessionId.trim().length > 0, "CAIXA_ID_INVALIDO", "cashSessionId e obrigatorio.");
  assertCashInvariant(input.terminalId.trim().length > 0, "TERMINAL_ID_INVALIDO", "terminalId e obrigatorio.");
  assertCashInvariant(input.openingFundAmountCents >= 0, "FUNDO_INICIAL_INVALIDO", "Fundo inicial nao pode ser negativo.");

  const session: CashSessionAggregate = {
    cashSessionId: input.cashSessionId,
    terminalId: input.terminalId,
    openedBy: input.actor,
    openedAt: input.openedAt,
    openingFundAmountCents: input.openingFundAmountCents,
    openingReason: normalizeOptionalReason(input.openingReason),
    status: "ABERTO",
    closingStartedAt: null,
    closedAt: null,
    movements: [],
    closure: null
  };

  return {
    session,
    auditEvents: [
      createCashAuditEvent({
        eventId: input.auditEventId,
        entityId: session.cashSessionId,
        action: "CAIXA_ABERTO",
        actor: input.actor,
        at: input.openedAt,
        payload: {
          openingFundAmountCents: input.openingFundAmountCents,
          openingReason: session.openingReason
        }
      })
    ]
  };
}

export function receiveCashPayment(
  session: CashSessionAggregate,
  input: ReceiveCashPaymentInput
): CashMutationResult {
  assertCashIsOpen(session);
  assertMovementAmount(input.amountCents, "RECEBIMENTO_VALOR_INVALIDO", "Recebimento exige valor positivo.");

  const movement = createMovement({
    movementId: input.movementId,
    type: "RECEBIMENTO",
    method: input.method,
    amountCents: input.amountCents,
    reason: normalizeOptionalReason(input.reason),
    sourceEntity: input.sourceEntity ?? null,
    sourceEntityId: input.sourceEntityId ?? null,
    occurredAt: input.occurredAt,
    actor: input.actor
  });
  const nextSession = appendMovement(session, movement);

  return {
    session: nextSession,
    auditEvents: [
      createCashAuditEvent({
        eventId: input.auditEventId,
        entityId: session.cashSessionId,
        action: "RECEBIMENTO_REGISTRADO",
        actor: input.actor,
        at: input.occurredAt,
        payload: {
          movementId: movement.movementId,
          method: movement.method,
          amountCents: movement.amountCents,
          sourceEntity: movement.sourceEntity,
          sourceEntityId: movement.sourceEntityId
        }
      })
    ]
  };
}

export function registerCashSupply(
  session: CashSessionAggregate,
  input: RegisterCashSupplyInput
): CashMutationResult {
  assertCashIsOpen(session);
  assertMovementAmount(input.amountCents, "SUPRIMENTO_VALOR_INVALIDO", "Suprimento exige valor positivo.");
  const reason = requireReason(input.reason, "SUPRIMENTO_MOTIVO_OBRIGATORIO");

  const movement = createMovement({
    movementId: input.movementId,
    type: "SUPRIMENTO",
    method: "DINHEIRO",
    amountCents: input.amountCents,
    reason,
    sourceEntity: null,
    sourceEntityId: null,
    occurredAt: input.occurredAt,
    actor: input.actor
  });
  const nextSession = appendMovement(session, movement);

  return {
    session: nextSession,
    auditEvents: [
      createCashAuditEvent({
        eventId: input.auditEventId,
        entityId: session.cashSessionId,
        action: "SUPRIMENTO",
        actor: input.actor,
        at: input.occurredAt,
        payload: {
          movementId: movement.movementId,
          amountCents: movement.amountCents,
          reason
        }
      })
    ]
  };
}

export function registerCashWithdrawal(
  session: CashSessionAggregate,
  input: RegisterCashWithdrawalInput
): CashMutationResult {
  assertCashIsOpen(session);
  assertMovementAmount(input.amountCents, "SANGRIA_VALOR_INVALIDO", "Sangria exige valor positivo.");
  const reason = requireReason(input.reason, "SANGRIA_MOTIVO_OBRIGATORIO");

  const currentTotals = calculateCashSessionTotals(session);
  const availableCash = getExpectedByMethod(currentTotals, "DINHEIRO");
  assertCashInvariant(
    input.amountCents <= availableCash,
    "SANGRIA_ACIMA_DO_DISPONIVEL",
    "Sangria nao pode exceder o esperado em dinheiro."
  );

  const movement = createMovement({
    movementId: input.movementId,
    type: "SANGRIA",
    method: "DINHEIRO",
    amountCents: input.amountCents,
    reason,
    sourceEntity: null,
    sourceEntityId: null,
    occurredAt: input.occurredAt,
    actor: input.actor
  });
  const nextSession = appendMovement(session, movement);

  return {
    session: nextSession,
    auditEvents: [
      createCashAuditEvent({
        eventId: input.auditEventId,
        entityId: session.cashSessionId,
        action: "SANGRIA",
        actor: input.actor,
        at: input.occurredAt,
        payload: {
          movementId: movement.movementId,
          amountCents: movement.amountCents,
          reason
        }
      })
    ]
  };
}

export function startCashClosure(
  session: CashSessionAggregate,
  input: StartCashClosureInput
): CashMutationResult {
  assertCashInvariant(session.status === "ABERTO", "CAIXA_NAO_DISPONIVEL_PARA_FECHAMENTO", "Somente caixa ABERTO pode iniciar fechamento.");
  assertCashInvariant(
    input.pendingComandasInPaymentCount === 0,
    "CAIXA_COM_COMANDAS_EM_PAGAMENTO",
    "Fechamento exige zero comandas em pagamento."
  );

  const nextSession: CashSessionAggregate = {
    ...session,
    status: "FECHAMENTO",
    closingStartedAt: input.occurredAt
  };

  return {
    session: nextSession,
    auditEvents: [
      createCashAuditEvent({
        eventId: input.auditEventId,
        entityId: session.cashSessionId,
        action: "CAIXA_FECHAMENTO_INICIADO",
        actor: input.actor,
        at: input.occurredAt,
        payload: {
          pendingComandasInPaymentCount: input.pendingComandasInPaymentCount
        }
      })
    ]
  };
}

export function closeCashSession(
  session: CashSessionAggregate,
  input: CloseCashSessionInput
): CashMutationResult {
  assertCashInvariant(session.status === "FECHAMENTO", "CAIXA_NAO_EM_FECHAMENTO", "Caixa precisa estar em FECHAMENTO para concluir.");

  const totalsBeforeClosure = calculateCashSessionTotals(session);
  const counts = buildCountSummary(input.counts, totalsBeforeClosure);
  const totalCountedAmountCents = counts.reduce((sum, item) => sum + item.countedAmountCents, 0);
  const totalDivergenceAmountCents = counts.reduce((sum, item) => sum + item.divergenceAmountCents, 0);
  const divergenceReason = normalizeOptionalReason(input.divergenceReason);
  const note = normalizeOptionalReason(input.note);

  if (totalDivergenceAmountCents !== 0) {
    assertCashInvariant(
      divergenceReason && divergenceReason.length > 0,
      "CAIXA_DIVERGENCIA_SEM_JUSTIFICATIVA",
      "Divergencia exige justificativa explicita."
    );
  }

  const closure: CashClosureSummary = {
    startedAt: session.closingStartedAt ?? input.occurredAt,
    closedAt: input.occurredAt,
    closedBy: input.actor,
    note,
    divergenceReason,
    counts,
    totalExpectedAmountCents: totalsBeforeClosure.totalExpectedAmountCents,
    totalCountedAmountCents,
    totalDivergenceAmountCents
  };
  const nextSession: CashSessionAggregate = {
    ...session,
    status: "FECHADO",
    closedAt: input.occurredAt,
    closure
  };
  const exportBundle = exportCashSessionAudit(nextSession, [
    createCashAuditEvent({
      eventId: input.auditEventId,
      entityId: session.cashSessionId,
      action: "CAIXA_FECHADO",
      actor: input.actor,
      at: input.occurredAt,
      payload: {
        totalExpectedAmountCents: closure.totalExpectedAmountCents,
        totalCountedAmountCents: closure.totalCountedAmountCents,
        totalDivergenceAmountCents: closure.totalDivergenceAmountCents,
        divergenceReason: closure.divergenceReason,
        note: closure.note
      }
    })
  ]);

  return {
    session: nextSession,
    auditEvents: exportBundle.auditTrail.slice(-1),
    exportBundle
  };
}

export function calculateCashSessionTotals(session: CashSessionAggregate): CashSessionTotals {
  const expectedByMethod = new Map<CashPaymentMethod, number>();

  for (const method of CASH_METHODS) {
    expectedByMethod.set(method, 0);
  }

  expectedByMethod.set("DINHEIRO", session.openingFundAmountCents);

  for (const movement of session.movements) {
    const current = expectedByMethod.get(movement.method) ?? 0;

    switch (movement.type) {
      case "RECEBIMENTO":
      case "SUPRIMENTO":
        expectedByMethod.set(movement.method, current + movement.amountCents);
        break;
      case "SANGRIA":
        expectedByMethod.set(movement.method, current - movement.amountCents);
        break;
    }
  }

  const closureCounts = new Map<CashPaymentMethod, number>();

  for (const method of CASH_METHODS) {
    closureCounts.set(method, 0);
  }

  for (const count of session.closure?.counts ?? []) {
    closureCounts.set(count.method, count.countedAmountCents);
  }

  const byMethod = CASH_METHODS.map((method) => {
    const expectedAmountCents = expectedByMethod.get(method) ?? 0;
    const countedAmountCents = closureCounts.get(method) ?? 0;

    return {
      method,
      expectedAmountCents,
      countedAmountCents,
      divergenceAmountCents: countedAmountCents - expectedAmountCents
    };
  });

  return {
    totalExpectedAmountCents: byMethod.reduce((sum, item) => sum + item.expectedAmountCents, 0),
    totalCountedAmountCents: byMethod.reduce((sum, item) => sum + item.countedAmountCents, 0),
    totalDivergenceAmountCents: byMethod.reduce((sum, item) => sum + item.divergenceAmountCents, 0),
    openingFundAmountCents: session.openingFundAmountCents,
    movementCount: session.movements.length,
    byMethod
  };
}

export function exportCashSessionAudit(
  session: CashSessionAggregate,
  auditTrail: CashAuditEvent[]
): CashAuditExport {
  return {
    session: {
      cashSessionId: session.cashSessionId,
      terminalId: session.terminalId,
      status: session.status,
      openedAt: session.openedAt,
      closedAt: session.closedAt,
      openedByUserId: session.openedBy.userId
    },
    totals: calculateCashSessionTotals(session),
    movements: [...session.movements],
    closure: session.closure,
    auditTrail: [...auditTrail]
  };
}

function createMovement(input: CashMovement): CashMovement {
  assertCashInvariant(input.movementId.trim().length > 0, "CAIXA_MOVIMENTO_ID_INVALIDO", "movementId e obrigatorio.");
  assertCashInvariant(input.amountCents > 0, "CAIXA_MOVIMENTO_VALOR_INVALIDO", "Valor do movimento precisa ser positivo.");

  return input;
}

function appendMovement(session: CashSessionAggregate, movement: CashMovement): CashSessionAggregate {
  return {
    ...session,
    movements: [...session.movements, movement]
  };
}

function createCashAuditEvent(input: Omit<CashAuditEvent, "entity">): CashAuditEvent {
  return {
    entity: "CAIXA",
    ...input
  };
}

function assertCashIsOpen(session: CashSessionAggregate): void {
  assertCashInvariant(session.status === "ABERTO", "CAIXA_FECHADO_PARA_MOVIMENTO", "Movimento exige caixa ABERTO.");
}

function assertMovementAmount(amountCents: number, code: string, message: string): void {
  assertCashInvariant(Number.isInteger(amountCents) && amountCents > 0, code, message);
}

function requireReason(reason: string | null | undefined, code: string): string {
  const normalized = normalizeOptionalReason(reason);
  assertCashInvariant(normalized && normalized.length > 0, code, "Motivo obrigatorio.");
  return normalized;
}

function normalizeOptionalReason(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function buildCountSummary(
  rawCounts: CloseCashSessionInput["counts"],
  totals: CashSessionTotals
) {
  const rawMap = new Map<CashPaymentMethod, number>();

  for (const count of rawCounts) {
    assertCashInvariant(
      Number.isInteger(count.countedAmountCents) && count.countedAmountCents >= 0,
      "CAIXA_CONTAGEM_INVALIDA",
      "Contagem exige valor inteiro maior ou igual a zero."
    );
    rawMap.set(count.method, count.countedAmountCents);
  }

  return totals.byMethod.map((item) => {
    const countedAmountCents = rawMap.get(item.method) ?? 0;

    return {
      method: item.method,
      countedAmountCents,
      expectedAmountCents: item.expectedAmountCents,
      divergenceAmountCents: countedAmountCents - item.expectedAmountCents
    };
  });
}

function getExpectedByMethod(totals: CashSessionTotals, method: CashPaymentMethod): number {
  return totals.byMethod.find((item) => item.method === method)?.expectedAmountCents ?? 0;
}
