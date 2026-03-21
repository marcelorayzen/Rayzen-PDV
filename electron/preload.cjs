const { contextBridge, ipcRenderer } = require("electron");

const IPC_CHANNELS = {
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
  dbGetStatus: "rayzen/db/get-status",
  authLogin: "rayzen/auth/login",
  authLogout: "rayzen/auth/logout",
  authGetSession: "rayzen/auth/get-session",
  catalogListProducts: "rayzen/catalog/list-products",
  catalogGetProduct: "rayzen/catalog/get-product",
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
  comandaOpen: "rayzen/comanda/open",
  comandaAddItem: "rayzen/comanda/add-item",
  comandaCancelItem: "rayzen/comanda/cancel-item",
  comandaSendToProduction: "rayzen/comanda/send-to-production",
  comandaStartCheckout: "rayzen/comanda/start-checkout",
  comandaConfirmPayment: "rayzen/comanda/confirm-payment",
  cashOpenSession: "rayzen/cash/open-session",
  cashGetStatus: "rayzen/cash/get-status",
  cashGetSummary: "rayzen/cash/get-summary",
  cashRegisterReceipt: "rayzen/cash/register-receipt",
  cashRegisterSupply: "rayzen/cash/register-supply",
  cashRegisterWithdrawal: "rayzen/cash/register-withdrawal",
  cashStartClosure: "rayzen/cash/start-closure",
  cashCloseSession: "rayzen/cash/close-session",
  cashExportAudit: "rayzen/cash/export-audit"
};

function invoke(channel, payload) {
  return ipcRenderer.invoke(channel, payload);
}

contextBridge.exposeInMainWorld("rayzenDesktop", {
  system: {
    getBootstrap() {
      return invoke(IPC_CHANNELS.systemGetBootstrap);
    },
    getHealth() {
      return invoke(IPC_CHANNELS.systemGetHealth);
    },
    exportLogs(request) {
      return invoke(IPC_CHANNELS.systemExportLogs, request);
    },
    createBackup(request) {
      return invoke(IPC_CHANNELS.systemCreateBackup, request);
    },
    restoreBackup(request) {
      return invoke(IPC_CHANNELS.systemRestoreBackup, request);
    }
  },
  backup: {
    criar(request) {
      return invoke(IPC_CHANNELS.backupCreate, request);
    },
    listar(request) {
      return invoke(IPC_CHANNELS.backupList, request);
    },
    restaurar(request) {
      return invoke(IPC_CHANNELS.backupRestore, request);
    }
  },
  setup: {
    getStatus() {
      return invoke(IPC_CHANNELS.setupGetStatus);
    },
    completeFirstRun(request) {
      return invoke(IPC_CHANNELS.setupCompleteFirstRun, request);
    }
  },
  db: {
    getStatus() {
      return invoke(IPC_CHANNELS.dbGetStatus);
    }
  },
  auth: {
    login(request) {
      return invoke(IPC_CHANNELS.authLogin, request);
    },
    logout(request) {
      return invoke(IPC_CHANNELS.authLogout, request);
    },
    getSession() {
      return invoke(IPC_CHANNELS.authGetSession);
    }
  },
  catalog: {
    listProducts() {
      return invoke(IPC_CHANNELS.catalogListProducts);
    },
    getProduct(request) {
      return invoke(IPC_CHANNELS.catalogGetProduct, request);
    }
  },
  pdv: {
    getOperationalSnapshot() {
      return invoke(IPC_CHANNELS.pdvGetOperationalSnapshot);
    },
    openComanda(request) {
      return invoke(IPC_CHANNELS.comandaOpen, request);
    },
    addComandaItem(request) {
      return invoke(IPC_CHANNELS.comandaAddItem, request);
    },
    cancelComandaItem(request) {
      return invoke(IPC_CHANNELS.comandaCancelItem, request);
    },
    sendComandaToProduction(request) {
      return invoke(IPC_CHANNELS.comandaSendToProduction, request);
    },
    startComandaCheckout(request) {
      return invoke(IPC_CHANNELS.comandaStartCheckout, request);
    },
    confirmComandaPayment(request) {
      return invoke(IPC_CHANNELS.comandaConfirmPayment, request);
    },
    openCashSession(request) {
      return invoke(IPC_CHANNELS.cashOpenSession, request);
    },
    registerCashReceipt(request) {
      return invoke(IPC_CHANNELS.cashRegisterReceipt, request);
    },
    registerCashSupply(request) {
      return invoke(IPC_CHANNELS.cashRegisterSupply, request);
    },
    registerCashWithdrawal(request) {
      return invoke(IPC_CHANNELS.cashRegisterWithdrawal, request);
    },
    startCashClosure(request) {
      return invoke(IPC_CHANNELS.cashStartClosure, request);
    },
    closeCashSession(request) {
      return invoke(IPC_CHANNELS.cashCloseSession, request);
    },
    exportCashAudit() {
      return invoke(IPC_CHANNELS.cashExportAudit);
    }
  },
  cash: {
    open(request) {
      return invoke(IPC_CHANNELS.cashOpenSession, request);
    },
    status() {
      return invoke(IPC_CHANNELS.cashGetStatus);
    },
    sangria(request) {
      return invoke(IPC_CHANNELS.cashRegisterWithdrawal, request);
    },
    suprimento(request) {
      return invoke(IPC_CHANNELS.cashRegisterSupply, request);
    },
    fechar(request) {
      return invoke(IPC_CHANNELS.cashCloseSession, request);
    },
    resumo() {
      return invoke(IPC_CHANNELS.cashGetSummary);
    }
  },
  fiscal: {
    getStatus() {
      return invoke(IPC_CHANNELS.fiscalGetStatus);
    },
    getDocumentStatus(request) {
      return invoke(IPC_CHANNELS.fiscalGetDocumentStatus, request);
    },
    listPending(request) {
      return invoke(IPC_CHANNELS.fiscalListPending, request);
    },
    configureEmitter(request) {
      return invoke(IPC_CHANNELS.fiscalConfigureEmitter, request);
    },
    queueNfce(request) {
      return invoke(IPC_CHANNELS.fiscalQueueNfce, request);
    },
    processQueue(request) {
      return invoke(IPC_CHANNELS.fiscalProcessQueue, request);
    },
    reprocess(request) {
      return invoke(IPC_CHANNELS.fiscalReprocess, request);
    },
    queryStatusByAccessKey(request) {
      return invoke(IPC_CHANNELS.fiscalQueryStatusByAccessKey, request);
    }
  },
  print: {
    getStatus() {
      return invoke(IPC_CHANNELS.printGetStatus);
    },
    listJobs(request) {
      return invoke(IPC_CHANNELS.printListJobs, request);
    },
    listPrinters() {
      return invoke(IPC_CHANNELS.printListPrinters);
    },
    enqueueProduction(request) {
      return invoke(IPC_CHANNELS.printEnqueueProduction, request);
    },
    processQueue(request) {
      return invoke(IPC_CHANNELS.printProcessQueue, request);
    },
    reprocessJob(request) {
      return invoke(IPC_CHANNELS.printReprocessJob, request);
    },
    reprintSecondCopy(request) {
      return invoke(IPC_CHANNELS.printReprintSecondCopy, request);
    }
  }
});
