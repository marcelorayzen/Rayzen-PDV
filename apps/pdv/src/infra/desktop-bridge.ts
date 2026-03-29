import type { DesktopBridge } from "../application/index.js";
import type { CatalogProduct, OperatorSession, RuntimeSnapshot } from "../domain/index.js";
import type {
  AddComandaItemRequest,
  AuthLoginRequest,
  AuthLogoutRequest,
  CancelComandaItemRequest,
  CatalogGetProductRequest,
  CatalogUpsertProductRequest,
  CashWorkspaceSnapshot,
  CloseCashSessionRequest,
  ComandaWorkspaceSnapshot,
  ConfirmComandaPaymentRequest,
  GetComandaWorkspaceRequest,
  GetFiscalDocumentStatusRequest,
  ListPendingFiscalQueueRequest,
  ListPrintJobsRequest,
  MainBootstrapSnapshot,
  MainHealthSnapshot,
  OpenCashSessionRequest,
  OpenComandaRequest,
  OperationalSnapshot,
  OperatorSnapshot,
  ProcessFiscalQueueRequest,
  RayzenDesktopApi,
  ReprocessPrintJobRequest,
  RegisterCashMovementRequest,
  RegisterCashSupplyRequest,
  RegisterCashWithdrawalRequest,
  QueryFiscalStatusByAccessKeyRequest,
  SaveOperatorRequest,
  SendComandaToProductionRequest,
  StartCashClosureRequest,
  StartComandaCheckoutRequest,
  ReopenComandaRequest,
  RequestComandaCashCheckoutRequest,
  WaiterServerStatusSnapshot
} from "./desktop-api.js";

const FALLBACK_BOOTSTRAP = {
  appVersion: "0.1.0-dev",
  environment: "development",
  offlineFirst: true,
  httpApiEnabled: false,
  ipcMode: "unavailable",
  databaseReady: false,
  logFilePath: null
} as const;

const FALLBACK_HEALTH = {
  ready: false,
  databaseReady: false,
  httpApiEnabled: false,
  ipcMode: "unavailable",
  dbFilePath: null,
  logFilePath: null
} as const;

