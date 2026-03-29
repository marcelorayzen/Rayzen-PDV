import type { PdvShellController } from "../application/index.js";
import {
  applyShellTheme,
  getPreferredFocusSelector,
  renderAuthRegion,
  renderCategorias,
  renderStatusStrip,
  renderShellScaffold,
  updatePedidoRegion,
  updateProdutosRegion
} from "./view.js";

export interface MountPdvShellOptions {
  container: HTMLElement;
  controller: PdvShellController;
}

export function mountPdvShell(options: MountPdvShellOptions): () => void {
  const { container, controller } = options;

  applyShellTheme(document.documentElement);
  const regions = ensureShellRegions(container);
  let shouldFocusProductList = false;

  const unsubscribe = controller.subscribe((state) => {
    const activeFieldSnapshot = captureActiveFieldSnapshot(container);
    const nextFocusSelector = getPreferredFocusSelector(state) ?? "";
    const workspaceVisible = !state.firstRunWorkspace.status?.firstRunPending && Boolean(state.session);

    regions.status.innerHTML = renderStatusStrip(state);
    regions.auth.innerHTML = renderAuthRegion(state);
    regions.auth.hidden = workspaceVisible;
    regions.workspace.hidden = !workspaceVisible;

    if (workspaceVisible) {
      regions.categorias.innerHTML = renderCategorias(state);
      updateProdutosRegion(regions.produtos, state);
      updatePedidoRegion(regions.pedido, state);
    } else {
      regions.categorias.innerHTML = "";
      regions.produtos.innerHTML = "";
      regions.pedido.innerHTML = "";
    }

    queueMicrotask(() => {
      if (restoreActiveFieldSnapshot(container, activeFieldSnapshot)) {
        return;
      }

      if (nextFocusSelector) {
        const focusTarget = container.querySelector<HTMLElement>(nextFocusSelector);

        if (focusTarget) {
          focusTarget.focus();
          controller.consumeFocus();
        }
      }

      if (shouldFocusProductList) {
        focusProductList(container);
        shouldFocusProductList = false;
      }
    });
  });

  const onClick = (event: MouseEvent) => {
    const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>("[data-action]") : null;

    if (!target) {
      return;
    }

    const action = target.dataset["action"];

    switch (action) {
      case "complete-first-run":
        void controller.completeFirstRun();
        return;
      case "save-brand-logo":
        void controller.saveBrandLogoConfiguration();
        return;
      case "pin-digit":
        if (target.dataset["value"]) {
          controller.appendPinDigit(target.dataset["value"]);
        }
        return;
      case "pin-backspace":
        controller.removePinDigit();
        return;
      case "pin-clear":
        controller.clearPin();
        return;
      case "submit-pin":
        void controller.submitPin();
        return;
      case "logout-session":
        void controller.logout();
        return;
      case "open-comanda":
        void controller.openComandaFromDraft();
        return;
      case "select-mesa-comanda":
        if (target.dataset["comandaId"]) {
          void controller.selectMesaComanda(target.dataset["comandaId"], target.dataset["viewId"] as never | undefined);
        }
        return;
      case "select-product":
        if (target.dataset["productId"]) {
          controller.selectCatalogProduct(target.dataset["productId"]);
        }
        return;
      case "add-selected-product":
        shouldFocusProductList = true;
        void controller.addSelectedProductToCurrentComanda();
        return;
      case "select-catalog-category":
        if (target.dataset["category"]) {
          controller.selectCatalogCategory(target.dataset["category"]);
        }
        return;
      case "add-product-quick":
        if (target.dataset["productId"]) {
          void controller.addProductToCurrentComanda(target.dataset["productId"]);
        }
        return;
      case "send-production":
        void controller.sendCurrentComandaToProduction();
        return;
      case "generate-preconta":
        void controller.generatePreContaForCurrentComanda();
        return;
      case "reopen-comanda":
        void controller.reopenCurrentComanda();
        return;
      case "request-cash-checkout":
        void controller.requestCurrentComandaCashCheckout();
        return;
      case "select-item":
        if (target.dataset["itemId"]) {
          controller.selectComandaItem(target.dataset["itemId"]);
        }
        return;
      case "cancel-selected-item":
        void controller.cancelSelectedItem();
        return;
      case "select-checkout-method":
        if (target.dataset["method"]) {
          controller.updateCheckoutMethodDraft(target.dataset["method"]);
        }
        return;
      case "fill-checkout-due":
        controller.fillCheckoutWithDueAmount();
        return;
      case "checkout-submit":
        void controller.checkoutCurrentComanda();
        return;
      case "open-cash-session":
        void controller.openCashSessionFromDraft();
        return;
      case "select-cash-method":
        if (target.dataset["method"]) {
          controller.updateCashReceiptMethodDraft(target.dataset["method"]);
        }
        return;
      case "register-cash-receipt":
        void controller.registerCashReceipt();
        return;
      case "register-cash-withdrawal":
        void controller.registerCashWithdrawal();
        return;
      case "register-cash-supply":
        void controller.registerCashSupply();
        return;
      case "start-cash-closure":
        void controller.startCashClosureFlow();
        return;
      case "confirm-cash-closure":
        void controller.closeCashSessionFromDraft();
        return;
      case "export-cash-audit":
        void controller.exportCashAuditBundle();
        return;
      case "navigate":
        if (target.dataset["viewId"]) {
          controller.navigate(target.dataset["viewId"] as never);
        }
        return;
      case "dismiss-feedback":
        controller.clearFeedback();
        return;
      case "catalog-open-form":
        controller.openCatalogNewProductForm();
        return;
      case "catalog-close-form":
        controller.closeCatalogNewProductForm();
        return;
      case "catalog-save-product":
        void controller.saveCatalogProduct();
        return;
      case "equipe-new-operator":
        controller.openTeamNewOperatorForm();
        return;
      case "equipe-select-operator":
        if (target.dataset["operatorId"]) {
          controller.selectTeamOperator(target.dataset["operatorId"]);
        }
        return;
      case "equipe-select-role":
        if (target.dataset["role"]) {
          controller.updateTeamRoleDraft(target.dataset["role"] as never);
        }
        return;
      case "equipe-save-operator":
        void controller.saveTeamOperator();
        return;
      case "equipe-deactivate-operator":
        if (target.dataset["operatorId"]) {
          void controller.deactivateTeamOperator(target.dataset["operatorId"]);
        }
        return;
      default:
        return;
    }
  };

  const onInput = (event: Event) => {
    if (!(event.target instanceof HTMLInputElement)) {
      return;
    }

    if (event.target.id === "pin-input") {
      controller.updatePinInput(event.target.value);
      return;
    }

    if (event.target.id === "setup-company-legal-name") {
      controller.updateFirstRunCompanyLegalName(event.target.value);
      return;
    }

    if (event.target.id === "setup-company-trade-name") {
      controller.updateFirstRunCompanyTradeName(event.target.value);
      return;
    }

    if (event.target.id === "setup-company-document") {
      controller.updateFirstRunCompanyDocument(event.target.value);
      return;
    }

    if (event.target.id === "setup-company-logo-file-path" || event.target.id === "brand-logo-file-path") {
      controller.updateFirstRunCompanyLogoFilePath(event.target.value);
      return;
    }

    if (event.target.id === "setup-printer-cozinha") {
      controller.updateFirstRunPrinterDraft("COZINHA", event.target.value);
      return;
    }

    if (event.target.id === "setup-printer-bar") {
      controller.updateFirstRunPrinterDraft("BAR", event.target.value);
      return;
    }

    if (event.target.id === "setup-printer-caixa") {
      controller.updateFirstRunPrinterDraft("CAIXA", event.target.value);
      return;
    }

    if (event.target.id === "product-search") {
      controller.updateProductSearch(event.target.value);
      return;
    }

    if (event.target.id === "comanda-numero") {
      controller.updateComandaNumeroDraft(event.target.value);
      return;
    }

    if (event.target.id === "mesa-draft") {
      controller.updateMesaDraft(event.target.value);
      return;
    }

    if (event.target.id === "item-quantity") {
      controller.updateQuantityDraft(event.target.value);
      return;
    }

    if (event.target.id === "item-note") {
      controller.updateItemNoteDraft(event.target.value);
      return;
    }

    if (event.target.id === "cancel-reason") {
      controller.updateCancelReasonDraft(event.target.value);
      return;
    }

    if (event.target.id === "checkout-amount") {
      controller.updateCheckoutAmountDraft(event.target.value);
      return;
    }

    if (event.target.id === "cash-opening-fund") {
      controller.updateCashOpeningFundDraft(event.target.value);
      return;
    }

    if (event.target.id === "cash-opening-reason") {
      controller.updateCashOpeningReasonDraft(event.target.value);
      return;
    }

    if (event.target.id === "cash-receipt-amount") {
      controller.updateCashReceiptAmountDraft(event.target.value);
      return;
    }

    if (event.target.id === "cash-receipt-reason") {
      controller.updateCashReceiptReasonDraft(event.target.value);
      return;
    }

    if (event.target.id === "cash-sangria-amount") {
      controller.updateCashSangriaAmountDraft(event.target.value);
      return;
    }

    if (event.target.id === "cash-sangria-reason") {
      controller.updateCashSangriaReasonDraft(event.target.value);
      return;
    }

    if (event.target.id === "cash-suprimento-amount") {
      controller.updateCashSuprimentoAmountDraft(event.target.value);
      return;
    }

    if (event.target.id === "cash-suprimento-reason") {
      controller.updateCashSuprimentoReasonDraft(event.target.value);
      return;
    }

    if (event.target.id === "cash-closure-note") {
      controller.updateCashClosureNoteDraft(event.target.value);
      return;
    }

    if (event.target.id === "cash-divergence-reason") {
      controller.updateCashDivergenceReasonDraft(event.target.value);
      return;
    }

    if (event.target.id.startsWith("cash-count-")) {
      const method = event.target.id.replace("cash-count-", "");
      controller.updateCashClosureCountDraft(method as never, event.target.value);
      return;
    }

    const catalogField = event.target.dataset["catalogField"] as "nomeDraft" | "categoriaDraft" | "setorDraft" | "precoDraft" | "shortcutHintDraft" | undefined;
    if (catalogField) {
      controller.updateCatalogDraftField(catalogField, event.target.value);
      return;
    }

    if (event.target.id === "equipe-operator-nome") {
      controller.updateTeamDraftField("nomeDraft", event.target.value);
      return;
    }

    if (event.target.id === "equipe-operator-code") {
      controller.updateTeamDraftField("codeDraft", event.target.value);
      return;
    }

    if (event.target.id === "equipe-operator-pin") {
      controller.updateTeamDraftField("pinDraft", event.target.value);
      return;
    }
  };

  const onCatalogFieldChange = (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) {
      return;
    }
    const catalogField = target.dataset["catalogField"] as "setorDraft" | undefined;
    if (catalogField) {
      controller.updateCatalogDraftField(catalogField, target.value);
    }
  };

  const onKeydown = (event: KeyboardEvent) => {
    if (controller.handleKeyboardEvent(event.key, event.target)) {
      event.preventDefault();
    }
  };

  container.addEventListener("click", onClick);
  container.addEventListener("input", onInput);
  container.addEventListener("change", onCatalogFieldChange);
  document.addEventListener("keydown", onKeydown);

  return () => {
    unsubscribe();
    container.removeEventListener("click", onClick);
    container.removeEventListener("input", onInput);
    container.removeEventListener("change", onCatalogFieldChange);
    document.removeEventListener("keydown", onKeydown);
  };
}

