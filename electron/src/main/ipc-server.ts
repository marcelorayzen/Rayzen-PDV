import path from "node:path";

import {
  type ConfigureFiscalEmitterRequest,
  type CreateBackupRequest,
  type CompleteFirstRunRequest,
  IPC_CHANNELS,
  type AddComandaItemRequest,
  type AuthLoginRequest,
  type BackupListRequest,
  type CancelComandaItemRequest,
  type CatalogGetProductRequest,
  type CloseCashSessionRequest,
  type EnqueueProductionPrintRequest,
  type ListPrintJobsRequest,
  type DatabaseStatusSnapshot,
  type ExportLogsRequest,
  type ExportLogsResult,
  type GetFiscalDocumentStatusRequest,
  type ListPendingFiscalQueueRequest,
  type MainBootstrapSnapshot,
  type MainHealthSnapshot,
  type OpenCashSessionRequest,
  type OpenComandaRequest,
  type ProcessFiscalQueueRequest,
  type ReprocessFiscalQueueRequest,
  type ProcessPrintQueueRequest,
  type QueryFiscalStatusByAccessKeyRequest,
  type QueueFiscalNfceRequest,
  type RegisterCashReceiptRequest,
  type RegisterCashSupplyRequest,
  type RegisterCashWithdrawalRequest,
  type ReprocessPrintJobRequest,
  type ReprintSecondCopyRequest,
  type RestoreBackupRequest,
  type SendComandaToProductionRequest,
  type StartCashClosureRequest,
  type StartComandaCheckoutRequest,
  type ConfirmComandaPaymentRequest
} from "../contracts/ipc.js";
import type { MainProcessLogStore } from "./log-store.js";
import type { MainProcessPaths } from "./paths.js";
import type { OperatorAuthService } from "./auth/service.js";
import type { CatalogService } from "./catalog/service.js";
import type { ElectronDatabaseService } from "./db-service.js";
import type { FiscalService } from "./fiscal/service.js";
import type { PdvRoundtripService } from "./pdv/service.js";
import type { PrintSpoolService } from "./printing/service.js";
import type { OperationalSupportService } from "./support/service.js";
import type { FirstRunSetupService } from "./setup/service.js";

export interface IpcMainLike {
  handle(channel: string, listener: (_event: unknown, payload?: unknown) => unknown | Promise<unknown>): void;
  removeHandler(channel: string): void;
}

export interface MainProcessServices {
  appVersion: string;
  environment: string;
  paths: MainProcessPaths;
  logger: MainProcessLogStore;
  database: ElectronDatabaseService;
  auth: OperatorAuthService;
  catalog: CatalogService;
  pdv: PdvRoundtripService;
  fiscal: FiscalService;
  print: PrintSpoolService;
  setup: FirstRunSetupService;
  support: OperationalSupportService;
}

export interface RegisteredIpcHandlers {
  dispose(): void;
}

