export type ComandaStatus =
  | "ABERTA"
  | "EM_PRODUCAO"
  | "EM_PAGAMENTO"
  | "ENCERRADA"
  | "CANCELADA";

export type ComandaItemStatus =
  | "LANCADO"
  | "ENVIADO"
  | "CANCELADO";

export type ComandaPaymentMethod =
  | "DINHEIRO"
  | "CARTAO_CREDITO"
  | "CARTAO_DEBITO"
  | "PIX"
  | "OUTRO";

export type ComandaPaymentStatus = "CONFIRMADO";

export interface ComandaActor {
  userId: string;
  terminalId: string;
  role?: string;
}

export interface ComandaAuditEvent {
  eventId: string;
  entity: "COMANDA" | "ITEM" | "PAGAMENTO";
  entityId: string;
  action: string;
  actor: ComandaActor;
  at: string;
  payload: Record<string, unknown>;
}

export interface ComandaItem {
  itemId: string;
  produtoId: string;
  productLabel: string;
  setor: string;
  quantity: number;
  unitPriceCents: number;
  status: ComandaItemStatus;
  note: string | null;
  createdAt: string;
  sentAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  productionBatchId: string | null;
}

export interface ComandaPayment {
  paymentId: string;
  method: ComandaPaymentMethod;
  amountCents: number;
  status: ComandaPaymentStatus;
  confirmedAt: string;
}

export interface PreContaSnapshotItem {
  itemId: string;
  produtoId: string;
  productLabel: string;
  setor: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  note: string | null;
}

export interface PreContaSnapshot {
  preContaId: string;
  version: number;
  generatedAt: string;
  totalAmountCents: number;
  itemCount: number;
  items: PreContaSnapshotItem[];
}

export interface ProductionBatch {
  batchId: string;
  sentAt: string;
  setores: string[];
  sentItemIds: string[];
}

export interface ComandaAggregate {
  comandaId: string;
  numero: string;
  mesaId: string | null;
  atendimentoRef: string | null;
  cashCheckoutRequestedAt: string | null;
  status: ComandaStatus;
  openedAt: string;
  currentOwnerUserId: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  closedAt: string | null;
  items: ComandaItem[];
  payments: ComandaPayment[];
  preContas: PreContaSnapshot[];
  productionBatches: ProductionBatch[];
}

export interface ComandaTotals {
  itemSubtotalCents: number;
  paidAmountCents: number;
  dueAmountCents: number;
  changeAmountCents: number;
  activeItemCount: number;
  launchedItemCount: number;
  sentItemCount: number;
  cancelledItemCount: number;
}

export interface ComandaMutationResult {
  comanda: ComandaAggregate;
  auditEvents: ComandaAuditEvent[];
  preContaSnapshot?: PreContaSnapshot;
  productionBatch?: ProductionBatch;
}

export interface OpenComandaInput {
  comandaId: string;
  numero: string;
  actor: ComandaActor;
  openedAt: string;
  auditEventId: string;
  mesaId?: string | null;
  atendimentoRef?: string | null;
  currentOwnerUserId?: string | null;
}

export interface AddComandaItemInput {
  itemId: string;
  produtoId: string;
  productLabel: string;
  setor: string;
  quantity: number;
  unitPriceCents: number;
  actor: ComandaActor;
  occurredAt: string;
  auditEventId: string;
  note?: string | null;
}

export interface CancelComandaItemInput {
  itemId: string;
  reason: string;
  actor: ComandaActor;
  occurredAt: string;
  auditEventId: string;
}

export interface SendToProductionInput {
  batchId: string;
  actor: ComandaActor;
  occurredAt: string;
  auditEventId: string;
}

export interface GeneratePreContaInput {
  preContaId: string;
  actor: ComandaActor;
  occurredAt: string;
  auditEventId: string;
}

export interface RequestComandaCashCheckoutInput {
  actor: ComandaActor;
  occurredAt: string;
  auditEventId: string;
}

export interface CheckoutPaymentInput {
  paymentId: string;
  method: ComandaPaymentMethod;
  amountCents: number;
}

export interface CheckoutComandaInput {
  actor: ComandaActor;
  occurredAt: string;
  auditEventId: string;
  payments: CheckoutPaymentInput[];
}

export interface CancelComandaInput {
  reason: string;
  actor: ComandaActor;
  occurredAt: string;
  auditEventId: string;
}

export interface ReopenComandaInput {
  actor: ComandaActor;
  occurredAt: string;
  auditEventId: string;
}
