import type {
  AuthenticationResult,
  CatalogProduct,
  CashAuditEvent,
  CashAuditExport,
  CashPaymentMethod,
  CashSessionAggregate,
  ComandaActor,
  ComandaAggregate,
  ComandaAuditEvent,
  ComandaPaymentMethod,
  OperatorSession,
  PreContaSnapshot
} from "../domain/index.js";

export interface MainBootstrapSnapshot {
  appVersion: string;
  environment: string;
  offlineFirst: true;
  httpApiEnabled: false;
  ipcMode: "electron-ipc";
  databaseReady: boolean;
  logFilePath: string;
}

export interface MainHealthSnapshot {
  ready: true;
  databaseReady: boolean;
  httpApiEnabled: false;
  ipcMode: "electron-ipc";
  dbFilePath: string;
  logFilePath: string;
}

export interface InstallationStatusSnapshot {
  firstRunPending: boolean;
  configFilePath: string;
  appVersion: string;
  completedAt: string | null;
  company: {
    legalName: string;
    tradeName: string | null;
    document: string | null;
    logoFilePath?: string | null;
  } | null;
  printRoutes: Array<{
    setor: string;
    impressoras: string[];
  }>;
  seedState: {
    adminReady: boolean;
    productCount: number;
    printRouteCount: number;
  };
}

export interface CompleteFirstRunRequest {
  companyLegalName: string;
  companyTradeName?: string | null;
  companyDocument?: string | null;
  companyLogoFilePath?: string | null;
  printers: {
    cozinha: string;
    bar: string;
    caixa: string;
  };
  occurredAt: string;
}

export interface UpdateBrandLogoRequest {
  companyLogoFilePath?: string | null;
  occurredAt: string;
}

export interface ComandaWorkspaceSnapshot {
  currentComanda: ComandaAggregate | null;
  activeComandas: ComandaAggregate[];
  mesaGroups: ComandaMesaGroupSnapshot[];
  auditTrail: ComandaAuditEvent[];
  lastPreContaSnapshot: PreContaSnapshot | null;
}

export interface ComandaMesaGroupSnapshot {
  mesaId: string | null;
  comandas: ComandaAggregate[];
  comandaCount: number;
  itemCount: number;
  totalAmountCents: number;
  paidAmountCents: number;
  dueAmountCents: number;
  statuses: ComandaAggregate["status"][];
}

export interface CashWorkspaceSnapshot {
  currentSession: CashSessionAggregate | null;
  auditTrail: CashAuditEvent[];
  auditExport: CashAuditExport | null;
}

export type CashStatusSnapshot = CashWorkspaceSnapshot;
export type CashSummarySnapshot = CashAuditExport | null;

export interface OperationalSnapshot {
  comanda: ComandaWorkspaceSnapshot;
  cash: CashWorkspaceSnapshot;
}

export interface AuthLoginRequest {
  pin: string;
  terminalId?: string | null;
}

export interface AuthLogoutRequest {
  terminalId?: string | null;
}

export type AuthLoginResult = AuthenticationResult;
export type AuthSessionSnapshot = OperatorSession;
export type CatalogProductSnapshot = CatalogProduct;

export interface CatalogGetProductRequest {
  productId: string;
}

export interface CatalogUpsertProductRequest {
  nome: string;
  categoria: string;
  setor: string;
  precoCents: number;
  shortcutHint: string;
  productId?: string | null;
}

export interface GetComandaWorkspaceRequest {
  comandaId: string;
}

export interface FiscalDocumentSnapshot {
  fiscalDocId: string;
  emitterId: string;
  terminalId: string;
  referenceType: string;
  referenceId: string;
  provider: "NS_TECNOLOGIA";
  environment: "HOMOLOGACAO" | "PRODUCAO";
  stateCode: "SP";
  documentModel: "65";
  serie: string;
  numero: number;
  accessKey: string | null;
  nsReferenceId: string | null;
  status: "DRAFT" | "SIGNED" | "SENT" | "AUTHORIZED" | "CONTINGENCY" | "REJECTED";
  emissionMode: "NORMAL" | "CONTINGENCY_OFFLINE";
  contingencyRequired: boolean;
  contingencyStartedAt: string | null;
  contingencyJustification: string | null;
  contingencyPrintedAt: string | null;
  contingencyDanfePath: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  issuedAt: string | null;
  authorizedAt: string | null;
  lastStatusCheckedAt: string | null;
  xmlStoragePath: string | null;
  updatedAt: string;
}

