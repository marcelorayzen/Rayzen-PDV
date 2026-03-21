export type SqliteJournalMode = "enabled" | "disabled";

export interface DatabaseConfig {
  filePath: string;
  migrationsDir?: string;
  walMode?: SqliteJournalMode;
  busyTimeoutMs?: number;
  foreignKeys?: boolean;
}

export interface ResolvedDatabaseConfig {
  filePath: string;
  migrationsDir: string;
  walMode: SqliteJournalMode;
  busyTimeoutMs: number;
  foreignKeys: boolean;
}

export interface MigrationDefinition {
  version: string;
  name: string;
  directoryPath: string;
  upSql: string;
  downSql: string;
}

export interface AppliedMigration {
  version: string;
  name: string;
  appliedAt: string;
}

export interface MigrationPlan {
  applied: AppliedMigration[];
  pending: MigrationDefinition[];
}

export interface AuditEventRecord {
  eventId: string;
  entity: string;
  entityId: string;
  action: string;
  actorUserId: string | null;
  actorTerminalId: string | null;
  actorRole: string | null;
  occurredAt: string;
  payload: JsonValue;
  createdAt: string;
}

export interface AuditEventInput {
  eventId: string;
  entity: string;
  entityId: string;
  action: string;
  actorUserId?: string | null;
  actorTerminalId?: string | null;
  actorRole?: string | null;
  occurredAt: string;
  payload?: JsonValue;
}

export type OperatorRole =
  | "GERENTE"
  | "CAIXA"
  | "GARCOM";

