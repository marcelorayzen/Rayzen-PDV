import type { CatalogProduct } from "./catalog.js";

import type {
  ComandaAggregate,
  ComandaAuditEvent,
  ComandaPaymentMethod,
  PreContaSnapshot
} from "./comanda/index.js";
import type {
  CashAuditEvent,
  CashAuditExport,
  CashPaymentMethod,
  CashSessionAggregate
} from "./cash/index.js";
import type { AuthenticationFailure, OperatorSession } from "./auth.js";
import { getDefaultViewForRole, type FocusTarget, type MainViewId } from "./navigation.js";
import type {
  InstallationStatusSnapshot,
  PrintDriverPrinterSnapshot
} from "../infra/desktop-api.js";

export interface RendererBootstrapStatus {
  appVersion: string;
  environment: string;
  offlineFirst: true;
  httpApiEnabled: false;
  ipcMode: "electron-ipc" | "unavailable";
  databaseReady: boolean;
  logFilePath: string | null;
}

export interface RendererHealthStatus {
  ready: boolean;
  databaseReady: boolean;
  httpApiEnabled: false;
  ipcMode: "electron-ipc" | "unavailable";
  dbFilePath: string | null;
  logFilePath: string | null;
}

export interface RuntimeSnapshot {
  bootstrap: RendererBootstrapStatus;
  health: RendererHealthStatus;
}

export interface ComandaWorkspaceState {
  currentComanda: ComandaAggregate | null;
  auditTrail: ComandaAuditEvent[];
  catalogProducts: CatalogProduct[];
  selectedCatalogProductId: string | null;
  selectedItemId: string | null;
  comandaNumeroDraft: string;
  mesaDraft: string;
  quantityDraft: string;
  itemNoteDraft: string;
  cancelReasonDraft: string;
  checkoutAmountDraft: string;
  checkoutMethodDraft: ComandaPaymentMethod;
  lastPreContaSnapshot: PreContaSnapshot | null;
}

export interface CashWorkspaceState {
  currentSession: CashSessionAggregate | null;
  auditTrail: CashAuditEvent[];
  auditExport: CashAuditExport | null;
  openingFundDraft: string;
  openingReasonDraft: string;
  receiptAmountDraft: string;
  receiptMethodDraft: CashPaymentMethod;
  receiptReasonDraft: string;
  sangriaAmountDraft: string;
  sangriaReasonDraft: string;
  suprimentoAmountDraft: string;
  suprimentoReasonDraft: string;
  closureCountDrafts: Record<CashPaymentMethod, string>;
  closureNoteDraft: string;
  divergenceReasonDraft: string;
}

export interface FirstRunWorkspaceState {
  status: InstallationStatusSnapshot | null;
  availablePrinters: PrintDriverPrinterSnapshot[];
  companyLegalNameDraft: string;
  companyTradeNameDraft: string;
  companyDocumentDraft: string;
  cozinhaPrinterDraft: string;
  barPrinterDraft: string;
  caixaPrinterDraft: string;
  submitting: boolean;
}

export interface ShellState {
  bootstrapping: boolean;
  bootstrap: RendererBootstrapStatus;
  health: RendererHealthStatus;
  pinInput: string;
  authError: AuthenticationFailure | null;
  authStatus: "idle" | "submitting";
  session: OperatorSession | null;
  currentViewId: MainViewId;
  focusTarget: FocusTarget | null;
  feedbackMessage: string | null;
  feedbackTone: "info" | "error";
  productSearch: string;
  lastShortcut: string | null;
  firstRunWorkspace: FirstRunWorkspaceState;
  comandaWorkspace: ComandaWorkspaceState;
  cashWorkspace: CashWorkspaceState;
}