export interface FiscalQueueJobSnapshot {
  fiscalQueueId: string;
  fiscalDocId: string;
  emitterId: string | null;
  terminalId: string | null;
  referenceType: string | null;
  referenceId: string | null;
  provider: "NS_TECNOLOGIA";
  environment: "HOMOLOGACAO" | "PRODUCAO";
  documentModel: "65";
  status: "DRAFT" | "SIGNED" | "SENT" | "AUTHORIZED" | "CONTINGENCY" | "REJECTED";
  emissionMode: "NORMAL" | "CONTINGENCY_OFFLINE";
  attempts: number;
  contingencyRequired: boolean;
  contingencyStartedAt: string | null;
  leaseExpiresAt: string | null;
  nextRetryAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  issuedAt: string | null;
  authorizedAt: string | null;
  lastStatusCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FiscalStatusSnapshot {
  emitters: Array<{
    emitterId: string;
    provider: "NS_TECNOLOGIA";
    environment: "HOMOLOGACAO" | "PRODUCAO";
    stateCode: "SP";
    documentModel: "65";
    legalName: string;
    cnpj: string;
    stateRegistration: string;
    cscId: string;
    certificateSubject: string | null;
    certificateValidFrom: string | null;
    certificateValidUntil: string | null;
    status: "PENDENTE_CONFIGURACAO" | "CONFIGURADO" | "HABILITADO" | "BLOQUEADO";
    hasSecrets: boolean;
    updatedAt: string;
  }>;
  pendingQueue: FiscalQueueJobSnapshot[];
  recentDocuments: FiscalDocumentSnapshot[];
}

export interface GetFiscalDocumentStatusRequest {
  fiscalDocId: string;
}

export interface ListPendingFiscalQueueRequest {
  limit?: number;
}

export interface ProcessFiscalQueueRequest {
  limit?: number;
  asOf?: string;
}

export interface ProcessFiscalQueueResult {
  processedCount: number;
  authorizedCount: number;
  rejectedCount: number;
  pendingCount: number;
  contingencyCount: number;
  jobs: FiscalQueueJobSnapshot[];
}

export interface QueryFiscalStatusByAccessKeyRequest {
  accessKey: string;
  actor: ComandaActor;
  asOf?: string;
}

export interface PrintSpoolJobSnapshot {
  printJobId: string;
  sourceEntity: string | null;
  sourceEntityId: string | null;
  setor: string;
  status: "QUEUED" | "PRINTING" | "WAITING_PRINTER" | "NEEDS_ATTENTION" | "DONE";
  ticketKind: "PRODUCAO" | "SEGUNDA_VIA";
  printerTargetId: string | null;
  printerTargetName: string | null;
  secondCopyOfJobId: string | null;
  attempts: number;
  secondCopyCount: number;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  nextRetryAt: string | null;
  lastAttemptAt: string | null;
  printedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PrintSpoolStatusSnapshot {
  routes: Array<{
    setor: string;
    impressoras: string[];
  }>;
  pendingJobs: PrintSpoolJobSnapshot[];
}

export interface PrintDriverPrinterSnapshot {
  printerId: string;
  printerName: string;
  isOffline: boolean;
  isAvailable: boolean;
  status: string | null;
}

export interface ListPrintJobsRequest {
  limit?: number;
}

export interface ReprocessPrintJobRequest {
  printJobId: string;
  requestedAt: string;
  actor: ComandaActor;
  reason: string;
}

export interface OpenComandaRequest {
  numero: string;
  mesaId?: string | null;
  actor: ComandaActor;
}

export interface AddComandaItemRequest {
  comandaId: string;
  produtoId: string;
  productLabel: string;
  setor: string;
  quantity: number;
  unitPriceCents: number;
  note?: string | null;
  actor: ComandaActor;
}

export interface CancelComandaItemRequest {
  comandaId: string;
  itemId: string;
  reason: string;
  actor: ComandaActor;
}

export interface SendComandaToProductionRequest {
  comandaId: string;
  actor: ComandaActor;
}

export interface StartComandaCheckoutRequest {
  comandaId: string;
  actor: ComandaActor;
}

export interface ReopenComandaRequest {
  comandaId: string;
  actor: ComandaActor;
}

export interface RequestComandaCashCheckoutRequest {
  comandaId: string;
  actor: ComandaActor;
}

export interface ConfirmComandaPaymentRequest {
  comandaId: string;
  paymentMethod: ComandaPaymentMethod;
  amountCents: number;
  actor: ComandaActor;
}

export interface OpenCashSessionRequest {
  openingFundAmountCents: number;
  openingReason?: string | null;
  actor: ComandaActor;
}

export interface RegisterCashMovementRequest {
  method: CashPaymentMethod;
  amountCents: number;
  reason?: string | null;
  actor: ComandaActor;
}

export interface RegisterCashSupplyRequest {
  amountCents: number;
  reason: string;
  actor: ComandaActor;
}

export interface RegisterCashWithdrawalRequest {
  amountCents: number;
  reason: string;
  actor: ComandaActor;
}

export interface StartCashClosureRequest {
  actor: ComandaActor;
}

export interface CloseCashSessionRequest {
  counts: Array<{
    method: CashPaymentMethod;
    countedAmountCents: number;
  }>;
  note?: string | null;
  divergenceReason?: string | null;
  actor: ComandaActor;
}

import type { OperatorRecord } from "../domain/shell-state.js";

export type OperatorSnapshot = OperatorRecord;

export interface SaveOperatorRequest {
  operatorId?: string | null;
  operatorCode: string;
  nome: string;
  pin: string;
  role: "GERENTE" | "CAIXA" | "GARCOM";
  ativo: boolean;
}

export interface WaiterServerStatusSnapshot {
  running: boolean;
  port: number;
  localIp: string | null;
  url: string | null;
}

export interface RayzenDesktopApi {
  system: {
    getBootstrap(): Promise<MainBootstrapSnapshot>;
    getHealth(): Promise<MainHealthSnapshot>;
  };
  setup: {
    getStatus(): Promise<InstallationStatusSnapshot>;
    completeFirstRun(request: CompleteFirstRunRequest): Promise<InstallationStatusSnapshot>;
    updateBrandLogo(request: UpdateBrandLogoRequest): Promise<InstallationStatusSnapshot>;
  };
  auth: {
    login(request: AuthLoginRequest): Promise<AuthLoginResult>;
    logout(request?: AuthLogoutRequest): Promise<void>;
    getSession(): Promise<AuthSessionSnapshot | null>;
  };
  catalog: {
    listProducts(): Promise<CatalogProductSnapshot[]>;
    getProduct(request: CatalogGetProductRequest): Promise<CatalogProductSnapshot | null>;
    upsertProduct(request: CatalogUpsertProductRequest): Promise<CatalogProductSnapshot>;
  };
  fiscal: {
    getStatus(): Promise<FiscalStatusSnapshot>;
    getDocumentStatus(request: GetFiscalDocumentStatusRequest): Promise<FiscalDocumentSnapshot | null>;
    listPending(request?: ListPendingFiscalQueueRequest): Promise<FiscalQueueJobSnapshot[]>;
    reprocess(request?: ProcessFiscalQueueRequest): Promise<ProcessFiscalQueueResult>;
    queryStatusByAccessKey(request: QueryFiscalStatusByAccessKeyRequest): Promise<FiscalDocumentSnapshot>;
  };
  print: {
    getStatus(): Promise<PrintSpoolStatusSnapshot>;
    listJobs(request?: ListPrintJobsRequest): Promise<PrintSpoolJobSnapshot[]>;
    listPrinters(): Promise<PrintDriverPrinterSnapshot[]>;
    reprocessJob(request: ReprocessPrintJobRequest): Promise<PrintSpoolJobSnapshot>;
  };
  pdv: {
    getOperationalSnapshot(): Promise<OperationalSnapshot>;
    getComandaWorkspace(request: GetComandaWorkspaceRequest): Promise<ComandaWorkspaceSnapshot>;
    openComanda(request: OpenComandaRequest): Promise<ComandaWorkspaceSnapshot>;
    addComandaItem(request: AddComandaItemRequest): Promise<ComandaWorkspaceSnapshot>;
    cancelComandaItem(request: CancelComandaItemRequest): Promise<ComandaWorkspaceSnapshot>;
    sendComandaToProduction(request: SendComandaToProductionRequest): Promise<ComandaWorkspaceSnapshot>;
    startComandaCheckout(request: StartComandaCheckoutRequest): Promise<ComandaWorkspaceSnapshot>;
    reopenComanda(request: ReopenComandaRequest): Promise<ComandaWorkspaceSnapshot>;
    requestComandaCashCheckout(request: RequestComandaCashCheckoutRequest): Promise<ComandaWorkspaceSnapshot>;
    confirmComandaPayment(request: ConfirmComandaPaymentRequest): Promise<OperationalSnapshot>;
    openCashSession(request: OpenCashSessionRequest): Promise<CashWorkspaceSnapshot>;
    registerCashReceipt(request: RegisterCashMovementRequest): Promise<CashWorkspaceSnapshot>;
    registerCashSupply(request: RegisterCashSupplyRequest): Promise<CashWorkspaceSnapshot>;
    registerCashWithdrawal(request: RegisterCashWithdrawalRequest): Promise<CashWorkspaceSnapshot>;
    startCashClosure(request: StartCashClosureRequest): Promise<CashWorkspaceSnapshot>;
    closeCashSession(request: CloseCashSessionRequest): Promise<CashWorkspaceSnapshot>;
    exportCashAudit(): Promise<CashWorkspaceSnapshot>;
  };
  cash: {
    open(request: OpenCashSessionRequest): Promise<CashWorkspaceSnapshot>;
    status(): Promise<CashStatusSnapshot>;
    sangria(request: RegisterCashWithdrawalRequest): Promise<CashWorkspaceSnapshot>;
    suprimento(request: RegisterCashSupplyRequest): Promise<CashWorkspaceSnapshot>;
    fechar(request: CloseCashSessionRequest): Promise<CashWorkspaceSnapshot>;
    resumo(): Promise<CashSummarySnapshot>;
  };
  team: {
    listOperators(): Promise<OperatorSnapshot[]>;
    saveOperator(request: SaveOperatorRequest): Promise<OperatorSnapshot>;
  };
  waiter: {
    getStatus(): Promise<WaiterServerStatusSnapshot>;
  };
}