export function createDesktopBridge(api: RayzenDesktopApi | undefined = window.rayzenDesktop): DesktopBridge {
  return {
    async getRuntimeSnapshot(): Promise<RuntimeSnapshot> {
      if (!api) {
        return {
          bootstrap: FALLBACK_BOOTSTRAP,
          health: FALLBACK_HEALTH
        };
      }

      const [bootstrap, health] = await Promise.all([
        api.system.getBootstrap(),
        api.system.getHealth()
      ]);

      return {
        bootstrap: mapBootstrap(bootstrap),
        health: mapHealth(health)
      };
    },
    async getInstallationStatus() {
      return ensureApi(api).setup.getStatus();
    },
    async completeFirstRun(request) {
      return ensureApi(api).setup.completeFirstRun(request);
    },
    async updateBrandLogo(request) {
      const desktopApi = ensureApi(api);

      if (typeof desktopApi.setup.updateBrandLogo === "function") {
        return desktopApi.setup.updateBrandLogo(request);
      }

      return desktopApi.setup.getStatus();
    },
    async login(request: AuthLoginRequest) {
      return ensureApi(api).auth.login(request);
    },
    async logout(request?: AuthLogoutRequest): Promise<void> {
      await ensureApi(api).auth.logout(request);
    },
    async getOperatorSession(): Promise<OperatorSession | null> {
      if (!api) {
        return null;
      }

      return api.auth.getSession();
    },
    async listCatalogProducts(): Promise<CatalogProduct[]> {
      if (!api) {
        return [];
      }

      return api.catalog.listProducts();
    },
    async getCatalogProduct(request: CatalogGetProductRequest): Promise<CatalogProduct | null> {
      return ensureApi(api).catalog.getProduct(request);
    },
    async upsertCatalogProduct(request: CatalogUpsertProductRequest): Promise<CatalogProduct> {
      return ensureApi(api).catalog.upsertProduct(request);
    },
    async getFiscalStatus() {
      return ensureApi(api).fiscal.getStatus();
    },
    async getFiscalDocumentStatus(request: GetFiscalDocumentStatusRequest) {
      return ensureApi(api).fiscal.getDocumentStatus(request);
    },
    async listPendingFiscalQueue(request?: ListPendingFiscalQueueRequest) {
      return ensureApi(api).fiscal.listPending(request);
    },
    async reprocessFiscalQueue(request?: ProcessFiscalQueueRequest) {
      return ensureApi(api).fiscal.reprocess(request);
    },
    async queryFiscalStatusByAccessKey(request: QueryFiscalStatusByAccessKeyRequest) {
      return ensureApi(api).fiscal.queryStatusByAccessKey(request);
    },
    async getPrintStatus() {
      return ensureApi(api).print.getStatus();
    },
    async listPrintPrinters() {
      return ensureApi(api).print.listPrinters();
    },
    async listPrintJobs(request?: ListPrintJobsRequest) {
      return ensureApi(api).print.listJobs(request);
    },
    async reprocessPrintJob(request: ReprocessPrintJobRequest) {
      return ensureApi(api).print.reprocessJob(request);
    },
    async getOperationalSnapshot(): Promise<OperationalSnapshot> {
      if (!api) {
        return {
          comanda: {
            currentComanda: null,
            activeComandas: [],
            mesaGroups: [],
            auditTrail: [],
            lastPreContaSnapshot: null
          },
          cash: {
            currentSession: null,
            auditTrail: [],
            auditExport: null
          }
        };
      }

      return api.pdv.getOperationalSnapshot();
    },
    async getComandaWorkspace(request: GetComandaWorkspaceRequest): Promise<ComandaWorkspaceSnapshot> {
      return ensureApi(api).pdv.getComandaWorkspace(request);
    },
    async openComanda(request: OpenComandaRequest): Promise<ComandaWorkspaceSnapshot> {
      return ensureApi(api).pdv.openComanda(request);
    },
    async addComandaItem(request: AddComandaItemRequest): Promise<ComandaWorkspaceSnapshot> {
      return ensureApi(api).pdv.addComandaItem(request);
    },
    async cancelComandaItem(request: CancelComandaItemRequest): Promise<ComandaWorkspaceSnapshot> {
      return ensureApi(api).pdv.cancelComandaItem(request);
    },
    async sendComandaToProduction(request: SendComandaToProductionRequest): Promise<ComandaWorkspaceSnapshot> {
      return ensureApi(api).pdv.sendComandaToProduction(request);
    },
    async startComandaCheckout(request: StartComandaCheckoutRequest): Promise<ComandaWorkspaceSnapshot> {
      return ensureApi(api).pdv.startComandaCheckout(request);
    },
    async reopenComanda(request: ReopenComandaRequest): Promise<ComandaWorkspaceSnapshot> {
      return ensureApi(api).pdv.reopenComanda(request);
    },
    async requestComandaCashCheckout(request: RequestComandaCashCheckoutRequest): Promise<ComandaWorkspaceSnapshot> {
      return ensureApi(api).pdv.requestComandaCashCheckout(request);
    },
    async confirmComandaPayment(request: ConfirmComandaPaymentRequest): Promise<OperationalSnapshot> {
      return ensureApi(api).pdv.confirmComandaPayment(request);
    },
    async openCashSession(request: OpenCashSessionRequest): Promise<CashWorkspaceSnapshot> {
      return ensureApi(api).pdv.openCashSession(request);
    },
    async getCashStatus() {
      return ensureApi(api).cash.status();
    },
    async getCashSummary() {
      return ensureApi(api).cash.resumo();
    },
    async registerCashReceipt(request: RegisterCashMovementRequest): Promise<CashWorkspaceSnapshot> {
      return ensureApi(api).pdv.registerCashReceipt(request);
    },
    async registerCashSupply(request: RegisterCashSupplyRequest): Promise<CashWorkspaceSnapshot> {
      return ensureApi(api).pdv.registerCashSupply(request);
    },
    async registerCashWithdrawal(request: RegisterCashWithdrawalRequest): Promise<CashWorkspaceSnapshot> {
      return ensureApi(api).pdv.registerCashWithdrawal(request);
    },
    async startCashClosure(request: StartCashClosureRequest): Promise<CashWorkspaceSnapshot> {
      return ensureApi(api).pdv.startCashClosure(request);
    },
    async closeCashSession(request: CloseCashSessionRequest): Promise<CashWorkspaceSnapshot> {
      return ensureApi(api).pdv.closeCashSession(request);
    },
    async exportCashAudit(): Promise<CashWorkspaceSnapshot> {
      return ensureApi(api).pdv.exportCashAudit();
    },
    async listOperators(): Promise<OperatorSnapshot[]> {
      if (!api) {
        return [];
      }

      return api.team.listOperators();
    },
    async saveOperator(request: SaveOperatorRequest): Promise<OperatorSnapshot> {
      return ensureApi(api).team.saveOperator(request);
    },
    async getWaiterStatus(): Promise<WaiterServerStatusSnapshot | null> {
      if (!api?.waiter) {
        return null;
      }
      return api.waiter.getStatus();
    }
  };
}

function mapBootstrap(snapshot: MainBootstrapSnapshot) {
  return {
    appVersion: snapshot.appVersion,
    environment: snapshot.environment,
    offlineFirst: snapshot.offlineFirst,
    httpApiEnabled: snapshot.httpApiEnabled,
    ipcMode: snapshot.ipcMode,
    databaseReady: snapshot.databaseReady,
    logFilePath: snapshot.logFilePath
  } as const;
}

function mapHealth(snapshot: MainHealthSnapshot) {
  return {
    ready: snapshot.ready,
    databaseReady: snapshot.databaseReady,
    httpApiEnabled: snapshot.httpApiEnabled,
    ipcMode: snapshot.ipcMode,
    dbFilePath: snapshot.dbFilePath,
    logFilePath: snapshot.logFilePath
  } as const;
}

function ensureApi(api: RayzenDesktopApi | undefined): RayzenDesktopApi {
  if (!api) {
    throw new Error("IPC do desktop indisponivel no terminal.");
  }

  return api;
}
