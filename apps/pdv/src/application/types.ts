import type { AuthenticationResult, CatalogProduct, OperatorSession } from "../domain/index.js";
import type { RuntimeSnapshot } from "../domain/shell-state.js";
import type {
  AddComandaItemRequest,
  AuthLoginRequest,
  AuthLogoutRequest,
  CancelComandaItemRequest,
  CatalogGetProductRequest,
  CatalogUpsertProductRequest,
  CompleteFirstRunRequest,
  UpdateBrandLogoRequest,
  CashWorkspaceSnapshot,
  CashStatusSnapshot,
  CashSummarySnapshot,
  CloseCashSessionRequest,
  ComandaWorkspaceSnapshot,
  ConfirmComandaPaymentRequest,
  FiscalDocumentSnapshot,
  FiscalQueueJobSnapshot,
  FiscalStatusSnapshot,
  GetComandaWorkspaceRequest,
  GetFiscalDocumentStatusRequest,
  ListPendingFiscalQueueRequest,
  ListPrintJobsRequest,
  InstallationStatusSnapshot,
  OpenCashSessionRequest,
  OpenComandaRequest,
  OperationalSnapshot,
  OperatorSnapshot,
  ProcessFiscalQueueRequest,
  ProcessFiscalQueueResult,
  PrintDriverPrinterSnapshot,
  PrintSpoolJobSnapshot,
  PrintSpoolStatusSnapshot,
  QueryFiscalStatusByAccessKeyRequest,
  ReopenComandaRequest,
  RequestComandaCashCheckoutRequest,
  RegisterCashMovementRequest,
  RegisterCashSupplyRequest,
  RegisterCashWithdrawalRequest,
  ReprocessPrintJobRequest,
  SaveOperatorRequest,
  SendComandaToProductionRequest,
  StartCashClosureRequest,
  StartComandaCheckoutRequest,
  WaiterServerStatusSnapshot
} from "../infra/desktop-api.js";

export interface DesktopBridge {
  getRuntimeSnapshot(): Promise<RuntimeSnapshot>;
  getInstallationStatus(): Promise<InstallationStatusSnapshot>;
  completeFirstRun(request: CompleteFirstRunRequest): Promise<InstallationStatusSnapshot>;
  updateBrandLogo(request: UpdateBrandLogoRequest): Promise<InstallationStatusSnapshot>;
  login(request: AuthLoginRequest): Promise<AuthenticationResult>;
  logout(request?: AuthLogoutRequest): Promise<void>;
  getOperatorSession(): Promise<OperatorSession | null>;
  listCatalogProducts(): Promise<CatalogProduct[]>;
  getCatalogProduct(request: CatalogGetProductRequest): Promise<CatalogProduct | null>;
  upsertCatalogProduct(request: CatalogUpsertProductRequest): Promise<CatalogProduct>;
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
  getCashStatus(): Promise<CashStatusSnapshot>;
  getCashSummary(): Promise<CashSummarySnapshot>;
  listOperators(): Promise<OperatorSnapshot[]>;
  saveOperator(request: SaveOperatorRequest): Promise<OperatorSnapshot>;
  getWaiterStatus(): Promise<WaiterServerStatusSnapshot | null>;
}
