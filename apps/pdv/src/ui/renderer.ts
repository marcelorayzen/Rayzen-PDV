import type { PdvShellController } from "../application/index.js";
import { applyShellTheme, getPreferredFocusSelector, renderShell } from "./view.js";

export interface MountPdvShellOptions {
  container: HTMLElement;
  controller: PdvShellController;
}

export function mountPdvShell(options: MountPdvShellOptions): () => void {
  const { container, controller } = options;

  applyShellTheme(document.documentElement);

  let latestFocusSelector = "";

  const unsubscribe = controller.subscribe((state) => {
    const activeFieldSnapshot = captureActiveFieldSnapshot(container);
    container.innerHTML = renderShell(state);
    const nextFocusSelector = getPreferredFocusSelector(state) ?? "";

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
    });

    latestFocusSelector = nextFocusSelector;
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
      case "select-product":
        if (target.dataset["productId"]) {
          controller.selectCatalogProduct(target.dataset["productId"]);
        }
        return;
      case "add-selected-product":
        void controller.addSelectedProductToCurrentComanda();
        return;
      case "send-production":
        void controller.sendCurrentComandaToProduction();
        return;
      case "generate-preconta":
        void controller.generatePreContaForCurrentComanda();
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
    }
  };

  const onKeydown = (event: KeyboardEvent) => {
    if (controller.handleKeyboardEvent(event.key, event.target)) {
      event.preventDefault();
    }
  };

  container.addEventListener("click", onClick);
  container.addEventListener("input", onInput);
  document.addEventListener("keydown", onKeydown);

  return () => {
    unsubscribe();
    container.removeEventListener("click", onClick);
    container.removeEventListener("input", onInput);
    document.removeEventListener("keydown", onKeydown);
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
