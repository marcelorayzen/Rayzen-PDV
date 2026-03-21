export const domainLayer = {
  name: "domain",
  responsibility: "Keep critical operational rules isolated from UI and framework code."
} as const;

export {
  OPERATOR_ROLES,
  createOperatorSession,
  describeRole,
  isPinReady,
  sanitizePinInput
} from "./auth.js";
export type {
  AuthenticationFailure,
  AuthenticationResult,
  OperatorIdentity,
  OperatorRole,
  OperatorSession
} from "./auth.js";
export {
  MAIN_NAVIGATION,
  SHELL_SHORTCUTS,
  canAccessView,
  getDefaultViewForRole,
  getMainNavigationForRole,
  getNavigationDefinition,
  normalizeShortcutKey,
  resolveShortcutNavigation
} from "./navigation.js";
export type {
  FocusTarget,
  MainNavigationDefinition,
  MainViewId,
  ShortcutKey
} from "./navigation.js";
export {
  createInitialShellState,
  reduceShellState
} from "./shell-state.js";
export type { CatalogProduct } from "./catalog.js";
export type {
  RendererBootstrapStatus,
  RendererHealthStatus,
  RuntimeSnapshot,
  ShellEvent,
  ShellState
} from "./shell-state.js";
export {
  addComandaItem,
  calculateComandaTotals,
  cancelComanda,
  cancelComandaItem,
  checkoutComanda,
  generateComandaPreConta,
  openComanda,
  sendComandaToProduction,
  ComandaDomainError
} from "./comanda/index.js";
export type {
  AddComandaItemInput,
  CancelComandaInput,
  CancelComandaItemInput,
  CheckoutComandaInput,
  CheckoutPaymentInput,
  ComandaActor,
  ComandaAggregate,
  ComandaAuditEvent,
  ComandaItem,
  ComandaItemStatus,
  ComandaMutationResult,
  ComandaPayment,
  ComandaPaymentMethod,
  ComandaPaymentStatus,
  ComandaStatus,
  ComandaTotals,
  GeneratePreContaInput,
  OpenComandaInput,
  PreContaSnapshot,
  ProductionBatch,
  SendToProductionInput
} from "./comanda/index.js";
export {
  calculateCashSessionTotals,
  closeCashSession,
  exportCashSessionAudit,
  openCashSession,
  receiveCashPayment,
  registerCashSupply,
  registerCashWithdrawal,
  startCashClosure,
  CashDomainError
} from "./cash/index.js";
export type {
  CashActor,
  CashAuditEvent,
  CashAuditExport,
  CashClosureSummary,
  CashCountedAmount,
  CashMethodTotal,
  CashMovement,
  CashMovementType,
  CashMutationResult,
  CashPaymentMethod,
  CashSessionAggregate,
  CashSessionStatus,
  CashSessionTotals,
  CloseCashSessionInput,
  OpenCashSessionInput,
  ReceiveCashPaymentInput,
  RegisterCashSupplyInput,
  RegisterCashWithdrawalInput,
  StartCashClosureInput
} from "./cash/index.js";
