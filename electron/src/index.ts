export { IPC_CHANNELS } from "./contracts/ipc.js";
export type {
  DatabaseStatusSnapshot,
  EnqueueProductionPrintRequest,
  EnqueueProductionPrintResult,
  ExportLogsRequest,
  ExportLogsResult,
  MainBootstrapSnapshot,
  MainHealthSnapshot,
  PrintDriverPrinterSnapshot,
  PrintRouteSnapshot,
  PrintSpoolJobSnapshot,
  PrintSpoolStatusSnapshot,
  ProcessPrintQueueRequest,
  ProcessPrintQueueResult,
  ReprintSecondCopyRequest
} from "./contracts/ipc.js";
export type { RayzenDesktopApi } from "./contracts/preload.js";
export {
  ensureMainProcessPaths,
  resolveMainProcessPaths
} from "./main/paths.js";
export type { MainProcessPaths, PathResolutionOptions } from "./main/paths.js";
export { MainProcessLogStore } from "./main/log-store.js";
export type { LogContextValue, LogLevel, LogStoreOptions } from "./main/log-store.js";
export { ElectronDatabaseService } from "./main/db-service.js";
export type { DatabaseServiceOptions } from "./main/db-service.js";
export { PrintSpoolService } from "./main/printing/service.js";
export type { PrintSpoolServiceOptions } from "./main/printing/service.js";
export { PdvRoundtripService } from "./main/pdv/service.js";
export type { PdvRoundtripServiceOptions } from "./main/pdv/service.js";
export {
  DEFAULT_PRINT_ROUTING_CONFIG,
  listSetorRoutes,
  resolvePrinterTargetsForSetor
} from "./main/printing/routing-config.js";
export type {
  PrintRoutingConfig,
  PrintRoutingSetorConfig
} from "./main/printing/routing-config.js";
export {
  renderKitchenTicket,
  isTicketPayload
} from "./main/printing/ticket-renderer.js";
export type {
  TicketActorPayload,
  TicketHeaderPayload,
  TicketItemPayload,
  TicketPayload
} from "./main/printing/ticket-renderer.js";
export { WindowsThermalPrinterDriver } from "./main/printing/windows-driver.js";
export type {
  CommandRunResult,
  CommandRunner,
  DriverPrintFailure,
  DriverPrintRequest,
  DriverPrintResult,
  DriverPrintSuccess,
  DriverPrinterSnapshot,
  ThermalPrinterDriver
} from "./main/printing/windows-driver.js";
export {
  registerMainIpcHandlers
} from "./main/ipc-server.js";
export type {
  IpcMainLike,
  MainProcessServices,
  RegisteredIpcHandlers
} from "./main/ipc-server.js";
export {
  bootstrapRayzenElectronMain,
  createElectronMainContext
} from "./main/runtime.js";
export type {
  ElectronMainBootstrapOptions,
  ElectronMainContext
} from "./main/runtime.js";
export {
  createRayzenDesktopApi,
  exposeRayzenDesktopApi
} from "./preload-api.js";
export type {
  ContextBridgeLike,
  IpcRendererLike
} from "./preload-api.js";
export {
  createRayzenMainWindow,
  getOpenWindowCount
} from "./main/window.js";
export {
  resolveRendererAssetPaths
} from "./main/window-core.js";
export type {
  CreateRayzenMainWindowOptions,
  CreatedRayzenMainWindow,
  RayzenBrowserWindowConstructor,
  RayzenBrowserWindowLike,
  RendererAssetPathOptions,
  RendererAssetPaths
} from "./main/window-core.js";