export function registerMainIpcHandlers(
  ipcMain: IpcMainLike,
  services: MainProcessServices
): RegisteredIpcHandlers {
  const handlers = new Map<string, (_event: unknown, payload?: unknown) => unknown | Promise<unknown>>([
    [
      IPC_CHANNELS.systemGetBootstrap,
      () => createBootstrapSnapshot(services)
    ],
    [
      IPC_CHANNELS.systemGetHealth,
      () => createHealthSnapshot(services)
    ],
    [
      IPC_CHANNELS.setupGetStatus,
      () => services.setup.getStatus()
    ],
    [
      IPC_CHANNELS.setupCompleteFirstRun,
      (_event, payload) => services.setup.completeFirstRun(payload as CompleteFirstRunRequest)
    ],
    [
      IPC_CHANNELS.dbGetStatus,
      () => services.database.getStatus()
    ],
    [
      IPC_CHANNELS.authLogin,
      (_event, payload) => services.auth.login(payload as AuthLoginRequest)
    ],
    [
      IPC_CHANNELS.authLogout,
      (_event, payload) => services.auth.logout(payload as { terminalId?: string | null } | undefined)
    ],
    [
      IPC_CHANNELS.authGetSession,
      () => services.auth.getSession()
    ],
    [
      IPC_CHANNELS.catalogListProducts,
      () => services.catalog.listProducts()
    ],
    [
      IPC_CHANNELS.catalogGetProduct,
      (_event, payload) => services.catalog.findProduct((payload as CatalogGetProductRequest).productId)
    ],
    [
      IPC_CHANNELS.pdvGetOperationalSnapshot,
      () => services.pdv.getOperationalSnapshot()
    ],
    [
      IPC_CHANNELS.comandaOpen,
      (_event, payload) => services.pdv.openComanda(payload as OpenComandaRequest)
    ],
    [
      IPC_CHANNELS.comandaAddItem,
      (_event, payload) => services.pdv.addComandaItem(payload as AddComandaItemRequest)
    ],
    [
      IPC_CHANNELS.comandaCancelItem,
      (_event, payload) => services.pdv.cancelComandaItem(payload as CancelComandaItemRequest)
    ],
    [
      IPC_CHANNELS.comandaSendToProduction,
      (_event, payload) => services.pdv.sendComandaToProduction(payload as SendComandaToProductionRequest)
    ],
    [
      IPC_CHANNELS.comandaStartCheckout,
      (_event, payload) => services.pdv.startComandaCheckout(payload as StartComandaCheckoutRequest)
    ],
    [
      IPC_CHANNELS.comandaConfirmPayment,
      (_event, payload) => services.pdv.confirmComandaPayment(payload as ConfirmComandaPaymentRequest)
    ],
    [
      IPC_CHANNELS.cashOpenSession,
      (_event, payload) => services.pdv.openCashSession(payload as OpenCashSessionRequest)
    ],
    [
      IPC_CHANNELS.cashGetStatus,
      () => services.pdv.getCashStatus()
    ],
    [
      IPC_CHANNELS.cashGetSummary,
      () => services.pdv.getCashSummary()
    ],
    [
      IPC_CHANNELS.cashRegisterReceipt,
      (_event, payload) => services.pdv.registerCashReceipt(payload as RegisterCashReceiptRequest)
    ],
    [
      IPC_CHANNELS.cashRegisterSupply,
      (_event, payload) => services.pdv.registerCashSupply(payload as RegisterCashSupplyRequest)
    ],
    [
      IPC_CHANNELS.cashRegisterWithdrawal,
      (_event, payload) => services.pdv.registerCashWithdrawal(payload as RegisterCashWithdrawalRequest)
    ],
    [
      IPC_CHANNELS.cashStartClosure,
      (_event, payload) => services.pdv.startCashClosure(payload as StartCashClosureRequest)
    ],
    [
      IPC_CHANNELS.cashCloseSession,
      (_event, payload) => services.pdv.closeCashSession(payload as CloseCashSessionRequest)
    ],
    [
      IPC_CHANNELS.cashExportAudit,
      () => services.pdv.exportCashAudit()
    ],
    [
      IPC_CHANNELS.fiscalGetStatus,
      () => services.fiscal.getStatusSnapshot()
    ],
    [
      IPC_CHANNELS.fiscalGetDocumentStatus,
      (_event, payload) => services.fiscal.getDocumentStatus((payload as GetFiscalDocumentStatusRequest).fiscalDocId)
    ],
    [
      IPC_CHANNELS.fiscalListPending,
      (_event, payload) => services.fiscal.listPending((payload as ListPendingFiscalQueueRequest | undefined)?.limit)
    ],
    [
      IPC_CHANNELS.fiscalConfigureEmitter,
      (_event, payload) => services.fiscal.configureEmitter(payload as ConfigureFiscalEmitterRequest)
    ],
    [
      IPC_CHANNELS.fiscalQueueNfce,
      (_event, payload) => services.fiscal.queueNfce(payload as QueueFiscalNfceRequest)
    ],
    [
      IPC_CHANNELS.fiscalProcessQueue,
      (_event, payload) => services.fiscal.processQueue(payload as ProcessFiscalQueueRequest | undefined)
    ],
    [
      IPC_CHANNELS.fiscalReprocess,
      (_event, payload) => services.fiscal.reprocess(payload as ReprocessFiscalQueueRequest | undefined)
    ],
    [
      IPC_CHANNELS.fiscalQueryStatusByAccessKey,
      (_event, payload) => services.fiscal.queryStatusByAccessKey(payload as QueryFiscalStatusByAccessKeyRequest)
    ],
    [
      IPC_CHANNELS.systemExportLogs,
      (_event, payload) => exportLogs(services, payload as ExportLogsRequest)
    ],
    [
      IPC_CHANNELS.systemCreateBackup,
      (_event, payload) => services.support.createBackup(payload as CreateBackupRequest)
    ],
    [
      IPC_CHANNELS.backupCreate,
      (_event, payload) => services.support.createBackup(payload as CreateBackupRequest)
    ],
    [
      IPC_CHANNELS.backupList,
      (_event, payload) => services.support.listBackups(payload as BackupListRequest | undefined)
    ],
    [
      IPC_CHANNELS.systemRestoreBackup,
      (_event, payload) => services.support.restoreBackup(payload as RestoreBackupRequest)
    ],
    [
      IPC_CHANNELS.backupRestore,
      (_event, payload) => services.support.restoreBackup(payload as RestoreBackupRequest)
    ],
    [
      IPC_CHANNELS.printGetStatus,
      () => services.print.getStatusSnapshot()
    ],
    [
      IPC_CHANNELS.printListJobs,
      (_event, payload) => services.print.listJobs(payload as ListPrintJobsRequest | undefined)
    ],
    [
      IPC_CHANNELS.printListPrinters,
      () => services.print.listPrinters()
    ],
    [
      IPC_CHANNELS.printEnqueueProduction,
      (_event, payload) => services.print.enqueueProductionTickets(payload as EnqueueProductionPrintRequest)
    ],
    [
      IPC_CHANNELS.printProcessQueue,
      (_event, payload) => services.print.processPendingJobs(payload as ProcessPrintQueueRequest | undefined)
    ],
    [
      IPC_CHANNELS.printReprocessJob,
      (_event, payload) => services.print.reprocessJob(payload as ReprocessPrintJobRequest)
    ],
    [
      IPC_CHANNELS.printReprintSecondCopy,
      (_event, payload) => services.print.reprintSecondCopy(payload as ReprintSecondCopyRequest)
    ]
  ]);

  for (const channel of handlers.keys()) {
    ipcMain.removeHandler(channel);
  }

  for (const [channel, handler] of handlers) {
    ipcMain.handle(channel, handler);
  }

  services.logger.info("electron.ipc.handlers-registered", {
    channels: [...handlers.keys()]
  });

  return {
    dispose() {
      for (const channel of handlers.keys()) {
        ipcMain.removeHandler(channel);
      }
    }
  };
}

function createBootstrapSnapshot(services: MainProcessServices): MainBootstrapSnapshot {
  return {
    appVersion: services.appVersion,
    environment: services.environment,
    offlineFirst: true,
    httpApiEnabled: false,
    ipcMode: "electron-ipc",
    paths: services.paths,
    databaseReady: services.database.isReady(),
    logFilePath: services.logger.logFilePath
  };
}

function createHealthSnapshot(services: MainProcessServices): MainHealthSnapshot {
  return {
    ready: true,
    databaseReady: services.database.isReady(),
    httpApiEnabled: false,
    ipcMode: "electron-ipc",
    dbFilePath: services.paths.dbFilePath,
    logFilePath: services.logger.logFilePath
  };
}

function exportLogs(
  services: MainProcessServices,
  request: ExportLogsRequest | undefined
): ExportLogsResult {
  if (!request?.destinationDir || !path.isAbsolute(request.destinationDir)) {
    throw new Error("destinationDir must be an absolute path.");
  }

  const result = services.logger.exportLogs(request.destinationDir);
  services.logger.info("electron.logs.exported", {
    exportDirectory: result.exportDirectory,
    files: result.logFiles.length
  });
  return result;
}
