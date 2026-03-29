import electron, { type App, type IpcMain } from "electron";

import { registerMainIpcHandlers, type RegisteredIpcHandlers } from "./ipc-server.js";
import { OperatorAuthService } from "./auth/service.js";
import { CatalogService } from "./catalog/service.js";
import { ElectronDatabaseService, type DatabaseServiceOptions } from "./db-service.js";
import { FiscalService } from "./fiscal/service.js";
import { MainProcessLogStore, type LogLevel } from "./log-store.js";
import { PdvRoundtripService } from "./pdv/service.js";
import { ensureMainProcessPaths, resolveMainProcessPaths, type MainProcessPaths } from "./paths.js";
import { PrintSpoolService, type PrintSpoolServiceOptions } from "./printing/service.js";
import { FirstRunSetupService } from "./setup/service.js";
import { OperationalSupportService } from "./support/service.js";
import { WaiterHttpServer } from "./waiter/http-server.js";
import {
  createRayzenMainWindow,
  getOpenWindowCount
} from "./window.js";
import {
  type CreateRayzenMainWindowOptions,
  type RayzenBrowserWindowLike
} from "./window-core.js";
import type { SafeStorageLike } from "./fiscal/secret-store.js";

const { app, ipcMain } = electron;

export interface ElectronMainBootstrapOptions {
  electronApp?: Pick<App, "whenReady" | "on" | "getVersion" | "isPackaged">;
  ipcMainInstance?: Pick<IpcMain, "handle" | "removeHandler">;
  programDataRoot?: string;
  logLevel?: LogLevel;
  database?: DatabaseServiceOptions;
  printing?: PrintSpoolServiceOptions;
  window?: CreateRayzenMainWindowOptions;
  safeStorage?: SafeStorageLike;
}

export interface ElectronMainContext {
  paths: MainProcessPaths;
  logger: MainProcessLogStore;
  database: ElectronDatabaseService;
  auth: OperatorAuthService;
  catalog: CatalogService;
  pdv: PdvRoundtripService;
  fiscal: FiscalService;
  printing: PrintSpoolService;
  setup: FirstRunSetupService;
  support: OperationalSupportService;
  waiter: WaiterHttpServer;
  mainWindow: RayzenBrowserWindowLike;
  dispose(): void;
}

export async function createElectronMainContext(
  options: ElectronMainBootstrapOptions = {}
): Promise<ElectronMainContext> {
  const electronApp = options.electronApp ?? app;
  const electronIpcMain = options.ipcMainInstance ?? ipcMain;

  await electronApp.whenReady();

  const paths = resolveMainProcessPaths(
    options.programDataRoot ? { programDataRoot: options.programDataRoot } : {}
  );
  ensureMainProcessPaths(paths);

  const logger = new MainProcessLogStore(
    options.logLevel
      ? {
          logsDir: paths.logsDir,
          appVersion: electronApp.getVersion(),
          environment: resolveEnvironment(electronApp.isPackaged),
          level: options.logLevel
        }
      : {
          logsDir: paths.logsDir,
          appVersion: electronApp.getVersion(),
          environment: resolveEnvironment(electronApp.isPackaged)
        }
  );

  const database = new ElectronDatabaseService(paths, options.database);
  database.start();
  const auth = new OperatorAuthService(database.client, logger);
  const catalog = new CatalogService(database.client);
  const printing = new PrintSpoolService(database.client, logger, paths, options.printing);
  const fiscal = new FiscalService(database.client, logger, paths, {
    safeStorage: options.safeStorage ?? electron.safeStorage
  });
  fiscal.start();
  const pdv = new PdvRoundtripService(database.client, logger, printing, {
    fiscal
  });
  const setup = new FirstRunSetupService(database.client, logger, paths, {
    appVersion: electronApp.getVersion()
  });
  const support = new OperationalSupportService(paths, logger, database, {
    appVersion: electronApp.getVersion(),
    environment: resolveEnvironment(electronApp.isPackaged),
    setup
  });

  const waiter = new WaiterHttpServer(auth, catalog, pdv, logger);
  waiter.start();

  const registeredHandlers = registerMainIpcHandlers(electronIpcMain, {
    appVersion: electronApp.getVersion(),
    environment: resolveEnvironment(electronApp.isPackaged),
    paths,
    logger,
    database,
    auth,
    catalog,
    pdv,
    fiscal,
    print: printing,
    setup,
    support,
    waiter
  });
  const mainWindow = createRayzenMainWindow(options.window);

  electronApp.on("activate", () => {
    if (getOpenWindowCount(options.window?.browserWindowConstructor) === 0) {
      createRayzenMainWindow(options.window);
    }
  });

  electronApp.on("before-quit", () => {
    logger.info("electron.main.before-quit");
    registeredHandlers.dispose();
    waiter.stop();
    fiscal.stop();
    printing.stop();
    database.close();
  });

  logger.info("electron.main.ready", {
    dbFilePath: paths.dbFilePath,
    logsDir: paths.logsDir
  });

  return {
    paths,
    logger,
    database,
    auth,
    catalog,
    pdv,
    fiscal,
    printing,
    setup,
    support,
    waiter,
    mainWindow: mainWindow.window,
    dispose() {
      waiter.stop();
      disposeMainContext(registeredHandlers, database, printing, fiscal);
    }
  };
}

export function bootstrapRayzenElectronMain(
  options?: ElectronMainBootstrapOptions
): Promise<ElectronMainContext> {
  return createElectronMainContext(options);
}

function disposeMainContext(
  handlers: RegisteredIpcHandlers,
  database: ElectronDatabaseService,
  printing: PrintSpoolService,
  fiscal: FiscalService
): void {
  handlers.dispose();
  fiscal.stop();
  printing.stop();
  database.close();
}

function resolveEnvironment(isPackaged: boolean): string {
  return process.env["RAYZEN_PDV_ENV"] ?? (isPackaged ? "production" : "development");
}
