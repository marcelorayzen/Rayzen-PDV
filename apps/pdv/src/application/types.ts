import type { AuthenticationResult, CatalogProduct, OperatorSession } from "../domain/index.js";
import type { RuntimeSnapshot } from "../domain/shell-state.js";
import type {
  AddComandaItemRequest,
  AuthLoginRequest,
  AuthLogoutRequest,
  CancelComandaItemRequest,
  CatalogGetProductRequest,
  CompleteFirstRunRequest,
  CashWorkspaceSnapshot,
  CashStatusSnapshot,
  CashSummarySnapshot,
  CloseCashSessionRequest,
  ComandaWorkspaceSnapshot,
  ConfirmComandaPaymentRequest,
  FiscalDocumentSnapshot,
  FiscalQueueJobSnapshot,
  FiscalStatusSnapshot,
  GetFiscalDocumentStatusRequest,
  ListPendingFiscalQueueRequest,
  ListPrintJobsRequest,
  InstallationStatusSnapshot,
  OpenCashSessionRequest,
  OpenComandaRequest,
  OperationalSnapshot,
  ProcessFiscalQueueRequest,
  ProcessFiscalQueueResult,
  PrintDriverPrinterSnapshot,
  PrintSpoolJobSnapshot,
  PrintSpoolStatusSnapshot,
  QueryFiscalStatusByAccessKeyRequest,
  RegisterCashMovementRequest,
  RegisterCashSupplyRequest,
  RegisterCashWithdrawalRequest,
  ReprocessPrintJobRequest,
  SendComandaToProductionRequest,
  StartCashClosureRequest,
  StartComandaCheckoutRequest
} from "../infra/desktop-api.js";

export interface DesktopBridge {
  getRuntimeSnapshot(): Promise<RuntimeSnapshot>;
  getInstallationStatus(): Promise<InstallationStatusSnapshot>;
  completeFirstRun(request: CompleteFirstRunRequest): Promise<InstallationStatusSnapshot>;
  login(request: AuthLoginRequest): Promise<AuthenticationResult>;
  logout(request?: AuthLogoutRequest): Promise<void>;
  getOperatorSession(): Promise<OperatorSession | null>;
  listCatalogProducts(): Promise<CatalogProduct[]>;
  getCatalogProduct(request: CatalogGetProductRequest): Promise<CatalogProduct | null>;
  getFiscalStatus(): Promise<FiscalStatusSnapshot>;
  getFiscalDocumentStatus(request: GetFiscalDocumentStatusRequest): Promise<FiscalDocumentSnapshot | null>;
  listPendingFiscalQueue(request?: ListPendingFiscalQueueRequest): Promise<FiscalQueueJobSnapshot[]>;
  reprocessFiscalQueue(request?: ProcessFiscalQueueRequest): Promise<ProcessFiscalQueueResult>;
  queryFiscalStatusByAccessKey(request: QueryFiscalStatusByAccessKeyRequest): Promise<FiscalDocumentSnapshot>;
  getPrintStatus(): Promise<PrintSpoolStatusSnapshot>;
  listPrintPrinters(): Promise<PrintDriverPrinterSnapshot[]>;
  listPrintJobs(request?: ListPrintJobsRequest): Promise<PrintSpoolJobSnapshot[]>;
  reprocessPrintJob(request: ReprocessPrintJobRequest): Promise<PrintSpoolJobSnapshot>;
  getOperationalSnapshot(): Promise<OperationalSnapshot>;
  openComanda(request: OpenComandaRequest): Promise<ComandaWorkspaceSnapshot>;
  addComandaItem(request: AddComandaItemRequest): Promise<ComandaWorkspaceSnapshot>;
  cancelComandaItem(request: CancelComandaItemRequest): Promise<ComandaWorkspaceSnapshot>;
  sendComandaToProduction(request: SendComandaToProductionRequest): Promise<ComandaWorkspaceSnapshot>;
  startComandaCheckout(request: StartComandaCheckoutRequest): Promise<ComandaWorkspaceSnapshot>;
  confirmComandaPayment(request: ConfirmComandaPaymentRequest): Promise<OperationalSnapshot>;
  openCashSession(request: OpenCashSessionRequest): Promise<CashWorkspaceSnapshot>;
  registerCashReceipt(request: RegisterCashMovementRequest): Promise<CashWorkspaceSnapshot>;
  registerCashSupply(request: RegisterCashSupplyRequest): Promise<CashWorkspaceSnapshot>;
  registerCashWithdrawal(request: RegisterCashWithdrawalRequest): Promise<CashWorkspaceSnapshot>;
  startCashClosure(request: StartCashClosureRequest): Promise<CashWorkspaceSnapshot>;
  closeCashSession(request: CloseCashSessionRequest): Promise<CashWorkspaceSnapshot>;
  exportCashAudit(): Promise<CashWorkspaceSnapshot>;
  getCashStatus(): Promise<CashStatusSnapshot>;
  getCashSummary(): Promise<CashSummarySnapshot>;
}
