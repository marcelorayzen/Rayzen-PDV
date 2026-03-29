import type {
  AppliedMigration,
  FiscalDocumentModel,
  FiscalEnvironment,
  FiscalEmitterStatus,
  FiscalProvider,
  FiscalQueueStatus,
  FiscalStateCode,
  SqliteJournalMode
} from "@rayzen/db";
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
} from "@rayzen/pdv";

import type { MainProcessPaths } from "../main/paths.js";

export const IPC_CHANNELS = {
  systemGetBootstrap: "rayzen/system/get-bootstrap",
  systemGetHealth: "rayzen/system/get-health",
  systemExportLogs: "rayzen/system/export-logs",
  systemCreateBackup: "rayzen/system/create-backup",
  systemRestoreBackup: "rayzen/system/restore-backup",
  backupCreate: "rayzen/backup/create",
  backupList: "rayzen/backup/list",
  backupRestore: "rayzen/backup/restore",
  setupGetStatus: "rayzen/setup/get-status",
  setupCompleteFirstRun: "rayzen/setup/complete-first-run",
  setupUpdateBrandLogo: "rayzen/setup/update-brand-logo",
  dbGetStatus: "rayzen/db/get-status",
  authLogin: "rayzen/auth/login",
  authLogout: "rayzen/auth/logout",
  authGetSession: "rayzen/auth/get-session",
  catalogListProducts: "rayzen/catalog/list-products",
  catalogGetProduct: "rayzen/catalog/get-product",
  catalogUpsertProduct: "rayzen/catalog/upsert-product",
  fiscalGetStatus: "rayzen/fiscal/get-status",
  fiscalGetDocumentStatus: "rayzen/fiscal/get-document-status",
  fiscalListPending: "rayzen/fiscal/list-pending",
  fiscalConfigureEmitter: "rayzen/fiscal/configure-emitter",
  fiscalQueueNfce: "rayzen/fiscal/queue-nfce",
  fiscalProcessQueue: "rayzen/fiscal/process-queue",
  fiscalReprocess: "rayzen/fiscal/reprocess",
  fiscalQueryStatusByAccessKey: "rayzen/fiscal/query-status-by-access-key",
  printGetStatus: "rayzen/print/get-status",
  printListJobs: "rayzen/print/list-jobs",
  printListPrinters: "rayzen/print/list-printers",
  printEnqueueProduction: "rayzen/print/enqueue-production",
  printProcessQueue: "rayzen/print/process-queue",
  printReprocessJob: "rayzen/print/reprocess-job",
  printReprintSecondCopy: "rayzen/print/reprint-second-copy",
  pdvGetOperationalSnapshot: "rayzen/pdv/get-operational-snapshot",
  comandaGetWorkspace: "rayzen/comanda/get-workspace",
  comandaOpen: "rayzen/comanda/open",
  comandaAddItem: "rayzen/comanda/add-item",
  comandaCancelItem: "rayzen/comanda/cancel-item",
  comandaSendToProduction: "rayzen/comanda/send-to-production",
  comandaStartCheckout: "rayzen/comanda/start-checkout",
  comandaReopenComanda: "rayzen/comanda/reopen",
  comandaRequestCashCheckout: "rayzen/comanda/request-cash-checkout",
  comandaConfirmPayment: "rayzen/comanda/confirm-payment",
  cashOpenSession: "rayzen/cash/open-session",
  cashGetStatus: "rayzen/cash/get-status",
  cashGetSummary: "rayzen/cash/get-summary",
  cashRegisterReceipt: "rayzen/cash/register-receipt",
  cashRegisterSupply: "rayzen/cash/register-supply",
  cashRegisterWithdrawal: "rayzen/cash/register-withdrawal",
  cashStartClosure: "rayzen/cash/start-closure",
  cashCloseSession: "rayzen/cash/close-session",
  cashExportAudit: "rayzen/cash/export-audit",
  operatorList: "rayzen/operator/list",
  operatorSave: "rayzen/operator/save",
  waiterGetStatus: "rayzen/waiter/get-status"
} as const;