export interface OperatorRecord {
  operatorId: string;
  operatorCode: string;
  nome: string;
  pinHash: string;
  role: OperatorRole;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SaveOperatorInput {
  operator: Omit<OperatorRecord, "createdAt" | "updatedAt">;
}

export interface OperatorSessionRecord {
  terminalId: string;
  operatorId: string;
  loginAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersistedOperatorSession {
  session: OperatorSessionRecord;
  operator: OperatorRecord;
}

export interface OperatorSessionInput {
  terminalId: string;
  operatorId: string;
  loginAt: string;
}

export interface ProductRecord {
  productId: string;
  nome: string;
  precoCents: number;
  categoria: string;
  setor: string;
  shortcutHint: string;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SaveProductInput {
  product: Omit<ProductRecord, "createdAt" | "updatedAt">;
}

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

export type ComandaPaymentStatus = "CONFIRMADO";

export interface ComandaRecord {
  comandaId: string;
  numero: string;
  mesaId: string | null;
  atendimentoRef: string | null;
  status: ComandaStatus;
  currentOwnerUserId: string | null;
  openedAt: string;
  closedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  subtotalAmountCents: number;
  paidAmountCents: number;
  changeAmountCents: number;
  productionBatches: JsonValue;
  createdAt: string;
  updatedAt: string;
}

export interface ComandaItemRecord {
  itemId: string;
  comandaId: string;
  produtoId: string;
  productLabel: string;
  setor: string;
  quantity: number;
  unitPriceCents: number;
  status: ComandaItemStatus;
  note: string | null;
  productionBatchId: string | null;
  createdAt: string;
  sentAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  updatedAt: string;
}

export interface ComandaPaymentRecord {
  paymentId: string;
  comandaId: string;
  method: string;
  amountCents: number;
  status: ComandaPaymentStatus;
  confirmedAt: string;
  createdAt: string;
}

export interface ComandaPreContaRecord {
  preContaId: string;
  comandaId: string;
  version: number;
  totalAmountCents: number;
  snapshot: JsonValue;
  generatedAt: string;
  createdAt: string;
}

export interface PersistedComandaAggregate {
  comanda: ComandaRecord;
  items: ComandaItemRecord[];
  payments: ComandaPaymentRecord[];
  preContas: ComandaPreContaRecord[];
}

export interface SaveComandaAggregateInput {
  comanda: Omit<ComandaRecord, "createdAt" | "updatedAt">;
  items: Omit<ComandaItemRecord, "updatedAt">[];
  payments: Omit<ComandaPaymentRecord, "createdAt">[];
  preContas: Omit<ComandaPreContaRecord, "createdAt">[];
  auditEvents?: AuditEventInput[];
}

export type CashSessionStatus =
  | "ABERTO"
  | "FECHAMENTO"
  | "FECHADO";

export type CashMovementType =
  | "RECEBIMENTO"
  | "SANGRIA"
  | "SUPRIMENTO";

export type CashPaymentMethod =
  | "DINHEIRO"
  | "CARTAO_CREDITO"
  | "CARTAO_DEBITO"
  | "PIX"
  | "OUTRO";

export interface CashSessionRecord {
  cashSessionId: string;
  terminalId: string;
  openedByUserId: string;
  openedByTerminalId: string;
  openedByRole: string | null;
  openedAt: string;
  openingFundAmountCents: number;
  openingReason: string | null;
  status: CashSessionStatus;
  closingStartedAt: string | null;
  closedAt: string | null;
  closedByUserId: string | null;
  closedByTerminalId: string | null;
  closedByRole: string | null;
  closureNote: string | null;
  divergenceReason: string | null;
  closureSummary: JsonValue;
  createdAt: string;
  updatedAt: string;
}

export interface CashMovementRecord {
  cashMovementId: string;
  cashSessionId: string;
  movementType: CashMovementType;
  paymentMethod: CashPaymentMethod;
  amountCents: number;
  reason: string | null;
  sourceEntity: string | null;
  sourceEntityId: string | null;
  occurredAt: string;
  actorUserId: string;
  actorTerminalId: string;
  actorRole: string | null;
  createdAt: string;
}

export interface PersistedCashSessionAggregate {
  session: CashSessionRecord;
  movements: CashMovementRecord[];
}

export interface SaveCashSessionAggregateInput {
  session: Omit<CashSessionRecord, "createdAt" | "updatedAt">;
  movements: Omit<CashMovementRecord, "createdAt">[];
  auditEvents?: AuditEventInput[];
}

export interface PrintSectorRoutingRecord {
  setor: string;
  printerName: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavePrintSectorRoutingInput {
  route: Omit<PrintSectorRoutingRecord, "createdAt" | "updatedAt">;
}

export type PrintJobStatus =
  | "QUEUED"
  | "PRINTING"
  | "WAITING_PRINTER"
  | "NEEDS_ATTENTION"
  | "DONE";

export type PrintTicketKind =
  | "PRODUCAO"
  | "SEGUNDA_VIA";

export interface PrintJobRecord {
  printJobId: string;
  sourceEntity: string | null;
  sourceEntityId: string | null;
  setor: string;
  status: PrintJobStatus;
  ticketKind: PrintTicketKind;
  dedupKey: string | null;
  printerTargetId: string | null;
  printerTargetName: string | null;
  secondCopyOfJobId: string | null;
  payload: JsonValue;
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

export interface PrintJobInput {
  printJobId: string;
  sourceEntity?: string | null;
  sourceEntityId?: string | null;
  setor: string;
  status?: PrintJobStatus;
  ticketKind?: PrintTicketKind;
  dedupKey?: string | null;
  printerTargetId?: string | null;
  printerTargetName?: string | null;
  secondCopyOfJobId?: string | null;
  payload: JsonValue;
  nextRetryAt?: string | null;
}

export interface PrintJobAttemptInput {
  printJobId: string;
  status: PrintJobStatus;
  incrementAttempts?: boolean;
  incrementSecondCopyCount?: boolean;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  nextRetryAt?: string | null;
  lastAttemptAt?: string | null;
  leaseExpiresAt?: string | null;
  printedAt?: string | null;
}

export type FiscalProvider = "NS_TECNOLOGIA";
export type FiscalEnvironment = "HOMOLOGACAO" | "PRODUCAO";
export type FiscalStateCode = "SP";
export type FiscalDocumentModel = "65";
export type FiscalCertificateKind = "E_CNPJ_A1";
export type FiscalEmissionMode = "NORMAL" | "CONTINGENCY_OFFLINE";
export type FiscalEmitterStatus =
  | "PENDENTE_CONFIGURACAO"
  | "CONFIGURADO"
  | "HABILITADO"
  | "BLOQUEADO";
export type FiscalQueueStatus =
  | "DRAFT"
  | "SIGNED"
  | "SENT"
  | "AUTHORIZED"
  | "CONTINGENCY"
  | "REJECTED";

export interface FiscalEmitterRecord {
  emitterId: string;
  provider: FiscalProvider;
  environment: FiscalEnvironment;
  stateCode: FiscalStateCode;
  documentModel: FiscalDocumentModel;
  certificateKind: FiscalCertificateKind;
  legalName: string;
  tradeName: string | null;
  cnpj: string;
  stateRegistration: string;
  cscId: string;
  certificateSubject: string | null;
  certificateValidFrom: string | null;
  certificateValidUntil: string | null;
  status: FiscalEmitterStatus;
  settings: JsonValue;
  createdAt: string;
  updatedAt: string;
}

export interface SaveFiscalEmitterInput {
  emitter: Omit<FiscalEmitterRecord, "createdAt" | "updatedAt">;
  auditEvents?: AuditEventInput[];
}

export interface FiscalDocumentRecord {
  fiscalDocId: string;
  emitterId: string;
  terminalId: string;
  referenceType: string;
  referenceId: string;
  provider: FiscalProvider;
  environment: FiscalEnvironment;
  stateCode: FiscalStateCode;
  documentModel: FiscalDocumentModel;
  serie: string;
  numero: number;
  accessKey: string | null;
  nsReferenceId: string | null;
  status: FiscalQueueStatus;
  emissionMode: FiscalEmissionMode;
  contingencyRequired: boolean;
  contingencyStartedAt: string | null;
  contingencyJustification: string | null;
  contingencyPrintedAt: string | null;
  contingencyDanfePath: string | null;
  payload: JsonValue;
  response: JsonValue;
  xmlStoragePath: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  issuedAt: string | null;
  authorizedAt: string | null;
  lastStatusCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FiscalDocumentEventRecord {
  fiscalEventId: string;
  fiscalDocId: string;
  emitterId: string;
  eventType: string;
  status: FiscalQueueStatus;
  provider: FiscalProvider;
  providerReferenceId: string | null;
  occurredAt: string;
  payload: JsonValue;
  createdAt: string;
}

export interface PersistedFiscalDocumentTrail {
  document: FiscalDocumentRecord;
  queue: FiscalQueueRecord | null;
  events: FiscalDocumentEventRecord[];
}

export interface SaveFiscalDocumentDraftInput {
  document: Omit<FiscalDocumentRecord, "createdAt" | "updatedAt">;
  queue: Omit<FiscalQueueRecord, "attempts" | "lastErrorCode" | "lastErrorMessage" | "createdAt" | "updatedAt">;
  initialEvent: Omit<FiscalDocumentEventRecord, "createdAt">;
  auditEvents?: AuditEventInput[];
}

export interface AppendFiscalDocumentStateInput {
  fiscalDocId: string;
  fiscalQueueId: string;
  status: FiscalQueueStatus;
  event: Omit<FiscalDocumentEventRecord, "createdAt" | "fiscalDocId"> & { fiscalDocId?: string };
  providerReferenceId?: string | null;
  accessKey?: string | null;
  response?: JsonValue;
  xmlStoragePath?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  nextRetryAt?: string | null;
  issuedAt?: string | null;
  authorizedAt?: string | null;
  contingencyRequired?: boolean;
  emissionMode?: FiscalEmissionMode;
  contingencyStartedAt?: string | null;
  contingencyJustification?: string | null;
  contingencyPrintedAt?: string | null;
  contingencyDanfePath?: string | null;
  lastStatusCheckedAt?: string | null;
  leaseExpiresAt?: string | null;
  auditEvents?: AuditEventInput[];
}

export interface ClaimFiscalQueueInput {
  asOf: string;
  leaseExpiresAt: string;
}

export interface FiscalQueueRecord {
  fiscalQueueId: string;
  fiscalDocId: string;
  emitterId: string | null;
  terminalId: string | null;
  provider: FiscalProvider;
  environment: FiscalEnvironment;
  stateCode: FiscalStateCode;
  documentModel: FiscalDocumentModel;
  documentType: string;
  referenceType: string | null;
  referenceId: string | null;
  serie: string | null;
  numero: number | null;
  accessKey: string | null;
  status: FiscalQueueStatus;
  emissionMode: FiscalEmissionMode;
  dedupKey: string | null;
  payload: JsonValue;
  context: JsonValue;
  attempts: number;
  contingencyRequired: boolean;
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

export interface FiscalQueueInput {
  fiscalQueueId: string;
  fiscalDocId: string;
  emitterId?: string | null;
  terminalId?: string | null;
  provider: FiscalProvider;
  environment?: FiscalEnvironment;
  stateCode?: FiscalStateCode;
  documentModel?: FiscalDocumentModel;
  documentType: string;
  referenceType?: string | null;
  referenceId?: string | null;
  serie?: string | null;
  numero?: number | null;
  accessKey?: string | null;
  status?: FiscalQueueStatus;
  emissionMode?: FiscalEmissionMode;
  dedupKey?: string | null;
  payload: JsonValue;
  context?: JsonValue;
  contingencyRequired?: boolean;
  contingencyStartedAt?: string | null;
  providerReferenceId?: string | null;
  leaseExpiresAt?: string | null;
  nextRetryAt?: string | null;
  issuedAt?: string | null;
  authorizedAt?: string | null;
  lastStatusCheckedAt?: string | null;
}

export interface FiscalQueueAttemptInput {
  fiscalQueueId: string;
  status: FiscalQueueStatus;
  incrementAttempts?: boolean;
  contingencyRequired?: boolean;
  emissionMode?: FiscalEmissionMode;
  contingencyStartedAt?: string | null;
  providerReferenceId?: string | null;
  leaseExpiresAt?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  nextRetryAt?: string | null;
  issuedAt?: string | null;
  authorizedAt?: string | null;
  accessKey?: string | null;
  lastStatusCheckedAt?: string | null;
}

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export interface JsonObject {
  [key: string]: JsonValue;
}
export type JsonArray = JsonValue[];