export type ShellEvent =
  | { type: "runtime-loaded"; runtime: RuntimeSnapshot }
  | {
      type: "first-run-loaded";
      status: InstallationStatusSnapshot;
      availablePrinters: PrintDriverPrinterSnapshot[];
    }
  | {
      type: "first-run-draft-updated";
      workspace: FirstRunWorkspaceState;
    }
  | {
      type: "first-run-submitting";
    }
  | {
      type: "first-run-completed";
      status: InstallationStatusSnapshot;
      availablePrinters: PrintDriverPrinterSnapshot[];
    }
  | { type: "pin-updated"; pinInput: string }
  | { type: "auth-started" }
  | { type: "auth-succeeded"; session: OperatorSession }
  | { type: "auth-logged-out" }
  | { type: "auth-failed"; failure: AuthenticationFailure }
  | { type: "navigation-changed"; viewId: MainViewId; focusTarget: FocusTarget | null; message: string | null }
  | { type: "product-search-updated"; query: string }
  | { type: "comanda-workspace-updated"; workspace: ComandaWorkspaceState }
  | { type: "cash-workspace-updated"; workspace: CashWorkspaceState }
  | { type: "feedback-updated"; message: string | null; tone: "info" | "error" }
  | { type: "focus-requested"; focusTarget: FocusTarget | null }
  | { type: "feedback-cleared" }
  | { type: "focus-consumed" };

export function createInitialShellState(): ShellState {
  return {
    bootstrapping: true,
    bootstrap: {
      appVersion: "0.1.0-dev",
      environment: "development",
      offlineFirst: true,
      httpApiEnabled: false,
      ipcMode: "unavailable",
      databaseReady: false,
      logFilePath: null
    },
    health: {
      ready: false,
      databaseReady: false,
      httpApiEnabled: false,
      ipcMode: "unavailable",
      dbFilePath: null,
      logFilePath: null
    },
    pinInput: "",
    authError: null,
    authStatus: "idle",
    session: null,
    currentViewId: "comandas",
    focusTarget: "pin-input",
    feedbackMessage: "Shell local pronto para operar offline-first.",
    feedbackTone: "info",
    productSearch: "",
    lastShortcut: null,
    firstRunWorkspace: {
      status: null,
      availablePrinters: [],
      companyLegalNameDraft: "",
      companyTradeNameDraft: "",
      companyDocumentDraft: "",
      cozinhaPrinterDraft: "IMP_COZINHA_01",
      barPrinterDraft: "IMP_BAR_01",
      caixaPrinterDraft: "IMP_CAIXA_01",
      submitting: false
    },
    comandaWorkspace: {
      currentComanda: null,
      auditTrail: [],
      catalogProducts: [],
      selectedCatalogProductId: null,
      selectedItemId: null,
      comandaNumeroDraft: "101",
      mesaDraft: "M12",
      quantityDraft: "1",
      itemNoteDraft: "",
      cancelReasonDraft: "",
      checkoutAmountDraft: "",
      checkoutMethodDraft: "PIX",
      lastPreContaSnapshot: null
    },
    cashWorkspace: {
      currentSession: null,
      auditTrail: [],
      auditExport: null,
      openingFundDraft: "150,00",
      openingReasonDraft: "troco inicial do turno",
      receiptAmountDraft: "",
      receiptMethodDraft: "DINHEIRO",
      receiptReasonDraft: "",
      sangriaAmountDraft: "",
      sangriaReasonDraft: "",
      suprimentoAmountDraft: "",
      suprimentoReasonDraft: "",
      closureCountDrafts: {
        DINHEIRO: "",
        PIX: "",
        CARTAO_CREDITO: "",
        CARTAO_DEBITO: "",
        OUTRO: ""
      },
      closureNoteDraft: "",
      divergenceReasonDraft: ""
    }
  };
}