export interface MainBootstrapSnapshot {
  appVersion: string;
  environment: string;
  offlineFirst: true;
  httpApiEnabled: false;
  ipcMode: "electron-ipc";
  paths: MainProcessPaths;
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

export interface ExportLogsRequest {
  destinationDir: string;
}

export interface ExportLogsResult {
  exportDirectory: string;
  manifestFilePath: string;
  logFiles: string[];
}

export interface BackupArtifactSnapshot {
  kind:
    | "DATABASE"
    | "SQLITE_SIDECAR"
    | "CONFIG_EXPORT"
    | "SPOOL_DIR"
    | "FISCAL_XML_DIR"
    | "FISCAL_DANFE_DIR"
    | "FISCAL_EVENTS_DIR"
    | "LOG_EXPORT";
  relativePath: string;
}

export interface BackupListRequest {
  directory?: string;
}

export interface BackupListEntrySnapshot {
  backupDirectory: string;
  manifestFilePath: string;
  createdAt: string;
  appVersion: string;
  environment: string;
  artifactCount: number;
  databaseFileName: string;
  restorable: boolean;
  issues: string[];
}

export interface CreateBackupRequest {
  destinationDir?: string;
  includeLogs?: boolean;
  requestedAt: string;
  actor?: PrintRequestActor | null;
}

export interface CreateBackupResult {
  backupDirectory: string;
  manifestFilePath: string;
  artifacts: BackupArtifactSnapshot[];
  createdAt: string;
}

export interface RestoreBackupRequest {
  backupDirectory: string;
  requestedAt: string;
  actor?: PrintRequestActor | null;
}

export interface RestoreBackupResult {
  backupDirectory: string;
  manifestFilePath: string;
  restoredArtifacts: BackupArtifactSnapshot[];
  restoredAt: string;
  databaseReady: boolean;
  integrityCheck: "ok";
  requiresRestart: true;
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
  printRoutes: PrintRouteSnapshot[];
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

export interface AuthLoginRequest {
  pin: string;
  terminalId?: string | null;
}

export interface AuthLogoutRequest {
  terminalId?: string | null;
}

export type AuthSessionSnapshot = OperatorSession;
export type AuthLoginResult = AuthenticationResult;
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

export interface RegisterCashReceiptRequest {
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

export interface DatabaseStatusSnapshot {
  filePath: string;
  walMode: SqliteJournalMode;
  journalMode: string;
  appliedMigrations: AppliedMigration[];
  pendingMigrationVersions: string[];
}

export interface FiscalEmitterSnapshot {
  emitterId: string;
  provider: FiscalProvider;
  environment: FiscalEnvironment;
  stateCode: FiscalStateCode;
  documentModel: FiscalDocumentModel;
  legalName: string;
  cnpj: string;
  stateRegistration: string;
  cscId: string;
  certificateSubject: string | null;
  certificateValidFrom: string | null;
  certificateValidUntil: string | null;
  status: FiscalEmitterStatus;
  hasSecrets: boolean;
  updatedAt: string;
}

export interface FiscalDocumentSnapshot {
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
  provider: FiscalProvider;
  environment: FiscalEnvironment;
  documentModel: FiscalDocumentModel;
  status: FiscalQueueStatus;
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
  emitters: FiscalEmitterSnapshot[];
  pendingQueue: FiscalQueueJobSnapshot[];
  recentDocuments: FiscalDocumentSnapshot[];
}

export interface GetFiscalDocumentStatusRequest {
  fiscalDocId: string;
}

export interface ListPendingFiscalQueueRequest {
  limit?: number;
}

export interface ConfigureFiscalEmitterRequest {
  emitterId: string;
  provider: FiscalProvider;
  environment: FiscalEnvironment;
  stateCode: FiscalStateCode;
  documentModel: FiscalDocumentModel;
  legalName: string;
  tradeName?: string | null;
  cnpj: string;
  stateRegistration: string;
  cscId: string;
  certificateSubject?: string | null;
  certificateValidFrom?: string | null;
  certificateValidUntil?: string | null;
  settings?: Record<string, unknown>;
  certificateBase64: string;
  certificatePassword: string;
  csc: string;
  actor: PrintRequestActor;
  occurredAt: string;
}

export interface QueueFiscalNfceRequest {
  fiscalDocId: string;
  fiscalQueueId: string;
  emitterId: string;
  terminalId: string;
  referenceType: string;
  referenceId: string;
  serie: string;
  numero: number;
  dedupKey?: string | null;
  payload: Record<string, unknown>;
  actor: PrintRequestActor;
  occurredAt: string;
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

export interface ReprocessFiscalQueueRequest {
  limit?: number;
  asOf?: string;
}

export interface QueryFiscalStatusByAccessKeyRequest {
  accessKey: string;
  actor: PrintRequestActor;
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

export interface PrintRouteSnapshot {
  setor: string;
  impressoras: string[];
}

export interface PrintDriverPrinterSnapshot {
  printerId: string;
  printerName: string;
  isOffline: boolean;
  isAvailable: boolean;
  status: string | null;
}

export interface PrintSpoolStatusSnapshot {
  routes: PrintRouteSnapshot[];
  pendingJobs: PrintSpoolJobSnapshot[];
}

export interface ListPrintJobsRequest {
  limit?: number;
}

export interface PrintRequestActor {
  userId: string;
  terminalId: string;
  role: string;
}

export interface ProductionPrintItemInput {
  itemId: string;
  productLabel: string;
  quantity: number;
  setor: string;
  note: string | null;
}

export interface EnqueueProductionPrintRequest {
  sourceEntity: string;
  sourceEntityId: string;
  comandaNumero: string;
  mesaId?: string | null;
  batchId: string;
  requestedAt: string;
  actor: PrintRequestActor;
  items: ProductionPrintItemInput[];
}

export interface EnqueueProductionPrintResult {
  createdJobs: PrintSpoolJobSnapshot[];
  reusedJobs: PrintSpoolJobSnapshot[];
}

export interface ProcessPrintQueueRequest {
  limit?: number;
  asOf?: string;
}

export interface ProcessPrintQueueResult {
  processedCount: number;
  doneCount: number;
  waitingPrinterCount: number;
  needsAttentionCount: number;
  jobs: PrintSpoolJobSnapshot[];
}

export interface ReprocessPrintJobRequest {
  printJobId: string;
  requestedAt: string;
  actor: PrintRequestActor;
  reason: string;
}

export interface ReprintSecondCopyRequest {
  originalJobId: string;
  requestedAt: string;
  actor: PrintRequestActor;
  reason: string;
}

export interface OperatorSnapshot {
  operatorId: string;
  operatorCode: string;
  nome: string;
  role: "GERENTE" | "CAIXA" | "GARCOM";
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

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