function focusProductList(container: HTMLElement): void {
  const productList = container.querySelector<HTMLElement>("#product-list");

  if (!productList) {
    return;
  }

  productList.focus();
  productList.querySelector<HTMLElement>(".catalog-card[aria-pressed='true']")?.scrollIntoView({
    block: "nearest"
  });
}

interface ShellRegions {
  status: HTMLElement;
  auth: HTMLElement;
  workspace: HTMLElement;
  categorias: HTMLElement;
  produtos: HTMLElement;
  pedido: HTMLElement;
}

function ensureShellRegions(container: HTMLElement): ShellRegions {
  let status = container.querySelector<HTMLElement>("#status-region");
  let auth = container.querySelector<HTMLElement>("#auth-region");
  let workspace = container.querySelector<HTMLElement>("#workspace-region");
  let categorias = container.querySelector<HTMLElement>("#categorias");
  let produtos = container.querySelector<HTMLElement>("#produtos");
  let pedido = container.querySelector<HTMLElement>("#pedido");

  if (!status || !auth || !workspace || !categorias || !produtos || !pedido) {
    container.innerHTML = renderShellScaffold();
    status = container.querySelector<HTMLElement>("#status-region");
    auth = container.querySelector<HTMLElement>("#auth-region");
    workspace = container.querySelector<HTMLElement>("#workspace-region");
    categorias = container.querySelector<HTMLElement>("#categorias");
    produtos = container.querySelector<HTMLElement>("#produtos");
    pedido = container.querySelector<HTMLElement>("#pedido");
  }

  if (!status || !auth || !workspace || !categorias || !produtos || !pedido) {
    throw new Error("Falha ao montar as regioes fixas do shell do PDV.");
  }

  return {
    status,
    auth,
    workspace,
    categorias,
    produtos,
    pedido
  };
}

interface ActiveFieldSnapshot {
  id: string;
  selectionStart: number | null;
  selectionEnd: number | null;
}

function captureActiveFieldSnapshot(container: HTMLElement): ActiveFieldSnapshot | null {
  const activeElement = document.activeElement;

  if (!(activeElement instanceof HTMLInputElement) || !container.contains(activeElement) || !activeElement.id) {
    return null;
  }

  return {
    id: activeElement.id,
    selectionStart: activeElement.selectionStart,
    selectionEnd: activeElement.selectionEnd
  };
}

function restoreActiveFieldSnapshot(
  container: HTMLElement,
  snapshot: ActiveFieldSnapshot | null
): boolean {
  if (!snapshot) {
    return false;
  }

  const nextField = container.querySelector<HTMLInputElement>(`#${CSS.escape(snapshot.id)}`);

  if (!nextField) {
    return false;
  }

  nextField.focus();

  if (snapshot.selectionStart !== null && snapshot.selectionEnd !== null) {
    nextField.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
  }

  return true;
}