export function reduceShellState(state: ShellState, event: ShellEvent): ShellState {
  switch (event.type) {
    case "runtime-loaded":
      return {
        ...state,
        bootstrapping: false,
        bootstrap: event.runtime.bootstrap,
        health: event.runtime.health
      };
    case "first-run-loaded":
      return {
        ...state,
        firstRunWorkspace: {
          ...state.firstRunWorkspace,
          status: event.status,
          availablePrinters: event.availablePrinters,
          companyLegalNameDraft: event.status.company?.legalName ?? "",
          companyTradeNameDraft: event.status.company?.tradeName ?? "",
          companyDocumentDraft: event.status.company?.document ?? "",
          cozinhaPrinterDraft: event.status.printRoutes.find((route) => route.setor === "COZINHA")?.impressoras[0] ?? "IMP_COZINHA_01",
          barPrinterDraft: event.status.printRoutes.find((route) => route.setor === "BAR")?.impressoras[0] ?? "IMP_BAR_01",
          caixaPrinterDraft: event.status.printRoutes.find((route) => route.setor === "CAIXA")?.impressoras[0] ?? "IMP_CAIXA_01",
          submitting: false
        },
        focusTarget: event.status.firstRunPending ? "setup-company-legal-name" : state.focusTarget,
        feedbackMessage: event.status.firstRunPending
          ? "Conclua o first-run local antes de liberar o login do terminal."
          : state.feedbackMessage,
        feedbackTone: event.status.firstRunPending ? "info" : state.feedbackTone
      };
    case "first-run-draft-updated":
      return {
        ...state,
        firstRunWorkspace: event.workspace
      };
    case "first-run-submitting":
      return {
        ...state,
        firstRunWorkspace: {
          ...state.firstRunWorkspace,
          submitting: true
        },
        feedbackMessage: "Aplicando configuracao inicial do terminal.",
        feedbackTone: "info"
      };
    case "first-run-completed":
      return {
        ...state,
        firstRunWorkspace: {
          ...state.firstRunWorkspace,
          status: event.status,
          availablePrinters: event.availablePrinters,
          submitting: false
        },
        focusTarget: "pin-input",
        feedbackMessage: "First-run concluido. Agora confirme o PIN local para liberar o terminal.",
        feedbackTone: "info"
      };
    case "pin-updated":
      return {
        ...state,
        pinInput: event.pinInput,
        authError: null
      };
    case "auth-started":
      return {
        ...state,
        authStatus: "submitting",
        authError: null,
        feedbackMessage: "Validando credencial local no terminal.",
        feedbackTone: "info"
      };
    case "auth-succeeded":
      return {
        ...state,
        authStatus: "idle",
        authError: null,
        pinInput: "",
        session: event.session,
        currentViewId: getDefaultViewForRole(event.session.role),
        focusTarget: "comanda-numero",
        feedbackMessage: `Sessao local iniciada para ${event.session.operatorCode}.`,
        feedbackTone: "info"
      };
    case "auth-logged-out":
      return {
        ...state,
        pinInput: "",
        authError: null,
        authStatus: "idle",
        session: null,
        currentViewId: "comandas",
        focusTarget: "pin-input",
        feedbackMessage: "Sessao local encerrada neste terminal.",
        feedbackTone: "info"
      };
    case "auth-failed":
      return {
        ...state,
        authStatus: "idle",
        authError: event.failure,
        feedbackMessage: event.failure.message,
        feedbackTone: "error",
        focusTarget: "pin-input"
      };
    case "navigation-changed":
      return {
        ...state,
        currentViewId: event.viewId,
        focusTarget: event.focusTarget,
        feedbackMessage: event.message,
        feedbackTone: "info"
      };
    case "product-search-updated":
      return {
        ...state,
        productSearch: event.query
      };
    case "comanda-workspace-updated":
      return {
        ...state,
        comandaWorkspace: event.workspace
      };
    case "cash-workspace-updated":
      return {
        ...state,
        cashWorkspace: event.workspace
      };
    case "feedback-updated":
      return {
        ...state,
        feedbackMessage: event.message,
        feedbackTone: event.tone
      };
    case "focus-requested":
      return {
        ...state,
        focusTarget: event.focusTarget
      };
    case "feedback-cleared":
      return {
        ...state,
        feedbackMessage: null,
        authError: null,
        lastShortcut: null
      };
    case "focus-consumed":
      return {
        ...state,
        focusTarget: null
      };
  }
}
