import { uiFoundation } from "@rayzen/ui";

import { applicationLayer } from "./application/index.js";
import { domainLayer } from "./domain/index.js";
import { featureLayer } from "./features/index.js";
import { infraLayer } from "./infra/index.js";
import { uiLayer } from "./ui/index.js";

export const pdvAppFoundation = {
  workspace: "@rayzen/pdv",
  runtime: "renderer",
  offlineFirst: true,
  authMode: "local-pin",
  transport: "electron-ipc",
  visualFoundation: uiFoundation,
  layers: [
    applicationLayer,
    domainLayer,
    featureLayer,
    infraLayer,
    uiLayer
  ]
} as const;

export type PdvAppFoundation = typeof pdvAppFoundation;

export {
  createPdvShellController,
  PdvShellController
} from "./application/index.js";
export {
  createDesktopBridge
} from "./infra/index.js";
export {
  SHELL_SHORTCUTS,
  MAIN_NAVIGATION,
  addComandaItem,
  calculateCashSessionTotals,
  calculateComandaTotals,
  cancelComandaItem,
  checkoutComanda,
  closeCashSession,
  createOperatorSession,
  exportCashSessionAudit,
  generateComandaPreConta,
  sanitizePinInput,
  openCashSession,
  openComanda,
  receiveCashPayment,
  registerCashSupply,
  registerCashWithdrawal,
  sendComandaToProduction,
  startCashClosure
} from "./domain/index.js";
export type {
  AuthenticationFailure,
  AuthenticationResult,
  CatalogProduct,
  CashActor,
  CashAuditEvent,
  CashAuditExport,
  CashPaymentMethod,
  CashSessionAggregate,
  ComandaActor,
  ComandaAggregate,
  ComandaAuditEvent,
  ComandaPaymentMethod,
  OperatorIdentity,
  OperatorSession,
  PreContaSnapshot
} from "./domain/index.js";
export {
  mountPdvShell,
  renderShell
} from "./ui/index.js";
