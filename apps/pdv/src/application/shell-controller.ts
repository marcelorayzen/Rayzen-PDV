import { CHECKOUT_METHODS } from "./comanda-fixtures.js";
import type { DesktopBridge } from "./types.js";
import {
  calculateCashSessionTotals,
  calculateComandaTotals,
  canAccessView,
  createInitialShellState,
  normalizeShortcutKey,
  reduceShellState,
  resolveShortcutNavigation,
  sanitizePinInput,
  type CashActor,
  type CashPaymentMethod,
  type ComandaActor,
  type ComandaPaymentMethod,
  type FocusTarget,
  type MainViewId,
  type ShellState,
  type TeamWorkspaceState
} from "../domain/index.js";
import type {
  CashWorkspaceSnapshot,
  ComandaWorkspaceSnapshot,
  OperationalSnapshot
} from "../infra/desktop-api.js";

export interface ShellControllerDependencies {
  desktopBridge: DesktopBridge;
}

export type ShellStateListener = (state: ShellState) => void;

export class PdvShellController {
  readonly #desktopBridge: DesktopBridge;
  readonly #listeners = new Set<ShellStateListener>();
  #state = createInitialShellState();
  #sequence = 0;

  constructor(dependencies: ShellControllerDependencies) {
    this.#desktopBridge = dependencies.desktopBridge;
  }

  getState(): ShellState {
    return this.#state;
  }

