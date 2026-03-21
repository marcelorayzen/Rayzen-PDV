import type { ComandaPaymentMethod } from "../comanda/types.js";

export type CashSessionStatus =
  | "ABERTO"
  | "FECHAMENTO"
  | "FECHADO";

export type CashMovementType =
  | "RECEBIMENTO"
  | "SANGRIA"
  | "SUPRIMENTO";

export type CashPaymentMethod = ComandaPaymentMethod;

export interface CashActor {
  userId: string;
  terminalId: string;
  role?: string;
}

export interface CashAuditEvent {
  eventId: string;
  entity: "CAIXA";
  entityId: string;
  action: string;
  actor: CashActor;
  at: string;
  payload: Record<string, unknown>;
}

export interface CashMovement {
  movementId: string;
  type: CashMovementType;
  method: CashPaymentMethod;
  amountCents: number;
  reason: string | null;
  sourceEntity: string | null;
  sourceEntityId: string | null;
  occurredAt: string;
  actor: CashActor;
}

export interface CashCountedAmount {
  method: CashPaymentMethod;
  countedAmountCents: number;
  expectedAmountCents: number;
  divergenceAmountCents: number;
}

export interface CashClosureSummary {
  startedAt: string;
  closedAt: string;
  closedBy: CashActor;
  note: string | null;
  divergenceReason: string | null;
  counts: CashCountedAmount[];
  totalExpectedAmountCents: number;
  totalCountedAmountCents: number;
  totalDivergenceAmountCents: number;
}

export interface CashSessionAggregate {
  cashSessionId: string;
  terminalId: string;
  openedBy: CashActor;
  openedAt: string;
  openingFundAmountCents: number;
  openingReason: string | null;
  status: CashSessionStatus;
  closingStartedAt: string | null;
  closedAt: string | null;
  movements: CashMovement[];
  closure: CashClosureSummary | null;
}

export interface CashMethodTotal {
  method: CashPaymentMethod;
  expectedAmountCents: number;
  countedAmountCents: number;
  divergenceAmountCents: number;
}

export interface CashSessionTotals {
  totalExpectedAmountCents: number;
  totalCountedAmountCents: number;
  totalDivergenceAmountCents: number;
  openingFundAmountCents: number;
  movementCount: number;
  byMethod: CashMethodTotal[];
}

export interface CashAuditExport {
  session: {
    cashSessionId: string;
    terminalId: string;
    status: CashSessionStatus;
    openedAt: string;
    closedAt: string | null;
    openedByUserId: string;
  };
  totals: CashSessionTotals;
  movements: CashMovement[];
  closure: CashClosureSummary | null;
  auditTrail: CashAuditEvent[];
}

export interface CashMutationResult {
  session: CashSessionAggregate;
  auditEvents: CashAuditEvent[];
  exportBundle?: CashAuditExport;
}

export interface OpenCashSessionInput {
  cashSessionId: string;
  terminalId: string;
  actor: CashActor;
  openedAt: string;
  auditEventId: string;
  openingFundAmountCents: number;
  openingReason?: string | null;
}

export interface ReceiveCashPaymentInput {
  movementId: string;
  actor: CashActor;
  occurredAt: string;
  auditEventId: string;
  method: CashPaymentMethod;
  amountCents: number;
  sourceEntity?: string | null;
  sourceEntityId?: string | null;
  reason?: string | null;
}

export interface RegisterCashSupplyInput {
  movementId: string;
  actor: CashActor;
  occurredAt: string;
  auditEventId: string;
  amountCents: number;
  reason: string;
}

export interface RegisterCashWithdrawalInput {
  movementId: string;
  actor: CashActor;
  occurredAt: string;
  auditEventId: string;
  amountCents: number;
  reason: string;
}

export interface StartCashClosureInput {
  actor: CashActor;
  occurredAt: string;
  auditEventId: string;
  pendingComandasInPaymentCount: number;
}

export interface CloseCashSessionInput {
  actor: CashActor;
  occurredAt: string;
  auditEventId: string;
  counts: Array<{
    method: CashPaymentMethod;
    countedAmountCents: number;
  }>;
  note?: string | null;
  divergenceReason?: string | null;
}
