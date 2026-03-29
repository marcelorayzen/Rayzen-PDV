import type {
  WaiterServerStatusSnapshot,
  AddComandaItemRequest,
  AuthLoginRequest,
  AuthLoginResult,
  AuthLogoutRequest,
  AuthSessionSnapshot,
  CancelComandaItemRequest,
  BackupListEntrySnapshot,
  BackupListRequest,
  OperatorSnapshot,
  SaveOperatorRequest,
  CatalogGetProductRequest,
  CatalogProductSnapshot,
  CatalogUpsertProductRequest,
  CompleteFirstRunRequest,
  UpdateBrandLogoRequest,
  CashWorkspaceSnapshot,
  CashStatusSnapshot,
  CashSummarySnapshot,
  CloseCashSessionRequest,
  ComandaWorkspaceSnapshot,
  ConfirmComandaPaymentRequest,
  GetComandaWorkspaceRequest,
  ConfigureFiscalEmitterRequest,
  CreateBackupRequest,
  CreateBackupResult,
  DatabaseStatusSnapshot,
  EnqueueProductionPrintRequest,
  EnqueueProductionPrintResult,
  ExportLogsRequest,
  ExportLogsResult,
  FiscalDocumentSnapshot,
  GetFiscalDocumentStatusRequest,
  FiscalStatusSnapshot,
  InstallationStatusSnapshot,
  ListPendingFiscalQueueRequest,
  MainBootstrapSnapshot,
  MainHealthSnapshot,
  OpenCashSessionRequest,
  OpenComandaRequest,
  OperationalSnapshot,
  PrintDriverPrinterSnapshot,
  ListPrintJobsRequest,
  PrintSpoolJobSnapshot,
  PrintSpoolStatusSnapshot,
  ProcessFiscalQueueRequest,
  ProcessFiscalQueueResult,
  ReprocessFiscalQueueRequest,
  ProcessPrintQueueRequest,
  ProcessPrintQueueResult,
  QueryFiscalStatusByAccessKeyRequest,
  QueueFiscalNfceRequest,
  ReopenComandaRequest,
  RequestComandaCashCheckoutRequest,
  RegisterCashReceiptRequest,
  RegisterCashSupplyRequest,
  RegisterCashWithdrawalRequest,
  ReprocessPrintJobRequest,
  ReprintSecondCopyRequest,
  SendComandaToProductionRequest,
  StartCashClosureRequest,
  StartComandaCheckoutRequest,
  RestoreBackupRequest,
  RestoreBackupResult
} from "./ipc.js";

export interface RayzenDesktopApi {
  system: {
    getBootstrap(): Promise<MainBootstrapSnapshot>;
    getHealth(): Promise<MainHealthSnapshot>;
    exportLogs(request: ExportLogsRequest): Promise<ExportLogsResult>;
    createBackup(request: CreateBackupRequest): Promise<CreateBackupResult>;
    restoreBackup(request: RestoreBackupRequest): Promise<RestoreBackupResult>;
  };
  backup: {
    criar(request: CreateBackupRequest): Promise<CreateBackupResult>;
    listar(request?: BackupListRequest): Promise<BackupListEntrySnapshot[]>;
    restaurar(request: RestoreBackupRequest): Promise<RestoreBackupResult>;
  };
  setup: {
    getStatus(): Promise<InstallationStatusSnapshot>;
    completeFirstRun(request: CompleteFirstRunRequest): Promise<InstallationStatusSnapshot>;
    updateBrandLogo(request: UpdateBrandLogoRequest): Promise<InstallationStatusSnapshot>;
  };
  db: {
    getStatus(): Promise<DatabaseStatusSnapshot>;
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
    registerCashReceipt(request: RegisterCashReceiptRequest): Promise<CashWorkspaceSnapshot>;
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
  fiscal: {
    getStatus(): Promise<FiscalStatusSnapshot>;
    getDocumentStatus(request: GetFiscalDocumentStatusRequest): Promise<FiscalDocumentSnapshot | null>;
    listPending(request?: ListPendingFiscalQueueRequest): Promise<FiscalStatusSnapshot["pendingQueue"]>;
    configureEmitter(request: ConfigureFiscalEmitterRequest): Promise<FiscalStatusSnapshot["emitters"][number]>;
    queueNfce(request: QueueFiscalNfceRequest): Promise<FiscalDocumentSnapshot>;
    processQueue(request?: ProcessFiscalQueueRequest): Promise<ProcessFiscalQueueResult>;
    reprocess(request?: ReprocessFiscalQueueRequest): Promise<ProcessFiscalQueueResult>;
    queryStatusByAccessKey(request: QueryFiscalStatusByAccessKeyRequest): Promise<FiscalDocumentSnapshot>;
  };
  print: {
    getStatus(): Promise<PrintSpoolStatusSnapshot>;
    listJobs(request?: ListPrintJobsRequest): Promise<PrintSpoolJobSnapshot[]>;
    listPrinters(): Promise<PrintDriverPrinterSnapshot[]>;
    enqueueProduction(request: EnqueueProductionPrintRequest): Promise<EnqueueProductionPrintResult>;
    processQueue(request?: ProcessPrintQueueRequest): Promise<ProcessPrintQueueResult>;
    reprocessJob(request: ReprocessPrintJobRequest): Promise<PrintSpoolJobSnapshot>;
    reprintSecondCopy(request: ReprintSecondCopyRequest): Promise<PrintSpoolJobSnapshot>;
  };
  team: {
    listOperators(): Promise<OperatorSnapshot[]>;
    saveOperator(request: SaveOperatorRequest): Promise<OperatorSnapshot>;
  };
  waiter: {
    getStatus(): Promise<WaiterServerStatusSnapshot>;
  };
}