  subscribe(listener: ShellStateListener): () => void {
    this.#listeners.add(listener);
    listener(this.#state);

    return () => {
      this.#listeners.delete(listener);
    };
  }

  async start(): Promise<void> {
    const [runtime, installation, session, catalogProducts, operational, availablePrinters, operators, waiterStatus] = await Promise.all([
      this.#desktopBridge.getRuntimeSnapshot(),
      this.#desktopBridge.getInstallationStatus(),
      this.#desktopBridge.getOperatorSession(),
      this.#desktopBridge.listCatalogProducts(),
      this.#desktopBridge.getOperationalSnapshot(),
      this.#desktopBridge.listPrintPrinters(),
      this.#desktopBridge.listOperators(),
      this.#desktopBridge.getWaiterStatus()
    ]);

    this.#dispatch({
      type: "runtime-loaded",
      runtime
    });
    this.#dispatch({
      type: "first-run-loaded",
      status: installation,
      availablePrinters
    });
    this.#syncComandaWorkspace({
      ...this.#state.comandaWorkspace,
      catalogProducts,
      selectedCatalogProductId: catalogProducts[0]?.productId ?? null,
      selectedCatalogCategory: catalogProducts[0]?.category ?? null
    });
    this.#applyOperationalSnapshot(operational);
    this.#syncTeamWorkspace({
      ...this.#state.teamWorkspace,
      operators
    });
    this.#dispatch({
      type: "waiter-status-loaded",
      url: waiterStatus?.url ?? null
    });

    if (session) {
      this.#dispatch({
        type: "auth-succeeded",
        session
      });
    }
  }

  updateFirstRunCompanyLegalName(value: string): void {
    this.#syncFirstRunWorkspace({
      ...this.#state.firstRunWorkspace,
      companyLegalNameDraft: value.slice(0, 80)
    });
  }

  updateFirstRunCompanyTradeName(value: string): void {
    this.#syncFirstRunWorkspace({
      ...this.#state.firstRunWorkspace,
      companyTradeNameDraft: value.slice(0, 80)
    });
  }

  updateFirstRunCompanyDocument(value: string): void {
    this.#syncFirstRunWorkspace({
      ...this.#state.firstRunWorkspace,
      companyDocumentDraft: value.replace(/[^\d./-]/g, "").slice(0, 18)
    });
  }

  updateFirstRunCompanyLogoFilePath(value: string): void {
    this.#syncFirstRunWorkspace({
      ...this.#state.firstRunWorkspace,
      companyLogoFilePathDraft: value.trim().slice(0, 260)
    });
  }

  updateFirstRunPrinterDraft(setor: "COZINHA" | "BAR" | "CAIXA", value: string): void {
    const trimmed = value.trim().slice(0, 80);

    this.#syncFirstRunWorkspace({
      ...this.#state.firstRunWorkspace,
      cozinhaPrinterDraft: setor === "COZINHA" ? trimmed : this.#state.firstRunWorkspace.cozinhaPrinterDraft,
      barPrinterDraft: setor === "BAR" ? trimmed : this.#state.firstRunWorkspace.barPrinterDraft,
      caixaPrinterDraft: setor === "CAIXA" ? trimmed : this.#state.firstRunWorkspace.caixaPrinterDraft
    });
  }

  async completeFirstRun(): Promise<void> {
    if (!this.#state.firstRunWorkspace.status?.firstRunPending || this.#state.firstRunWorkspace.submitting) {
      return;
    }

    if (this.#state.firstRunWorkspace.companyLegalNameDraft.trim().length < 3) {
      this.#setFeedback("Informe o nome da empresa antes de concluir o first-run.", "error");
      return;
    }

    this.#dispatch({
      type: "first-run-submitting"
    });

    try {
      const status = await this.#desktopBridge.completeFirstRun({
        companyLegalName: this.#state.firstRunWorkspace.companyLegalNameDraft,
        companyTradeName: this.#state.firstRunWorkspace.companyTradeNameDraft || null,
        companyDocument: this.#state.firstRunWorkspace.companyDocumentDraft || null,
        companyLogoFilePath: this.#state.firstRunWorkspace.companyLogoFilePathDraft || null,
        printers: {
          cozinha: this.#state.firstRunWorkspace.cozinhaPrinterDraft,
          bar: this.#state.firstRunWorkspace.barPrinterDraft,
          caixa: this.#state.firstRunWorkspace.caixaPrinterDraft
        },
        occurredAt: new Date().toISOString()
      });
      const availablePrinters = await this.#desktopBridge.listPrintPrinters();

      this.#dispatch({
        type: "first-run-completed",
        status,
        availablePrinters
      });
    } catch (error) {
      this.#handleDomainError(error);
      this.#syncFirstRunWorkspace({
        ...this.#state.firstRunWorkspace,
        submitting: false
      });
    }
  }

  updatePinInput(pinInput: string): void {
    this.#dispatch({
      type: "pin-updated",
      pinInput: sanitizePinInput(pinInput)
    });
  }

  appendPinDigit(value: string): void {
    if (!/^\d$/.test(value)) {
      return;
    }

    this.updatePinInput(`${this.#state.pinInput}${value}`);
  }

  removePinDigit(): void {
    this.updatePinInput(this.#state.pinInput.slice(0, -1));
  }

  clearPin(): void {
    this.updatePinInput("");
  }

  updateProductSearch(query: string): void {
    this.#dispatch({
      type: "product-search-updated",
      query
    });

    const filteredProducts = this.getFilteredCatalogProducts(query);
    const selectedCatalogProductId = filteredProducts[0]?.productId ?? null;

    this.#syncComandaWorkspace({
      ...this.#state.comandaWorkspace,
      selectedCatalogProductId
    });
  }

  updateComandaNumeroDraft(value: string): void {
    this.#syncComandaWorkspace({
      ...this.#state.comandaWorkspace,
      comandaNumeroDraft: value.replace(/\D+/g, "").slice(0, 6)
    });
  }

  updateMesaDraft(value: string): void {
    this.#syncComandaWorkspace({
      ...this.#state.comandaWorkspace,
      mesaDraft: value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 6)
    });
  }

  updateQuantityDraft(value: string): void {
    const sanitized = value.replace(/[^\d.]/g, "");
    this.#syncComandaWorkspace({
      ...this.#state.comandaWorkspace,
      quantityDraft: sanitized.length > 0 ? sanitized : "1"
    });
  }

  updateItemNoteDraft(value: string): void {
    this.#syncComandaWorkspace({
      ...this.#state.comandaWorkspace,
      itemNoteDraft: value.slice(0, 80)
    });
  }

  updateCancelReasonDraft(value: string): void {
    this.#syncComandaWorkspace({
      ...this.#state.comandaWorkspace,
      cancelReasonDraft: value.slice(0, 80)
    });
  }

  updateCheckoutAmountDraft(value: string): void {
    this.#syncComandaWorkspace({
      ...this.#state.comandaWorkspace,
      checkoutAmountDraft: value.replace(/[^\d.,]/g, "").slice(0, 12)
    });
  }

  updateCheckoutMethodDraft(method: string): void {
    if (!CHECKOUT_METHODS.includes(method as ComandaPaymentMethod)) {
      return;
    }

    this.#syncComandaWorkspace({
      ...this.#state.comandaWorkspace,
      checkoutMethodDraft: method as ComandaPaymentMethod
    });
  }

  updateCashOpeningFundDraft(value: string): void {
    this.#syncCashWorkspace({
      ...this.#state.cashWorkspace,
      openingFundDraft: sanitizeAmountDraft(value)
    });
  }

  updateCashOpeningReasonDraft(value: string): void {
    this.#syncCashWorkspace({
      ...this.#state.cashWorkspace,
      openingReasonDraft: value.slice(0, 80)
    });
  }

  updateCashReceiptAmountDraft(value: string): void {
    this.#syncCashWorkspace({
      ...this.#state.cashWorkspace,
      receiptAmountDraft: sanitizeAmountDraft(value)
    });
  }

  updateCashReceiptReasonDraft(value: string): void {
    this.#syncCashWorkspace({
      ...this.#state.cashWorkspace,
      receiptReasonDraft: value.slice(0, 80)
    });
  }

  updateCashReceiptMethodDraft(method: string): void {
    if (!CHECKOUT_METHODS.includes(method as CashPaymentMethod)) {
      return;
    }

    this.#syncCashWorkspace({
      ...this.#state.cashWorkspace,
      receiptMethodDraft: method as CashPaymentMethod
    });
  }

  updateCashSangriaAmountDraft(value: string): void {
    this.#syncCashWorkspace({
      ...this.#state.cashWorkspace,
      sangriaAmountDraft: sanitizeAmountDraft(value)
    });
  }

  updateCashSangriaReasonDraft(value: string): void {
    this.#syncCashWorkspace({
      ...this.#state.cashWorkspace,
      sangriaReasonDraft: value.slice(0, 80)
    });
  }

  updateCashSuprimentoAmountDraft(value: string): void {
    this.#syncCashWorkspace({
      ...this.#state.cashWorkspace,
      suprimentoAmountDraft: sanitizeAmountDraft(value)
    });
  }

  updateCashSuprimentoReasonDraft(value: string): void {
    this.#syncCashWorkspace({
      ...this.#state.cashWorkspace,
      suprimentoReasonDraft: value.slice(0, 80)
    });
  }

  updateCashClosureCountDraft(method: CashPaymentMethod, value: string): void {
    this.#syncCashWorkspace({
      ...this.#state.cashWorkspace,
      closureCountDrafts: {
        ...this.#state.cashWorkspace.closureCountDrafts,
        [method]: sanitizeAmountDraft(value)
      }
    });
  }

  updateCashClosureNoteDraft(value: string): void {
    this.#syncCashWorkspace({
      ...this.#state.cashWorkspace,
      closureNoteDraft: value.slice(0, 120)
    });
  }

  updateCashDivergenceReasonDraft(value: string): void {
    this.#syncCashWorkspace({
      ...this.#state.cashWorkspace,
      divergenceReasonDraft: value.slice(0, 120)
    });
  }

  selectCatalogProduct(productId: string): void {
    this.#syncComandaWorkspace({
      ...this.#state.comandaWorkspace,
      selectedCatalogProductId: productId
    });
  }

  openCatalogNewProductForm(): void {
    this.#dispatch({
      type: "catalog-draft-updated",
      draft: {
        mode: "new",
        nomeDraft: "",
        categoriaDraft: "",
        setorDraft: "BAR",
        precoDraft: "",
        shortcutHintDraft: ""
      }
    });
  }

  closeCatalogNewProductForm(): void {
    this.#dispatch({
      type: "catalog-draft-updated",
      draft: { ...this.#state.catalogDraft, mode: "list" }
    });
  }

  updateCatalogDraftField(field: "nomeDraft" | "categoriaDraft" | "setorDraft" | "precoDraft" | "shortcutHintDraft", value: string): void {
    this.#dispatch({
      type: "catalog-draft-updated",
      draft: { ...this.#state.catalogDraft, [field]: value }
    });
  }

  async saveCatalogProduct(): Promise<void> {
    const draft = this.#state.catalogDraft;
    const nome = draft.nomeDraft.trim();
    const categoria = draft.categoriaDraft.trim();
    const setor = draft.setorDraft.trim();
    const precoCents = Math.round(
      Number.parseFloat(draft.precoDraft.replace(",", ".")) * 100
    );
    const shortcutHint = draft.shortcutHintDraft.trim();

    if (!nome || !categoria || !setor || !Number.isFinite(precoCents) || precoCents < 0) {
      this.#setFeedback("Preencha todos os campos obrigatorios: nome, categoria, setor e preco.", "error");
      return;
    }

    try {
      const saved = await this.#desktopBridge.upsertCatalogProduct({
        nome,
        categoria,
        setor,
        precoCents,
        shortcutHint: shortcutHint || nome.substring(0, 2).toUpperCase()
      });

      const updatedProducts = [...this.#state.comandaWorkspace.catalogProducts];
      const existingIdx = updatedProducts.findIndex((p) => p.productId === saved.productId);

      if (existingIdx >= 0) {
        updatedProducts[existingIdx] = saved;
      } else {
        updatedProducts.push(saved);
      }

      this.#syncComandaWorkspace({
        ...this.#state.comandaWorkspace,
        catalogProducts: updatedProducts
      });

      this.#dispatch({
        type: "catalog-draft-updated",
        draft: {
          mode: "list",
          nomeDraft: "",
          categoriaDraft: "",
          setorDraft: "BAR",
          precoDraft: "",
          shortcutHintDraft: ""
        }
      });
      this.#setFeedback(`Produto "${saved.label}" salvo no catalogo.`, "info");
    } catch (error) {
      this.#handleDomainError(error);
    }
  }

  selectCatalogCategory(category: string): void {
    this.#syncComandaWorkspace({
      ...this.#state.comandaWorkspace,
      selectedCatalogCategory: category
    });
  }

  async addProductToCurrentComanda(productId: string): Promise<void> {
    const actor = this.#requireComandaActor();
    const currentComanda = this.#getSelectedComanda();

    if (!actor || !currentComanda) {
      this.#setFeedback("Abra uma comanda antes de lancar itens.", "error");
      return;
    }

    const product = this.#state.comandaWorkspace.catalogProducts.find((p) => p.productId === productId);

    if (!product) {
      this.#setFeedback("Produto nao encontrado.", "error");
      return;
    }

    try {
      const workspace = await this.#desktopBridge.addComandaItem({
        comandaId: currentComanda.comandaId,
        produtoId: product.productId,
        productLabel: product.label,
        setor: product.setor,
        quantity: 1,
        unitPriceCents: product.unitPriceCents,
        note: null,
        actor
      });

      this.#applyComandaWorkspaceSnapshot(workspace, {
        selectedItemId: workspace.currentComanda?.items.at(-1)?.itemId ?? null,
        itemNoteDraft: "",
        quantityDraft: "1"
      });
      this.#setFeedback(`${product.label} adicionado.`, "info");
    } catch (error) {
      this.#handleDomainError(error);
    }
  }

  selectComandaItem(itemId: string): void {
    this.#syncComandaWorkspace({
      ...this.#state.comandaWorkspace,
      selectedItemId: itemId
    });
  }

  async selectMesaComanda(comandaId: string, nextViewId?: MainViewId): Promise<void> {
    const activeComanda = this.#state.comandaWorkspace.activeComandas.find((item) => item.comandaId === comandaId);

    if (!activeComanda) {
      return;
    }

    try {
      const workspace = await this.#desktopBridge.getComandaWorkspace({
        comandaId
      });

      this.#applyComandaWorkspaceSnapshot(workspace, {
        selectedComandaId: comandaId,
        comandaNumeroDraft: workspace.currentComanda?.numero ?? this.#state.comandaWorkspace.comandaNumeroDraft,
        mesaDraft: workspace.currentComanda?.mesaId ?? "",
        cancelReasonDraft: "",
        checkoutAmountDraft: ""
      });

      if (nextViewId) {
        this.navigate(nextViewId);
        this.#dispatch({
          type: "focus-requested",
          focusTarget: nextViewId === "comandas" ? "product-search" : this.#resolveFocusForView(nextViewId)
        });
      }

      this.#setFeedback(
        `Comanda ${workspace.currentComanda?.numero ?? activeComanda.numero} pronta para continuidade${workspace.currentComanda?.mesaId ? ` na mesa ${workspace.currentComanda.mesaId}` : ""}.`,
        "info"
      );
    } catch (error) {
      this.#handleDomainError(error);
    }
  }

  async saveBrandLogoConfiguration(): Promise<void> {
    if (!this.#state.firstRunWorkspace.status) {
      return;
    }

    try {
      const status = await this.#desktopBridge.updateBrandLogo({
        companyLogoFilePath: this.#state.firstRunWorkspace.companyLogoFilePathDraft || null,
        occurredAt: new Date().toISOString()
      });
      const availablePrinters = await this.#desktopBridge.listPrintPrinters();

      this.#dispatch({
        type: "first-run-loaded",
        status,
        availablePrinters
      });
      this.#setFeedback(
        this.#state.firstRunWorkspace.companyLogoFilePathDraft.trim().length > 0
          ? "Marca do terminal atualizada."
          : "Logo removido da marca do terminal.",
        "info"
      );
    } catch (error) {
      this.#handleDomainError(error);
    }
  }

  focusComandaNumero(): void {
    this.#dispatch({
      type: "focus-requested",
      focusTarget: "comanda-numero"
    });
  }

  clearFeedback(): void {
    this.#dispatch({
      type: "feedback-cleared"
    });
  }

  consumeFocus(): void {
    this.#dispatch({
      type: "focus-consumed"
    });
  }

  async submitPin(): Promise<void> {
    if (this.#state.firstRunWorkspace.status?.firstRunPending) {
      this.#setFeedback("Conclua o first-run antes de liberar o login do terminal.", "error");
      return;
    }

    if (this.#state.authStatus === "submitting") {
      return;
    }

    const pin = sanitizePinInput(this.#state.pinInput);

    if (pin.length < 4) {
      this.#dispatch({
        type: "auth-failed",
        failure: {
          code: "PIN_REQUIRED",
          message: "Informe um PIN local com pelo menos 4 dígitos."
        }
      });
      return;
    }

    this.#dispatch({
      type: "auth-started"
    });

    const result = await this.#desktopBridge.login({
      pin
    });

    if (result.ok) {
      this.#dispatch({
        type: "auth-succeeded",
        session: result.session
      });
      return;
    }

    this.#dispatch({
      type: "auth-failed",
      failure: result.failure
    });
  }

  async logout(): Promise<void> {
    await this.#desktopBridge.logout();
    this.#dispatch({
      type: "auth-logged-out"
    });
  }

  navigate(viewId: MainViewId): void {
    const role = this.#state.session?.role;

    if (!role || !canAccessView(role, viewId)) {
      return;
    }

    this.#dispatch({
      type: "navigation-changed",
      viewId,
      focusTarget: this.#resolveFocusForView(viewId),
      message: null
    });
  }

  async openComandaFromDraft(): Promise<void> {
    const actor = this.#requireComandaActor();

    if (!actor) {
      return;
    }

    try {
      const draftNumero = this.#state.comandaWorkspace.comandaNumeroDraft.trim();
      const workspace = await this.#desktopBridge.openComanda({
        numero: draftNumero.length > 0 ? draftNumero : this.#nextSequenceLabel(),
        mesaId: this.#state.comandaWorkspace.mesaDraft.trim() || null,
        actor
      });

      this.#applyComandaWorkspaceSnapshot(workspace, {
        selectedComandaId: workspace.currentComanda?.comandaId ?? null,
        selectedItemId: null,
        cancelReasonDraft: "",
        checkoutAmountDraft: ""
      });
      this.navigate("comandas");
      this.#dispatch({
        type: "focus-requested",
        focusTarget: "product-search"
      });
      this.#setFeedback(`Comanda ${workspace.currentComanda?.numero ?? ""} pronta para lançamento rápido.`, "info");
    } catch (error) {
      this.#handleDomainError(error);
    }
  }

  async addSelectedProductToCurrentComanda(): Promise<void> {
    const actor = this.#requireComandaActor();
    const currentComanda = this.#getSelectedComanda();

    if (!actor || !currentComanda) {
      this.#setFeedback("Abra uma comanda antes de lancar itens.", "error");
      return;
    }

    const filteredProducts = this.getFilteredCatalogProducts();
    const product =
      filteredProducts.find((item) => item.productId === this.#state.comandaWorkspace.selectedCatalogProductId) ??
      filteredProducts[0];

    if (!product) {
      this.#setFeedback("Nenhum produto disponivel para o filtro atual.", "error");
      return;
    }

    try {
      const quantity = Number.parseFloat(this.#state.comandaWorkspace.quantityDraft.replace(",", "."));
      const workspace = await this.#desktopBridge.addComandaItem({
        comandaId: currentComanda.comandaId,
        produtoId: product.productId,
        productLabel: product.label,
        setor: product.setor,
        quantity: Number.isFinite(quantity) ? quantity : 1,
        unitPriceCents: product.unitPriceCents,
        note: this.#state.comandaWorkspace.itemNoteDraft.trim() || null,
        actor
      });

      this.#applyComandaWorkspaceSnapshot(workspace, {
        selectedItemId: workspace.currentComanda?.items.at(-1)?.itemId ?? null,
        itemNoteDraft: "",
        quantityDraft: "1"
      });
      this.#setFeedback(`${product.label} entrou na comanda. ENTER continua o lancamento.`, "info");
    } catch (error) {
      this.#handleDomainError(error);
    }
  }

  async sendCurrentComandaToProduction(): Promise<void> {
    const actor = this.#requireComandaActor();
    const currentComanda = this.#getSelectedComanda();

    if (!actor || !currentComanda) {
      this.#setFeedback("Abra uma comanda antes de enviar para produção.", "error");
      return;
    }

    try {
      const workspace = await this.#desktopBridge.sendComandaToProduction({
        comandaId: currentComanda.comandaId,
        actor
      });
      const latestBatch = workspace.currentComanda?.productionBatches.at(-1) ?? null;

      this.#applyComandaWorkspaceSnapshot(workspace);
      this.#dispatch({
        type: "navigation-changed",
        viewId: "producao",
        focusTarget: null,
        message: `Lote ${latestBatch?.batchId ?? ""} enviado para ${latestBatch?.setores.join(", ") ?? "setores"}.`
      });
    } catch (error) {
      this.#handleDomainError(error);
    }
  }

  async generatePreContaForCurrentComanda(): Promise<void> {
    const actor = this.#requireComandaActor();
    const currentComanda = this.#getSelectedComanda();

    if (!actor || !currentComanda) {
      this.#setFeedback("Abra uma comanda antes de gerar a pre-conta.", "error");
      return;
    }

    try {
      // Se a comanda está ABERTA e tem itens LANCADO, envia para produção automaticamente
      if (currentComanda.status === "ABERTA") {
        const hasLancado = currentComanda.items.some((item) => item.status === "LANCADO");
        if (!hasLancado) {
          this.#setFeedback("Adicione itens na comanda antes de gerar a pre-conta.", "error");
          return;
        }
        await this.#desktopBridge.sendComandaToProduction({
          comandaId: currentComanda.comandaId,
          actor
        });
      }

      const workspace = await this.#desktopBridge.startComandaCheckout({
        comandaId: currentComanda.comandaId,
        actor
      });
      const checkoutAmountDraft = formatCentsToAmountInput(workspace.lastPreContaSnapshot?.totalAmountCents ?? 0);

      this.#applyComandaWorkspaceSnapshot(workspace, {
        checkoutAmountDraft
      });
      this.#dispatch({
        type: "navigation-changed",
        viewId: "preconta",
        focusTarget: null,
        message: `Pré-conta ${workspace.lastPreContaSnapshot?.version ?? 0} congelada para conferência.`
      });
    } catch (error) {
      this.#handleDomainError(error);
    }
  }

  async reopenCurrentComanda(): Promise<void> {
    const actor = this.#requireComandaActor();
    const currentComanda = this.#getSelectedComanda();

    if (!actor || !currentComanda) {
      this.#setFeedback("Selecione uma comanda para reabrir.", "error");
      return;
    }

    try {
      const workspace = await this.#desktopBridge.reopenComanda({
        comandaId: currentComanda.comandaId,
        actor
      });

      this.#applyComandaWorkspaceSnapshot(workspace);
      this.#setFeedback(`Comanda ${workspace.currentComanda?.numero ?? currentComanda.numero} reaberta. Adicione itens ou gere nova pre-conta.`, "info");
    } catch (error) {
      this.#handleDomainError(error);
    }
  }

  async requestCurrentComandaCashCheckout(): Promise<void> {
    const actor = this.#requireComandaActor();
    const currentComanda = this.#getSelectedComanda();

    if (!actor || !currentComanda) {
      this.#setFeedback("Selecione uma comanda antes de encaminhar ao caixa.", "error");
      return;
    }

    try {
      const workspace = await this.#desktopBridge.requestComandaCashCheckout({
        comandaId: currentComanda.comandaId,
        actor
      });

      this.#applyComandaWorkspaceSnapshot(workspace);
      this.#setFeedback(`Comanda ${workspace.currentComanda?.numero ?? currentComanda.numero} encaminhada para a fila principal do caixa.`, "info");
    } catch (error) {
      this.#handleDomainError(error);
    }
  }

  async checkoutCurrentComanda(): Promise<void> {
    const actor = this.#requireComandaActor();
    const currentComanda = this.#getSelectedComanda();

    if (!actor || !currentComanda) {
      this.#setFeedback("Abra uma comanda antes de fechar o checkout.", "error");
      return;
    }

    const cashSession = this.#state.cashWorkspace.currentSession;

    if (!cashSession || cashSession.status !== "ABERTO") {
      this.#setFeedback("Abra o caixa antes de confirmar recebimentos e checkout.", "error");
      return;
    }

    try {
      const totals = calculateComandaTotals(currentComanda);
      const draftAmount = parseAmountInputToCents(this.#state.comandaWorkspace.checkoutAmountDraft);
      const amountCents = draftAmount > 0 ? draftAmount : totals.dueAmountCents;
      const paymentMethod = this.#state.comandaWorkspace.checkoutMethodDraft;
      const operational = await this.#desktopBridge.confirmComandaPayment({
        comandaId: currentComanda.comandaId,
        paymentMethod,
        amountCents,
        actor
      });

      this.#applyOperationalSnapshot(operational, {
        comanda: {
          checkoutAmountDraft: formatCentsToAmountInput(amountCents)
        }
      });
      this.#dispatch({
        type: "navigation-changed",
        viewId: "checkout",
        focusTarget: "checkout-amount",
        message: `Checkout encerrado em ${paymentMethod} e registrado no caixa local.`
      });
    } catch (error) {
      this.#handleDomainError(error);
    }
  }

  async cancelSelectedItem(): Promise<void> {
    const actor = this.#requireComandaActor();
    const currentComanda = this.#getSelectedComanda();
    const selectedItemId = this.#state.comandaWorkspace.selectedItemId;

    if (!actor || !currentComanda || !selectedItemId) {
      this.#setFeedback("Selecione um item antes de informar o motivo do cancelamento.", "error");
      return;
    }

    try {
      const workspace = await this.#desktopBridge.cancelComandaItem({
        comandaId: currentComanda.comandaId,
        itemId: selectedItemId,
        reason: this.#state.comandaWorkspace.cancelReasonDraft,
        actor
      });

      this.#applyComandaWorkspaceSnapshot(workspace, {
        cancelReasonDraft: ""
      });
      this.#setFeedback("Item cancelado com motivo registrado na trilha local.", "info");
    } catch (error) {
      this.#handleDomainError(error);
    }
  }

  fillCheckoutWithDueAmount(): void {
    const currentComanda = this.#getSelectedComanda();

    if (!currentComanda) {
      return;
    }

    const totals = calculateComandaTotals(currentComanda);

    this.#syncComandaWorkspace({
      ...this.#state.comandaWorkspace,
      checkoutAmountDraft: formatCentsToAmountInput(totals.dueAmountCents)
    });
    this.#dispatch({
      type: "focus-requested",
      focusTarget: "checkout-amount"
    });
  }

  async openCashSessionFromDraft(): Promise<void> {
    const actor = this.#requireCashActor();

    if (!actor) {
      return;
    }

    const currentSession = this.#state.cashWorkspace.currentSession;

    if (currentSession && currentSession.status !== "FECHADO") {
      this.#setFeedback("Feche o caixa atual antes de abrir uma nova sessão.", "error");
      return;
    }

    try {
      const openingFundAmountCents = parseAmountInputToCents(this.#state.cashWorkspace.openingFundDraft);
      const workspace = await this.#desktopBridge.openCashSession({
        openingFundAmountCents,
        openingReason: this.#state.cashWorkspace.openingReasonDraft || null,
        actor
      });

      this.#applyCashWorkspaceSnapshot(workspace, {
        openingFundDraft: formatCentsToAmountInput(openingFundAmountCents)
      });
      this.#dispatch({
        type: "focus-requested",
        focusTarget: "cash-receipt-amount"
      });
      this.#setFeedback("Caixa aberto com trilha local pronta para recebimentos.", "info");
    } catch (error) {
      this.#handleDomainError(error);
    }
  }

  async registerCashReceipt(): Promise<void> {
    const actor = this.#requireCashActor();
    const currentSession = this.#state.cashWorkspace.currentSession;

    if (!actor || !currentSession) {
      this.#setFeedback("Abra o caixa antes de registrar recebimentos.", "error");
      return;
    }

    try {
      const amountCents = parseAmountInputToCents(this.#state.cashWorkspace.receiptAmountDraft);
      const workspace = await this.#desktopBridge.registerCashReceipt({
        actor,
        method: this.#state.cashWorkspace.receiptMethodDraft,
        amountCents,
        reason: this.#state.cashWorkspace.receiptReasonDraft
      });

      this.#applyCashWorkspaceSnapshot(workspace, {
        receiptAmountDraft: "",
        receiptReasonDraft: ""
      });
      this.#setFeedback(`Recebimento em ${this.#state.cashWorkspace.receiptMethodDraft} registrado no caixa.`, "info");
    } catch (error) {
      this.#handleDomainError(error);
    }
  }

  async registerCashWithdrawal(): Promise<void> {
    const actor = this.#requireCashActor();
    const currentSession = this.#state.cashWorkspace.currentSession;

    if (!actor || !currentSession) {
      this.#setFeedback("Abra o caixa antes de registrar sangria.", "error");
      return;
    }

    try {
      const amountCents = parseAmountInputToCents(this.#state.cashWorkspace.sangriaAmountDraft);
      const workspace = await this.#desktopBridge.registerCashWithdrawal({
        actor,
        amountCents,
        reason: this.#state.cashWorkspace.sangriaReasonDraft
      });

      this.#applyCashWorkspaceSnapshot(workspace, {
        sangriaAmountDraft: "",
        sangriaReasonDraft: ""
      });
      this.#setFeedback("Sangria registrada com motivo auditável.", "info");
    } catch (error) {
      this.#handleDomainError(error);
    }
  }

  async registerCashSupply(): Promise<void> {
    const actor = this.#requireCashActor();
    const currentSession = this.#state.cashWorkspace.currentSession;

    if (!actor || !currentSession) {
      this.#setFeedback("Abra o caixa antes de registrar suprimento.", "error");
      return;
    }

    try {
      const amountCents = parseAmountInputToCents(this.#state.cashWorkspace.suprimentoAmountDraft);
      const workspace = await this.#desktopBridge.registerCashSupply({
        actor,
        amountCents,
        reason: this.#state.cashWorkspace.suprimentoReasonDraft
      });

      this.#applyCashWorkspaceSnapshot(workspace, {
        suprimentoAmountDraft: "",
        suprimentoReasonDraft: ""
      });
      this.#setFeedback("Suprimento registrado e somado ao saldo esperado.", "info");
    } catch (error) {
      this.#handleDomainError(error);
    }
  }

  async startCashClosureFlow(): Promise<void> {
    const actor = this.#requireCashActor();
    const currentSession = this.#state.cashWorkspace.currentSession;

    if (!actor || !currentSession) {
      this.#setFeedback("Abra o caixa antes de iniciar o fechamento.", "error");
      return;
    }

    try {
      const workspace = await this.#desktopBridge.startCashClosure({
        actor
      });
      const totals = workspace.currentSession ? calculateCashSessionTotals(workspace.currentSession) : null;

      this.#applyCashWorkspaceSnapshot(workspace, {
        closureCountDrafts: totals ? createClosureDraftsFromTotals(totals) : this.#state.cashWorkspace.closureCountDrafts,
        divergenceReasonDraft: "",
        closureNoteDraft: ""
      });
      this.#dispatch({
        type: "focus-requested",
        focusTarget: "cash-divergence-reason"
      });
      this.#setFeedback("Fechamento iniciado. Confira os valores por forma antes de concluir.", "info");
    } catch (error) {
      this.#handleDomainError(error);
    }
  }

  async closeCashSessionFromDraft(): Promise<void> {
    const actor = this.#requireCashActor();
    const currentSession = this.#state.cashWorkspace.currentSession;

    if (!actor || !currentSession) {
      this.#setFeedback("Não há caixa em fechamento para concluir.", "error");
      return;
    }

    try {
      const workspace = await this.#desktopBridge.closeCashSession({
        counts: CHECKOUT_METHODS.map((method) => ({
          method: method as CashPaymentMethod,
          countedAmountCents: parseAmountInputToCents(this.#state.cashWorkspace.closureCountDrafts[method as CashPaymentMethod] ?? "")
        })),
        note: this.#state.cashWorkspace.closureNoteDraft,
        divergenceReason: this.#state.cashWorkspace.divergenceReasonDraft,
        actor
      });

      this.#applyCashWorkspaceSnapshot(workspace);
      this.#dispatch({
        type: "focus-requested",
        focusTarget: "cash-opening-fund"
      });
      this.#setFeedback("Caixa fechado com conferência e bundle de auditoria pronto para exportação.", "info");
    } catch (error) {
      this.#handleDomainError(error);
    }
  }

  async exportCashAuditBundle(): Promise<void> {
    try {
      const workspace = await this.#desktopBridge.exportCashAudit();
      this.#applyCashWorkspaceSnapshot(workspace);
      this.#setFeedback("Bundle auditável do caixa pronto para conferência local.", "info");
    } catch (error) {
      this.#handleDomainError(error);
    }
  }

  async loadTeamOperators(): Promise<void> {
    try {
      const operators = await this.#desktopBridge.listOperators();
      this.#syncTeamWorkspace({
        ...this.#state.teamWorkspace,
        operators
      });
    } catch (error) {
      this.#handleDomainError(error);
    }
  }

  updateTeamDraftField(field: keyof Pick<TeamWorkspaceState, "nomeDraft" | "codeDraft" | "pinDraft">, value: string): void {
    this.#syncTeamWorkspace({
      ...this.#state.teamWorkspace,
      [field]: value.slice(0, 80)
    });
  }

  updateTeamRoleDraft(role: TeamWorkspaceState["roleDraft"]): void {
    this.#syncTeamWorkspace({
      ...this.#state.teamWorkspace,
      roleDraft: role
    });
  }

  selectTeamOperator(operatorId: string): void {
    const operator = this.#state.teamWorkspace.operators.find((op) => op.operatorId === operatorId);

    if (!operator) {
      return;
    }

    this.#syncTeamWorkspace({
      ...this.#state.teamWorkspace,
      selectedOperatorId: operatorId,
      nomeDraft: operator.nome,
      codeDraft: operator.operatorCode,
      pinDraft: "",
      roleDraft: operator.role,
      formMode: "edit"
    });
  }

  openTeamNewOperatorForm(): void {
    this.#syncTeamWorkspace({
      ...this.#state.teamWorkspace,
      selectedOperatorId: null,
      nomeDraft: "",
      codeDraft: "",
      pinDraft: "",
      roleDraft: "GARCOM",
      formMode: "new"
    });
    this.#dispatch({
      type: "focus-requested",
      focusTarget: "equipe-operator-nome"
    });
  }

  async saveTeamOperator(): Promise<void> {
    if (this.#state.teamWorkspace.submitting) {
      return;
    }

    this.#syncTeamWorkspace({
      ...this.#state.teamWorkspace,
      submitting: true
    });

    try {
      const workspace = this.#state.teamWorkspace;
      const saved = await this.#desktopBridge.saveOperator({
        operatorId: workspace.selectedOperatorId,
        operatorCode: workspace.codeDraft,
        nome: workspace.nomeDraft,
        pin: workspace.pinDraft,
        role: workspace.roleDraft,
        ativo: true
      });

      const operators = await this.#desktopBridge.listOperators();
      const wasNew = workspace.formMode === "new";

      this.#syncTeamWorkspace({
        ...this.#state.teamWorkspace,
        operators,
        selectedOperatorId: wasNew ? null : saved.operatorId,
        nomeDraft: wasNew ? "" : saved.nome,
        codeDraft: wasNew ? "" : saved.operatorCode,
        pinDraft: "",
        roleDraft: wasNew ? "GARCOM" : saved.role,
        formMode: wasNew ? "new" : "edit",
        submitting: false
      });
      this.#setFeedback(`Colaborador ${saved.nome} salvo com sucesso.`, "info");
    } catch (error) {
      this.#syncTeamWorkspace({
        ...this.#state.teamWorkspace,
        submitting: false
      });
      this.#handleDomainError(error);
    }
  }

  async deactivateTeamOperator(operatorId: string): Promise<void> {
    const operator = this.#state.teamWorkspace.operators.find((op) => op.operatorId === operatorId);

    if (!operator) {
      return;
    }

    try {
      await this.#desktopBridge.saveOperator({
        operatorId: operator.operatorId,
        operatorCode: operator.operatorCode,
        nome: operator.nome,
        pin: "",
        role: operator.role,
        ativo: false
      });
      const operators = await this.#desktopBridge.listOperators();

      this.#syncTeamWorkspace({
        ...this.#state.teamWorkspace,
        operators,
        selectedOperatorId: null,
        formMode: "new",
        nomeDraft: "",
        codeDraft: "",
        pinDraft: "",
        roleDraft: "GARCOM"
      });
      this.#setFeedback(`Colaborador ${operator.nome} desativado.`, "info");
    } catch (error) {
      this.#handleDomainError(error);
    }
  }

  handleKeyboardEvent(key: string, eventTarget: EventTarget | null): boolean {
    const shortcut = normalizeShortcutKey(key);
    const isEditableTarget = isKeyboardEditableTarget(eventTarget);

    if (this.#state.firstRunWorkspace.status?.firstRunPending) {
      if (shortcut === "ENTER") {
        void this.completeFirstRun();
        return true;
      }

      if (shortcut === "ESC") {
        this.clearFeedback();
        return true;
      }

      return false;
    }

    if (!this.#state.session) {
      if (shortcut === "ENTER") {
        void this.submitPin();
        return true;
      }

      if (shortcut === "ESC") {
        this.clearPin();
        this.clearFeedback();
        return true;
      }

      return false;
    }

    if (
      !shortcut &&
      this.#state.currentViewId === "catalogo" &&
      key === "ArrowDown" &&
      isEditableTarget &&
      isCatalogSearchTarget(eventTarget)
    ) {
      this.#moveCatalogSelection(1);
      return true;
    }

    if (
      !shortcut &&
      this.#state.currentViewId === "catalogo" &&
      key === "ArrowUp" &&
      isEditableTarget &&
      isCatalogSearchTarget(eventTarget)
    ) {
      this.#moveCatalogSelection(-1);
      return true;
    }

    if (!shortcut && key === "Enter") {
      return this.#handleEnterByTarget(eventTarget);
    }

    if (!shortcut) {
      return false;
    }

    if (shortcut === "ESC") {
      this.clearFeedback();
      return true;
    }

    if (shortcut === "F6") {
      void this.sendCurrentComandaToProduction();
      return true;
    }

    if (shortcut === "F7") {
      void this.generatePreContaForCurrentComanda();
      return true;
    }

    if (shortcut === "F8") {
      this.navigate("checkout");
      return true;
    }

    const navigation = resolveShortcutNavigation(this.#state.session.role, shortcut);

    if (!navigation) {
      return false;
    }

    this.#dispatch({
      type: "navigation-changed",
      viewId: navigation.viewId,
      focusTarget: this.#resolveFocusForView(navigation.viewId),
      message: navigation.message
    });
    return true;
  }

  #handleEnterByTarget(eventTarget: EventTarget | null): boolean {
    if (!(eventTarget instanceof HTMLElement)) {
      return false;
    }

    switch (eventTarget.id) {
      case "comanda-numero":
      case "mesa-draft":
        void this.openComandaFromDraft();
        return true;
      case "product-search":
      case "item-note":
      case "item-quantity":
        void this.addSelectedProductToCurrentComanda();
        return true;
      case "cancel-reason":
        void this.cancelSelectedItem();
        return true;
      case "checkout-amount":
        void this.checkoutCurrentComanda();
        return true;
      case "cash-opening-fund":
        void this.openCashSessionFromDraft();
        return true;
      case "cash-receipt-amount":
        void this.registerCashReceipt();
        return true;
      case "cash-divergence-reason":
        void this.closeCashSessionFromDraft();
        return true;
      default:
        return false;
    }
  }

  #moveCatalogSelection(step: -1 | 1): void {
    const products = this.getFilteredCatalogProducts();

    if (products.length === 0) {
      return;
    }

    const currentIndex = products.findIndex((item) => item.productId === this.#state.comandaWorkspace.selectedCatalogProductId);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (safeIndex + step + products.length) % products.length;
    const nextProduct = products[nextIndex];

    if (nextProduct) {
      this.selectCatalogProduct(nextProduct.productId);
    }
  }

  #requireComandaActor(): ComandaActor | null {
    const session = this.#state.session;

    if (!session) {
      this.#setFeedback("Sessão local obrigatória para operar a comanda.", "error");
      return null;
    }

    return {
      userId: session.operatorId,
      terminalId: "pdv-main",
      role: session.role
    };
  }

  #requireCashActor(): CashActor | null {
    const session = this.#state.session;

    if (!session) {
      this.#setFeedback("Sessão local obrigatória para operar o caixa.", "error");
      return null;
    }

    return {
      userId: session.operatorId,
      terminalId: "pdv-main",
      role: session.role
    };
  }

  #resolveFocusForView(viewId: MainViewId): FocusTarget | null {
    switch (viewId) {
      case "comandas":
        return "comanda-numero";
      case "catalogo":
        return "product-search";
      case "checkout":
        return "checkout-amount";
      case "caixa":
        return this.#state.cashWorkspace.currentSession
          ? this.#state.cashWorkspace.currentSession.status === "FECHAMENTO"
            ? "cash-divergence-reason"
            : "cash-receipt-amount"
          : "cash-opening-fund";
      case "equipe":
        return "equipe-operator-nome";
      default:
        return null;
    }
  }

  #syncComandaWorkspace(workspace: ShellState["comandaWorkspace"]): void {
    this.#dispatch({
      type: "comanda-workspace-updated",
      workspace
    });
  }

  #syncCashWorkspace(workspace: ShellState["cashWorkspace"]): void {
    this.#dispatch({
      type: "cash-workspace-updated",
      workspace
    });
  }

  #syncFirstRunWorkspace(workspace: ShellState["firstRunWorkspace"]): void {
    this.#dispatch({
      type: "first-run-draft-updated",
      workspace
    });
  }

  #syncTeamWorkspace(workspace: TeamWorkspaceState): void {
    this.#dispatch({
      type: "team-workspace-updated",
      workspace
    });
  }

  #applyOperationalSnapshot(
    snapshot: OperationalSnapshot,
    overrides?: {
      comanda?: Partial<ShellState["comandaWorkspace"]>;
      cash?: Partial<ShellState["cashWorkspace"]>;
    }
  ): void {
    this.#applyComandaWorkspaceSnapshot(snapshot.comanda, overrides?.comanda);
    this.#applyCashWorkspaceSnapshot(snapshot.cash, overrides?.cash);
  }

  #applyComandaWorkspaceSnapshot(
    snapshot: ComandaWorkspaceSnapshot,
    overrides?: Partial<ShellState["comandaWorkspace"]>
  ): void {
    const requestedSelectedComandaId = overrides?.selectedComandaId ?? this.#state.comandaWorkspace.selectedComandaId;
    const selectedComandaId = snapshot.activeComandas.some((item) => item.comandaId === requestedSelectedComandaId)
      ? requestedSelectedComandaId
      : snapshot.currentComanda?.comandaId ?? snapshot.activeComandas[0]?.comandaId ?? null;
    const selectedComanda = snapshot.activeComandas.find((item) => item.comandaId === selectedComandaId) ?? null;
    const catalogProducts = [...this.#state.comandaWorkspace.catalogProducts];
    const selectedCatalogProductId = catalogProducts.some(
      (item) => item.productId === this.#state.comandaWorkspace.selectedCatalogProductId
    )
      ? this.#state.comandaWorkspace.selectedCatalogProductId
      : catalogProducts[0]?.productId ?? null;
    const selectedItemId = selectedComanda?.items.some(
      (item) => item.itemId === this.#state.comandaWorkspace.selectedItemId
    )
      ? this.#state.comandaWorkspace.selectedItemId
      : selectedComanda?.items.at(-1)?.itemId ?? null;

    this.#syncComandaWorkspace({
      ...this.#state.comandaWorkspace,
      selectedComandaId,
      activeComandas: snapshot.activeComandas,
      mesaGroups: snapshot.mesaGroups,
      auditTrail: snapshot.auditTrail,
      lastPreContaSnapshot: snapshot.lastPreContaSnapshot,
      catalogProducts,
      selectedCatalogProductId,
      selectedItemId,
      ...overrides
    });
  }

  #getSelectedComanda() {
    const { selectedComandaId, activeComandas } = this.#state.comandaWorkspace;
    return activeComandas.find((item) => item.comandaId === selectedComandaId) ?? null;
  }

  #applyCashWorkspaceSnapshot(
    snapshot: CashWorkspaceSnapshot,
    overrides?: Partial<ShellState["cashWorkspace"]>
  ): void {
    this.#syncCashWorkspace({
      ...this.#state.cashWorkspace,
      currentSession: snapshot.currentSession,
      auditTrail: snapshot.auditTrail,
      auditExport: snapshot.auditExport,
      ...overrides
    });
  }

  #setFeedback(message: string | null, tone: "info" | "error"): void {
    this.#dispatch({
      type: "feedback-updated",
      message,
      tone
    });
  }

  #handleDomainError(error: unknown): void {
    let message = error instanceof Error ? error.message : "Falha local ao operar o PDV.";
    // Electron IPC wraps errors as "Error invoking remote method '...': DomainError: <real message>"
    const domainMatch = message.match(/(?:DomainError|ComandaDomainError|CashDomainError):\s(.+)$/);
    if (domainMatch?.[1]) {
      message = domainMatch[1];
    }
    this.#setFeedback(message, "error");
  }

  #dispatch(event: Parameters<typeof reduceShellState>[1]): void {
    this.#state = reduceShellState(this.#state, event);
    this.#emit();
  }

  #emit(): void {
    for (const listener of this.#listeners) {
      listener(this.#state);
    }
  }

  #nextSequenceLabel(): string {
    this.#sequence += 1;
    return (100 + this.#sequence).toString();
  }

  getFilteredCatalogProducts(query: string = this.#state.productSearch) {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return this.#state.comandaWorkspace.catalogProducts;
    }

    return this.#state.comandaWorkspace.catalogProducts.filter((product) => {
      return (
        product.label.toLowerCase().includes(normalizedQuery) ||
        product.setor.toLowerCase().includes(normalizedQuery) ||
        product.shortcutHint.toLowerCase().includes(normalizedQuery)
      );
    });
  }
}

export function createPdvShellController(
  dependencies: ShellControllerDependencies
): PdvShellController {
  return new PdvShellController(dependencies);
}

function isKeyboardEditableTarget(target: EventTarget | null): target is HTMLElement {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;

  return (
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}

function isCatalogSearchTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.id === "product-search";
}

function parseAmountInputToCents(value: string): number {
  const normalized = value.replace(/\./g, "").replace(",", ".").trim();

  if (!normalized) {
    return 0;
  }

  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function formatCentsToAmountInput(value: number): string {
  return (value / 100).toFixed(2).replace(".", ",");
}

function sanitizeAmountDraft(value: string): string {
  return value.replace(/[^\d.,]/g, "").slice(0, 12);
}

function createClosureDraftsFromTotals(totals: ReturnType<typeof calculateCashSessionTotals>) {
  return totals.byMethod.reduce<Record<CashPaymentMethod, string>>((accumulator, item) => {
    accumulator[item.method] = formatCentsToAmountInput(item.expectedAmountCents);
    return accumulator;
  }, {
    DINHEIRO: "",
    PIX: "",
    CARTAO_CREDITO: "",
    CARTAO_DEBITO: "",
    OUTRO: ""
  });
}

