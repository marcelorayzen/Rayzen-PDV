import { IPC_CHANNELS } from "./contracts/ipc.js";
import type { RayzenDesktopApi } from "./contracts/preload.js";

export interface ContextBridgeLike {
  exposeInMainWorld(apiKey: string, api: unknown): void;
}

export interface IpcRendererLike {
  invoke(channel: string, payload?: unknown): Promise<unknown>;
}

export function createRayzenDesktopApi(
  renderer: IpcRendererLike
): RayzenDesktopApi {
  return {
    system: {
      async getBootstrap() {
        return renderer.invoke(IPC_CHANNELS.systemGetBootstrap) as Promise<Awaited<ReturnType<RayzenDesktopApi["system"]["getBootstrap"]>>>;
      },
      async getHealth() {
        return renderer.invoke(IPC_CHANNELS.systemGetHealth) as Promise<Awaited<ReturnType<RayzenDesktopApi["system"]["getHealth"]>>>;
      },
      async exportLogs(request) {
        return renderer.invoke(IPC_CHANNELS.systemExportLogs, request) as Promise<Awaited<ReturnType<RayzenDesktopApi["system"]["exportLogs"]>>>;
      },
      async createBackup(request) {
        return renderer.invoke(IPC_CHANNELS.systemCreateBackup, request) as Promise<Awaited<ReturnType<RayzenDesktopApi["system"]["createBackup"]>>>;
      },
      async restoreBackup(request) {
        return renderer.invoke(IPC_CHANNELS.systemRestoreBackup, request) as Promise<Awaited<ReturnType<RayzenDesktopApi["system"]["restoreBackup"]>>>;
      }
    },
    backup: {
      async criar(request) {
        return renderer.invoke(IPC_CHANNELS.backupCreate, request) as Promise<Awaited<ReturnType<RayzenDesktopApi["backup"]["criar"]>>>;
      },
      async listar(request) {
        return renderer.invoke(IPC_CHANNELS.backupList, request) as Promise<Awaited<ReturnType<RayzenDesktopApi["backup"]["listar"]>>>;
      },
      async restaurar(request) {
        return renderer.invoke(IPC_CHANNELS.backupRestore, request) as Promise<Awaited<ReturnType<RayzenDesktopApi["backup"]["restaurar"]>>>;
      }
    },
    setup: {
      async getStatus() {
        return renderer.invoke(IPC_CHANNELS.setupGetStatus) as Promise<Awaited<ReturnType<RayzenDesktopApi["setup"]["getStatus"]>>>;
      },
      async completeFirstRun(request) {
        return renderer.invoke(IPC_CHANNELS.setupCompleteFirstRun, request) as Promise<Awaited<ReturnType<RayzenDesktopApi["setup"]["completeFirstRun"]>>>;
      },
      async updateBrandLogo(request) {
        return renderer.invoke(IPC_CHANNELS.setupUpdateBrandLogo, request) as Promise<Awaited<ReturnType<RayzenDesktopApi["setup"]["updateBrandLogo"]>>>;
      }
    },
    db: {
      async getStatus() {
        return renderer.invoke(IPC_CHANNELS.dbGetStatus) as Promise<Awaited<ReturnType<RayzenDesktopApi["db"]["getStatus"]>>>;
      }
    },
    auth: {
      async login(request) {
        return renderer.invoke(IPC_CHANNELS.authLogin, request) as Promise<Awaited<ReturnType<RayzenDesktopApi["auth"]["login"]>>>;
      },
      async logout(request) {
        await renderer.invoke(IPC_CHANNELS.authLogout, request);
      },
      async getSession() {
        return renderer.invoke(IPC_CHANNELS.authGetSession) as Promise<Awaited<ReturnType<RayzenDesktopApi["auth"]["getSession"]>>>;
      }
    },
    catalog: {
      async listProducts() {
        return renderer.invoke(IPC_CHANNELS.catalogListProducts) as Promise<
          Awaited<ReturnType<RayzenDesktopApi["catalog"]["listProducts"]>>
        >;
      },
      async getProduct(request) {
        return renderer.invoke(IPC_CHANNELS.catalogGetProduct, request) as Promise<
          Awaited<ReturnType<RayzenDesktopApi["catalog"]["getProduct"]>>
        >;
      },
      async upsertProduct(request) {
        return renderer.invoke(IPC_CHANNELS.catalogUpsertProduct, request) as Promise<
          Awaited<ReturnType<RayzenDesktopApi["catalog"]["upsertProduct"]>>
        >;
      }
    },
    pdv: {
      async getOperationalSnapshot() {
        return renderer.invoke(IPC_CHANNELS.pdvGetOperationalSnapshot) as Promise<
          Awaited<ReturnType<RayzenDesktopApi["pdv"]["getOperationalSnapshot"]>>
        >;
      },
      async getComandaWorkspace(request) {
        return renderer.invoke(IPC_CHANNELS.comandaGetWorkspace, request) as Promise<
          Awaited<ReturnType<RayzenDesktopApi["pdv"]["getComandaWorkspace"]>>
        >;
      },
      async openComanda(request) {
        return renderer.invoke(IPC_CHANNELS.comandaOpen, request) as Promise<Awaited<ReturnType<RayzenDesktopApi["pdv"]["openComanda"]>>>;
      },
      async addComandaItem(request) {
        return renderer.invoke(IPC_CHANNELS.comandaAddItem, request) as Promise<Awaited<ReturnType<RayzenDesktopApi["pdv"]["addComandaItem"]>>>;
      },
      async cancelComandaItem(request) {
        return renderer.invoke(IPC_CHANNELS.comandaCancelItem, request) as Promise<Awaited<ReturnType<RayzenDesktopApi["pdv"]["cancelComandaItem"]>>>;
      },
      async sendComandaToProduction(request) {
        return renderer.invoke(IPC_CHANNELS.comandaSendToProduction, request) as Promise<
          Awaited<ReturnType<RayzenDesktopApi["pdv"]["sendComandaToProduction"]>>
        >;
      },
      async startComandaCheckout(request) {
        return renderer.invoke(IPC_CHANNELS.comandaStartCheckout, request) as Promise<
          Awaited<ReturnType<RayzenDesktopApi["pdv"]["startComandaCheckout"]>>
        >;
      },
      async reopenComanda(request) {
        return renderer.invoke(IPC_CHANNELS.comandaReopenComanda, request) as Promise<
          Awaited<ReturnType<RayzenDesktopApi["pdv"]["reopenComanda"]>>
        >;
      },
      async requestComandaCashCheckout(request) {
        return renderer.invoke(IPC_CHANNELS.comandaRequestCashCheckout, request) as Promise<
          Awaited<ReturnType<RayzenDesktopApi["pdv"]["requestComandaCashCheckout"]>>
        >;
      },
      async confirmComandaPayment(request) {
        return renderer.invoke(IPC_CHANNELS.comandaConfirmPayment, request) as Promise<
          Awaited<ReturnType<RayzenDesktopApi["pdv"]["confirmComandaPayment"]>>
        >;
      },
      async openCashSession(request) {
        return renderer.invoke(IPC_CHANNELS.cashOpenSession, request) as Promise<Awaited<ReturnType<RayzenDesktopApi["pdv"]["openCashSession"]>>>;
      },
      async registerCashReceipt(request) {
        return renderer.invoke(IPC_CHANNELS.cashRegisterReceipt, request) as Promise<
          Awaited<ReturnType<RayzenDesktopApi["pdv"]["registerCashReceipt"]>>
        >;
      },
      async registerCashSupply(request) {
        return renderer.invoke(IPC_CHANNELS.cashRegisterSupply, request) as Promise<
          Awaited<ReturnType<RayzenDesktopApi["pdv"]["registerCashSupply"]>>
        >;
      },
      async registerCashWithdrawal(request) {
        return renderer.invoke(IPC_CHANNELS.cashRegisterWithdrawal, request) as Promise<
          Awaited<ReturnType<RayzenDesktopApi["pdv"]["registerCashWithdrawal"]>>
        >;
      },
      async startCashClosure(request) {
        return renderer.invoke(IPC_CHANNELS.cashStartClosure, request) as Promise<
          Awaited<ReturnType<RayzenDesktopApi["pdv"]["startCashClosure"]>>
        >;
      },
      async closeCashSession(request) {
        return renderer.invoke(IPC_CHANNELS.cashCloseSession, request) as Promise<
          Awaited<ReturnType<RayzenDesktopApi["pdv"]["closeCashSession"]>>
        >;
      },
      async exportCashAudit() {
        return renderer.invoke(IPC_CHANNELS.cashExportAudit) as Promise<Awaited<ReturnType<RayzenDesktopApi["pdv"]["exportCashAudit"]>>>;
      }
    },
    cash: {
      async open(request) {
        return renderer.invoke(IPC_CHANNELS.cashOpenSession, request) as Promise<Awaited<ReturnType<RayzenDesktopApi["cash"]["open"]>>>;
      },
      async status() {
        return renderer.invoke(IPC_CHANNELS.cashGetStatus) as Promise<Awaited<ReturnType<RayzenDesktopApi["cash"]["status"]>>>;
      },
      async sangria(request) {
        return renderer.invoke(IPC_CHANNELS.cashRegisterWithdrawal, request) as Promise<Awaited<ReturnType<RayzenDesktopApi["cash"]["sangria"]>>>;
      },
      async suprimento(request) {
        return renderer.invoke(IPC_CHANNELS.cashRegisterSupply, request) as Promise<Awaited<ReturnType<RayzenDesktopApi["cash"]["suprimento"]>>>;
      },
      async fechar(request) {
        return renderer.invoke(IPC_CHANNELS.cashCloseSession, request) as Promise<Awaited<ReturnType<RayzenDesktopApi["cash"]["fechar"]>>>;
      },
      async resumo() {
        return renderer.invoke(IPC_CHANNELS.cashGetSummary) as Promise<Awaited<ReturnType<RayzenDesktopApi["cash"]["resumo"]>>>;
      }
    },
    fiscal: {
      async getStatus() {
        return renderer.invoke(IPC_CHANNELS.fiscalGetStatus) as Promise<Awaited<ReturnType<RayzenDesktopApi["fiscal"]["getStatus"]>>>;
      },
      async getDocumentStatus(request) {
        return renderer.invoke(IPC_CHANNELS.fiscalGetDocumentStatus, request) as Promise<
          Awaited<ReturnType<RayzenDesktopApi["fiscal"]["getDocumentStatus"]>>
        >;
      },
      async listPending(request) {
        return renderer.invoke(IPC_CHANNELS.fiscalListPending, request) as Promise<
          Awaited<ReturnType<RayzenDesktopApi["fiscal"]["listPending"]>>
        >;
      },
      async configureEmitter(request) {
        return renderer.invoke(IPC_CHANNELS.fiscalConfigureEmitter, request) as Promise<Awaited<ReturnType<RayzenDesktopApi["fiscal"]["configureEmitter"]>>>;
      },
      async queueNfce(request) {
        return renderer.invoke(IPC_CHANNELS.fiscalQueueNfce, request) as Promise<Awaited<ReturnType<RayzenDesktopApi["fiscal"]["queueNfce"]>>>;
      },
      async processQueue(request) {
        return renderer.invoke(IPC_CHANNELS.fiscalProcessQueue, request) as Promise<Awaited<ReturnType<RayzenDesktopApi["fiscal"]["processQueue"]>>>;
      },
      async reprocess(request) {
        return renderer.invoke(IPC_CHANNELS.fiscalReprocess, request) as Promise<
          Awaited<ReturnType<RayzenDesktopApi["fiscal"]["reprocess"]>>
        >;
      },
      async queryStatusByAccessKey(request) {
        return renderer.invoke(IPC_CHANNELS.fiscalQueryStatusByAccessKey, request) as Promise<
          Awaited<ReturnType<RayzenDesktopApi["fiscal"]["queryStatusByAccessKey"]>>
        >;
      }
    },
    print: {
      async getStatus() {
        return renderer.invoke(IPC_CHANNELS.printGetStatus) as Promise<Awaited<ReturnType<RayzenDesktopApi["print"]["getStatus"]>>>;
      },
      async listJobs(request) {
        return renderer.invoke(IPC_CHANNELS.printListJobs, request) as Promise<Awaited<ReturnType<RayzenDesktopApi["print"]["listJobs"]>>>;
      },
      async listPrinters() {
        return renderer.invoke(IPC_CHANNELS.printListPrinters) as Promise<Awaited<ReturnType<RayzenDesktopApi["print"]["listPrinters"]>>>;
      },
      async enqueueProduction(request) {
        return renderer.invoke(IPC_CHANNELS.printEnqueueProduction, request) as Promise<Awaited<ReturnType<RayzenDesktopApi["print"]["enqueueProduction"]>>>;
      },
      async processQueue(request) {
        return renderer.invoke(IPC_CHANNELS.printProcessQueue, request) as Promise<Awaited<ReturnType<RayzenDesktopApi["print"]["processQueue"]>>>;
      },
      async reprocessJob(request) {
        return renderer.invoke(IPC_CHANNELS.printReprocessJob, request) as Promise<Awaited<ReturnType<RayzenDesktopApi["print"]["reprocessJob"]>>>;
      },
      async reprintSecondCopy(request) {
        return renderer.invoke(IPC_CHANNELS.printReprintSecondCopy, request) as Promise<Awaited<ReturnType<RayzenDesktopApi["print"]["reprintSecondCopy"]>>>;
      }
    },
    team: {
      async listOperators() {
        return renderer.invoke(IPC_CHANNELS.operatorList) as Promise<Awaited<ReturnType<RayzenDesktopApi["team"]["listOperators"]>>>;
      },
      async saveOperator(request) {
        return renderer.invoke(IPC_CHANNELS.operatorSave, request) as Promise<Awaited<ReturnType<RayzenDesktopApi["team"]["saveOperator"]>>>;
      }
    },
    waiter: {
      async getStatus() {
        return renderer.invoke(IPC_CHANNELS.waiterGetStatus) as Promise<Awaited<ReturnType<RayzenDesktopApi["waiter"]["getStatus"]>>>;
      }
    }
  };
}

export function exposeRayzenDesktopApi(
  bridge: ContextBridgeLike,
  renderer: IpcRendererLike
): RayzenDesktopApi {
  const api = createRayzenDesktopApi(renderer);
  bridge.exposeInMainWorld("rayzenDesktop", api);
  return api;
}
