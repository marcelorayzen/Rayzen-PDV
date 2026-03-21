import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { createPdvShellController } from "../dist/application/index.js";
import { renderShell } from "../dist/index.js";
import {
  SHELL_SHORTCUTS,
  addComandaItem,
  cancelComandaItem,
  checkoutComanda,
  closeCashSession,
  ComandaDomainError,
  exportCashSessionAudit,
  generateComandaPreConta,
  CashDomainError,
  openCashSession,
  openComanda,
  receiveCashPayment,
  registerCashSupply,
  registerCashWithdrawal,
  sendComandaToProduction,
  startCashClosure
} from "../dist/domain/index.js";

export async function runAuthenticationScenario() {
  const bridge = createFakeDesktopBridge();
  const invalidResult = await bridge.login({
    pin: "0000"
  });
  const validResult = await bridge.login({
    pin: "1234"
  });
  const session = await bridge.getOperatorSession();
  const catalog = await bridge.listCatalogProducts();

  assert.equal(invalidResult.ok, false);
  assert.equal(validResult.ok, true);
  assert.equal(validResult.session.role, "GERENTE");
  assert.equal(session?.operatorCode, "ADMIN");
  assert.equal(catalog.length >= 4, true);
}

export async function runControllerScenario() {
  const controller = createPdvShellController({
    desktopBridge: createFakeDesktopBridge()
  });

  await controller.start();
  controller.updatePinInput("1234");
  await controller.submitPin();
  await controller.openComandaFromDraft();
  controller.updateProductSearch("Hamburg");
  await controller.addSelectedProductToCurrentComanda();
  await controller.sendCurrentComandaToProduction();
  await controller.generatePreContaForCurrentComanda();
  controller.updateCheckoutMethodDraft("PIX");
  controller.fillCheckoutWithDueAmount();

  const operationalState = controller.getState();

  assert.equal(operationalState.session?.role, "GERENTE");
  assert.equal(operationalState.comandaWorkspace.currentComanda?.status, "EM_PAGAMENTO");
  assert.equal(operationalState.comandaWorkspace.auditTrail.length, 4);
  assert.equal(operationalState.comandaWorkspace.catalogProducts.length >= 4, true);

  const shortcutHandled = controller.handleKeyboardEvent("F4", null);
  assert.equal(shortcutHandled, true);
  assert.equal(controller.getState().currentViewId, "catalogo");
  assert.equal(controller.getState().focusTarget, "product-search");
}

export async function runFirstRunScenario() {
  const controller = createPdvShellController({
    desktopBridge: createFakeDesktopBridge({
      firstRunPending: true
    })
  });

  await controller.start();
  controller.updateFirstRunCompanyLegalName("Rayzen Restaurante Matriz");
  controller.updateFirstRunCompanyTradeName("Rayzen Bar");
  controller.updateFirstRunCompanyDocument("12.345.678/0001-99");
  controller.updateFirstRunPrinterDraft("COZINHA", "IMP_COZINHA_TESTE");
  controller.updateFirstRunPrinterDraft("BAR", "IMP_BAR_TESTE");
  controller.updateFirstRunPrinterDraft("CAIXA", "IMP_CAIXA_TESTE");
  await controller.completeFirstRun();

  const state = controller.getState();

  assert.equal(state.firstRunWorkspace.status?.firstRunPending, false);
  assert.equal(state.firstRunWorkspace.status?.company?.legalName, "Rayzen Restaurante Matriz");
  assert.equal(state.focusTarget, "pin-input");
}

export async function runCashControllerScenario() {
  const controller = createPdvShellController({
    desktopBridge: createFakeDesktopBridge()
  });

  await controller.start();
  controller.updatePinInput("1234");
  await controller.submitPin();
  controller.navigate("caixa");
  await controller.openCashSessionFromDraft();
  controller.updateCashReceiptMethodDraft("DINHEIRO");
  controller.updateCashReceiptAmountDraft("42,50");
  controller.updateCashReceiptReasonDraft("balcao local");
  await controller.registerCashReceipt();
  controller.updateCashSangriaAmountDraft("10,00");
  controller.updateCashSangriaReasonDraft("retirada do excesso");
  await controller.registerCashWithdrawal();
  await controller.startCashClosureFlow();
  controller.updateCashClosureCountDraft("DINHEIRO", "182,50");
  controller.updateCashClosureCountDraft("PIX", "0,00");
  controller.updateCashClosureCountDraft("CARTAO_CREDITO", "0,00");
  controller.updateCashClosureCountDraft("CARTAO_DEBITO", "0,00");
  controller.updateCashClosureCountDraft("OUTRO", "0,00");
  controller.updateCashClosureNoteDraft("fechamento do turno");
  await controller.closeCashSessionFromDraft();

  const state = controller.getState();

  assert.equal(state.session?.role, "GERENTE");
  assert.equal(state.currentViewId, "caixa");
  assert.equal(state.cashWorkspace.currentSession?.status, "FECHADO");
  assert.equal(state.cashWorkspace.auditTrail.length, 5);
  assert.ok(state.cashWorkspace.auditExport);
  assert.equal(state.cashWorkspace.auditExport?.totals.totalDivergenceAmountCents, 0);
}

export function runShortcutFixtureScenario() {
  assert.equal(SHELL_SHORTCUTS.F2, "Abrir ou buscar comanda");
  assert.equal(SHELL_SHORTCUTS.F8, "Checkout");
  assert.equal(SHELL_SHORTCUTS.ENTER, "Confirmar");
}

export function runComandaUiRenderScenario() {
  const opened = openComanda({
    comandaId: "cmd_ui_1",
    numero: "401",
    actor: {
      userId: "opr_gc_01",
      terminalId: "term_1",
      role: "GARCOM"
    },
    openedAt: "2026-03-12T13:00:00.000Z",
    auditEventId: "evt_ui_open"
  });
  const withItem = addComandaItem(opened.comanda, {
    itemId: "item_ui_1",
    produtoId: "prod_ui_1",
    productLabel: "Suco de laranja",
    setor: "BAR",
    quantity: 1,
    unitPriceCents: 1500,
    actor: {
      userId: "opr_gc_01",
      terminalId: "term_1",
      role: "GARCOM"
    },
    occurredAt: "2026-03-12T13:01:00.000Z",
    auditEventId: "evt_ui_item"
  });
  const html = renderShell({
    bootstrapping: false,
    bootstrap: createRuntimeSnapshot().bootstrap,
    health: createRuntimeSnapshot().health,
    pinInput: "",
    authError: null,
    authStatus: "idle",
    session: {
      operatorId: "opr_gc_01",
      operatorCode: "GC-01",
      displayLabel: "Sala principal",
      role: "GARCOM",
      authenticatedAt: "2026-03-12T13:00:00.000Z"
    },
    currentViewId: "comandas",
    focusTarget: "comanda-numero",
    feedbackMessage: "Comanda pronta.",
    feedbackTone: "info",
    productSearch: "suco",
    lastShortcut: null,
    firstRunWorkspace: createEmptyFirstRunWorkspace(),
    comandaWorkspace: {
      currentComanda: withItem.comanda,
      auditTrail: [...opened.auditEvents, ...withItem.auditEvents],
      catalogProducts: [],
      selectedCatalogProductId: null,
      selectedItemId: "item_ui_1",
      comandaNumeroDraft: "401",
      mesaDraft: "M1",
      quantityDraft: "1",
      itemNoteDraft: "",
      cancelReasonDraft: "",
      checkoutAmountDraft: "15,00",
      checkoutMethodDraft: "PIX",
      lastPreContaSnapshot: null
    },
    cashWorkspace: createEmptyCashWorkspace()
  });

  assert.match(html, /Comanda 401/);
  assert.match(html, /Itens da comanda/);
  assert.match(html, /Cancelar item/);
}

export function runCashUiRenderScenario() {
  const opened = openCashSession({
    cashSessionId: "cash_ui_1",
    terminalId: "pdv-main",
    actor: {
      userId: "opr_cx_01",
      terminalId: "pdv-main",
      role: "CAIXA"
    },
    openedAt: "2026-03-12T18:00:00.000Z",
    auditEventId: "evt_cash_open_ui",
    openingFundAmountCents: 15000,
    openingReason: "troco do turno"
  });
  const withReceipt = receiveCashPayment(opened.session, {
    movementId: "cash_mov_ui_1",
    actor: {
      userId: "opr_cx_01",
      terminalId: "pdv-main",
      role: "CAIXA"
    },
    occurredAt: "2026-03-12T18:10:00.000Z",
    auditEventId: "evt_cash_receipt_ui",
    method: "DINHEIRO",
    amountCents: 2500,
    reason: "checkout local"
  });
  const html = renderShell({
    bootstrapping: false,
    bootstrap: createRuntimeSnapshot().bootstrap,
    health: createRuntimeSnapshot().health,
    pinInput: "",
    authError: null,
    authStatus: "idle",
    session: {
      operatorId: "opr_cx_01",
      operatorCode: "CX-01",
      displayLabel: "Frente de caixa",
      role: "CAIXA",
      authenticatedAt: "2026-03-12T18:00:00.000Z"
    },
    currentViewId: "caixa",
    focusTarget: "cash-receipt-amount",
    feedbackMessage: "Caixa operando.",
    feedbackTone: "info",
    productSearch: "",
    lastShortcut: null,
    firstRunWorkspace: createEmptyFirstRunWorkspace(),
    comandaWorkspace: {
      currentComanda: null,
      auditTrail: [],
      catalogProducts: [],
      selectedCatalogProductId: null,
      selectedItemId: null,
      comandaNumeroDraft: "101",
      mesaDraft: "M1",
      quantityDraft: "1",
      itemNoteDraft: "",
      cancelReasonDraft: "",
      checkoutAmountDraft: "",
      checkoutMethodDraft: "PIX",
      lastPreContaSnapshot: null
    },
    cashWorkspace: {
      ...createEmptyCashWorkspace(),
      currentSession: withReceipt.session,
      auditTrail: [...opened.auditEvents, ...withReceipt.auditEvents],
      receiptAmountDraft: "25,00",
      receiptMethodDraft: "DINHEIRO"
    }
  });

  assert.match(html, /Caixa do turno/);
  assert.match(html, /Recebimento por forma/);
  assert.match(html, /Concluir fechamento/);
}

export function runFirstRunUiRenderScenario() {
  const html = renderShell({
    bootstrapping: false,
    bootstrap: createRuntimeSnapshot().bootstrap,
    health: createRuntimeSnapshot().health,
    pinInput: "",
    authError: null,
    authStatus: "idle",
    session: null,
    currentViewId: "comandas",
    focusTarget: "setup-company-legal-name",
    feedbackMessage: "Conclua o first-run.",
    feedbackTone: "info",
    productSearch: "",
    lastShortcut: null,
    firstRunWorkspace: {
      status: {
        firstRunPending: true,
        configFilePath: "C:\\ProgramData\\RayzenPDV\\config\\runtime-config.json",
        appVersion: "0.1.0-test",
        completedAt: null,
        company: null,
        printRoutes: [
          { setor: "COZINHA", impressoras: ["IMP_COZINHA_01"] },
          { setor: "BAR", impressoras: ["IMP_BAR_01"] },
          { setor: "CAIXA", impressoras: ["IMP_CAIXA_01"] }
        ],
        seedState: {
          adminReady: true,
          productCount: 4,
          printRouteCount: 3
        }
      },
      availablePrinters: [
        {
          printerId: "IMP_COZINHA_01",
          printerName: "IMP_COZINHA_01",
          isOffline: false,
          isAvailable: true,
          status: "Idle"
        }
      ],
      companyLegalNameDraft: "Rayzen Restaurante Matriz",
      companyTradeNameDraft: "Rayzen Bar",
      companyDocumentDraft: "12.345.678/0001-99",
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
      mesaDraft: "M1",
      quantityDraft: "1",
      itemNoteDraft: "",
      cancelReasonDraft: "",
      checkoutAmountDraft: "",
      checkoutMethodDraft: "PIX",
      lastPreContaSnapshot: null
    },
    cashWorkspace: createEmptyCashWorkspace()
  });

  assert.match(html, /Configurar o terminal antes de liberar o PDV/);
  assert.match(html, /Concluir first-run/);
}

export function runComandaLifecycleScenario() {
  const actor = {
    userId: "opr_gc_01",
    terminalId: "term_1",
    role: "GARCOM"
  };
  const opened = openComanda({
    comandaId: "cmd_100",
    numero: "100",
    actor,
    openedAt: "2026-03-12T10:00:00.000Z",
    auditEventId: "evt_open_100",
    mesaId: "M12"
  });
  const withStarter = addComandaItem(opened.comanda, {
    itemId: "item_1",
    produtoId: "prod_1",
    productLabel: "Suco de laranja",
    setor: "BAR",
    quantity: 2,
    unitPriceCents: 1500,
    actor,
    occurredAt: "2026-03-12T10:01:00.000Z",
    auditEventId: "evt_item_1"
  });
  const withMain = addComandaItem(withStarter.comanda, {
    itemId: "item_2",
    produtoId: "prod_2",
    productLabel: "Prato executivo",
    setor: "COZINHA",
    quantity: 1,
    unitPriceCents: 3200,
    actor,
    occurredAt: "2026-03-12T10:02:00.000Z",
    auditEventId: "evt_item_2"
  });
  const sent = sendComandaToProduction(withMain.comanda, {
    batchId: "batch_1",
    actor,
    occurredAt: "2026-03-12T10:03:00.000Z",
    auditEventId: "evt_send_1"
  });
  const preConta = generateComandaPreConta(sent.comanda, {
    preContaId: "pre_1",
    actor,
    occurredAt: "2026-03-12T10:04:00.000Z",
    auditEventId: "evt_pre_1"
  });
  const checkout = checkoutComanda(preConta.comanda, {
    actor: {
      userId: "opr_cx_01",
      terminalId: "term_1",
      role: "CAIXA"
    },
    occurredAt: "2026-03-12T10:05:00.000Z",
    auditEventId: "evt_checkout_1",
    payments: [
      {
        paymentId: "pay_1",
        method: "PIX",
        amountCents: 6200
      }
    ]
  });

  assert.equal(sent.comanda.status, "EM_PRODUCAO");
  assert.equal(sent.productionBatch?.setores.join(","), "BAR,COZINHA");
  assert.equal(preConta.comanda.status, "EM_PAGAMENTO");
  assert.equal(preConta.preContaSnapshot?.totalAmountCents, 6200);
  assert.equal(checkout.comanda.status, "ENCERRADA");
  assert.equal(checkout.comanda.payments.length, 1);
  assert.equal(checkout.auditEvents[0].action, "CHECKOUT_CONCLUIDO");
}

export function runComandaCancellationScenario() {
  const actor = {
    userId: "opr_gr_01",
    terminalId: "term_2",
    role: "GERENTE"
  };
  const opened = openComanda({
    comandaId: "cmd_200",
    numero: "200",
    actor,
    openedAt: "2026-03-12T11:00:00.000Z",
    auditEventId: "evt_open_200"
  });
  const withItem = addComandaItem(opened.comanda, {
    itemId: "item_cancel_1",
    produtoId: "prod_9",
    productLabel: "Porcao",
    setor: "COZINHA",
    quantity: 1,
    unitPriceCents: 2800,
    actor,
    occurredAt: "2026-03-12T11:01:00.000Z",
    auditEventId: "evt_item_cancel_1"
  });
  const sent = sendComandaToProduction(withItem.comanda, {
    batchId: "batch_cancel_1",
    actor,
    occurredAt: "2026-03-12T11:02:00.000Z",
    auditEventId: "evt_send_cancel_1"
  });
  const cancelled = cancelComandaItem(sent.comanda, {
    itemId: "item_cancel_1",
    reason: "cliente desistiu",
    actor,
    occurredAt: "2026-03-12T11:03:00.000Z",
    auditEventId: "evt_cancel_item_1"
  });

  assert.equal(cancelled.comanda.items[0].status, "CANCELADO");
  assert.equal(cancelled.comanda.items[0].cancellationReason, "cliente desistiu");
  assert.equal(cancelled.auditEvents[0].payload.previousStatus, "ENVIADO");
}

export function runComandaGuardrailScenario() {
  const actor = {
    userId: "opr_gc_01",
    terminalId: "term_3",
    role: "GARCOM"
  };
  const opened = openComanda({
    comandaId: "cmd_300",
    numero: "300",
    actor,
    openedAt: "2026-03-12T12:00:00.000Z",
    auditEventId: "evt_open_300"
  });
  const withItem = addComandaItem(opened.comanda, {
    itemId: "item_guard_1",
    produtoId: "prod_guard",
    productLabel: "Cafe",
    setor: "BAR",
    quantity: 1,
    unitPriceCents: 500,
    actor,
    occurredAt: "2026-03-12T12:01:00.000Z",
    auditEventId: "evt_item_guard_1"
  });
  const sent = sendComandaToProduction(withItem.comanda, {
    batchId: "batch_guard_1",
    actor,
    occurredAt: "2026-03-12T12:02:00.000Z",
    auditEventId: "evt_send_guard_1"
  });
  const preConta = generateComandaPreConta(sent.comanda, {
    preContaId: "pre_guard_1",
    actor,
    occurredAt: "2026-03-12T12:03:00.000Z",
    auditEventId: "evt_pre_guard_1"
  });

  assert.throws(() => {
    checkoutComanda(preConta.comanda, {
      actor,
      occurredAt: "2026-03-12T12:04:00.000Z",
      auditEventId: "evt_checkout_guard_1",
      payments: [
        {
          paymentId: "pay_guard_1",
          method: "CARTAO_CREDITO",
          amountCents: 800
        }
      ]
    });
  }, (error) => {
    assert.ok(error instanceof ComandaDomainError);
    assert.equal(error.code, "CHECKOUT_TROCO_INVALIDO");
    return true;
  });
}

export function runCashLifecycleScenario() {
  const actor = {
    userId: "opr_cx_01",
    terminalId: "pdv-main",
    role: "CAIXA"
  };
  const opened = openCashSession({
    cashSessionId: "cash_100",
    terminalId: "pdv-main",
    actor,
    openedAt: "2026-03-12T14:00:00.000Z",
    auditEventId: "evt_cash_open_1",
    openingFundAmountCents: 15000,
    openingReason: "troco inicial"
  });
  const withReceipt = receiveCashPayment(opened.session, {
    movementId: "cash_mov_1",
    actor,
    occurredAt: "2026-03-12T14:10:00.000Z",
    auditEventId: "evt_cash_receipt_1",
    method: "DINHEIRO",
    amountCents: 6200,
    sourceEntity: "COMANDA",
    sourceEntityId: "cmd_100",
    reason: "checkout comanda 100"
  });
  const withSupply = registerCashSupply(withReceipt.session, {
    movementId: "cash_mov_2",
    actor,
    occurredAt: "2026-03-12T14:20:00.000Z",
    auditEventId: "evt_cash_supply_1",
    amountCents: 1000,
    reason: "reforco de troco"
  });
  const withWithdrawal = registerCashWithdrawal(withSupply.session, {
    movementId: "cash_mov_3",
    actor,
    occurredAt: "2026-03-12T14:30:00.000Z",
    auditEventId: "evt_cash_withdrawal_1",
    amountCents: 5000,
    reason: "retirada do excesso"
  });
  const closing = startCashClosure(withWithdrawal.session, {
    actor,
    occurredAt: "2026-03-12T15:00:00.000Z",
    auditEventId: "evt_cash_start_close_1",
    pendingComandasInPaymentCount: 0
  });
  const closed = closeCashSession(closing.session, {
    actor,
    occurredAt: "2026-03-12T15:10:00.000Z",
    auditEventId: "evt_cash_close_1",
    counts: [
      { method: "DINHEIRO", countedAmountCents: 17200 },
      { method: "PIX", countedAmountCents: 0 },
      { method: "CARTAO_CREDITO", countedAmountCents: 0 },
      { method: "CARTAO_DEBITO", countedAmountCents: 0 },
      { method: "OUTRO", countedAmountCents: 0 }
    ],
    note: "fechamento sem divergencia"
  });
  const auditBundle = exportCashSessionAudit(closed.session, [
    ...opened.auditEvents,
    ...withReceipt.auditEvents,
    ...withSupply.auditEvents,
    ...withWithdrawal.auditEvents,
    ...closing.auditEvents,
    ...closed.auditEvents
  ]);

  assert.equal(closed.session.status, "FECHADO");
  assert.equal(closed.session.closure?.totalExpectedAmountCents, 17200);
  assert.equal(closed.session.closure?.totalDivergenceAmountCents, 0);
  assert.equal(auditBundle.movements.length, 3);
  assert.equal(auditBundle.auditTrail.at(-1)?.action, "CAIXA_FECHADO");
}

export function runCashGuardrailScenario() {
  const actor = {
    userId: "opr_cx_01",
    terminalId: "pdv-main",
    role: "CAIXA"
  };
  const opened = openCashSession({
    cashSessionId: "cash_guard_1",
    terminalId: "pdv-main",
    actor,
    openedAt: "2026-03-12T16:00:00.000Z",
    auditEventId: "evt_cash_guard_open",
    openingFundAmountCents: 10000,
    openingReason: "troco"
  });
  const closing = startCashClosure(opened.session, {
    actor,
    occurredAt: "2026-03-12T16:10:00.000Z",
    auditEventId: "evt_cash_guard_start",
    pendingComandasInPaymentCount: 0
  });

  assert.throws(() => {
    closeCashSession(closing.session, {
      actor,
      occurredAt: "2026-03-12T16:20:00.000Z",
      auditEventId: "evt_cash_guard_close",
      counts: [
        { method: "DINHEIRO", countedAmountCents: 9900 },
        { method: "PIX", countedAmountCents: 0 },
        { method: "CARTAO_CREDITO", countedAmountCents: 0 },
        { method: "CARTAO_DEBITO", countedAmountCents: 0 },
        { method: "OUTRO", countedAmountCents: 0 }
      ],
      note: "faltou troco"
    });
  }, (error) => {
    assert.ok(error instanceof CashDomainError);
    assert.equal(error.code, "CAIXA_DIVERGENCIA_SEM_JUSTIFICATIVA");
    return true;
  });
}

function createFakeDesktopBridge(options = {}) {
  const catalog = [
    {
      productId: "prod_hamburguer",
      label: "Hamburguer",
      setor: "COZINHA",
      unitPriceCents: 3200,
      shortcutHint: "H1",
      category: "LANCHE"
    },
    {
      productId: "prod_batata",
      label: "Batata frita",
      setor: "COZINHA",
      unitPriceCents: 1800,
      shortcutHint: "B2",
      category: "PORCAO"
    },
    {
      productId: "prod_refrigerante",
      label: "Refrigerante",
      setor: "BAR",
      unitPriceCents: 900,
      shortcutHint: "R3",
      category: "BEBIDA"
    },
    {
      productId: "prod_cerveja",
      label: "Cerveja",
      setor: "BAR",
      unitPriceCents: 1200,
      shortcutHint: "C4",
      category: "BEBIDA"
    }
  ];
  const operator = {
    operatorId: "opr_admin_01",
    operatorCode: "ADMIN",
    displayLabel: "ADMIN",
    role: "GERENTE"
  };
  const state = {
    session: null,
    firstRunPending: options.firstRunPending ?? false,
    company: null,
    printRoutes: [
      { setor: "COZINHA", impressoras: ["IMP_COZINHA_01"] },
      { setor: "BAR", impressoras: ["IMP_BAR_01"] },
      { setor: "CAIXA", impressoras: ["IMP_CAIXA_01"] }
    ],
    comanda: null,
    comandaAuditTrail: [],
    cash: null,
    cashAuditTrail: [],
    sequence: 0
  };

  const nextId = (prefix) => `${prefix}_${String(++state.sequence).padStart(4, "0")}`;
  const nowIso = () => `2026-03-12T19:${String(state.sequence).padStart(2, "0")}:00.000Z`;
  const getComandaSnapshot = () => ({
    currentComanda: state.comanda,
    auditTrail: [...state.comandaAuditTrail],
    lastPreContaSnapshot: state.comanda?.preContas.at(-1) ?? null
  });
  const getCashSnapshot = () => ({
    currentSession: state.cash,
    auditTrail: [...state.cashAuditTrail],
    auditExport: state.cash ? exportCashSessionAudit(state.cash, state.cashAuditTrail) : null
  });
  const requireComanda = () => {
    if (!state.comanda) {
      throw new Error("Comanda nao encontrada.");
    }

    return state.comanda;
  };
  const requireCash = () => {
    if (!state.cash) {
      throw new Error("Caixa nao encontrado.");
    }

    return state.cash;
  };

  return {
    async getRuntimeSnapshot() {
      return createRuntimeSnapshot();
    },
    async getInstallationStatus() {
      return {
        firstRunPending: state.firstRunPending,
        configFilePath: "C:\\ProgramData\\RayzenPDV\\config\\runtime-config.json",
        appVersion: "0.1.0-test",
        completedAt: state.firstRunPending ? null : "2026-03-12T18:00:00.000Z",
        company: state.company,
        printRoutes: state.printRoutes,
        seedState: {
          adminReady: true,
          productCount: catalog.length,
          printRouteCount: state.printRoutes.length
        }
      };
    },
    async completeFirstRun(request) {
      state.firstRunPending = false;
      state.company = {
        legalName: request.companyLegalName,
        tradeName: request.companyTradeName ?? null,
        document: request.companyDocument ?? null
      };
      state.printRoutes = [
        { setor: "COZINHA", impressoras: [request.printers.cozinha] },
        { setor: "BAR", impressoras: [request.printers.bar] },
        { setor: "CAIXA", impressoras: [request.printers.caixa] }
      ];
      return this.getInstallationStatus();
    },
    async login(request) {
      if (state.firstRunPending) {
        return {
          ok: false,
          failure: {
            code: "SETUP_REQUIRED",
            message: "Conclua o first-run antes do login."
          }
        };
      }

      if (request.pin !== "1234") {
        return {
          ok: false,
          failure: {
            code: "PIN_INVALID",
            message: "PIN local invalido. Tente novamente."
          }
        };
      }

      state.session = {
        ...operator,
        authenticatedAt: nowIso()
      };

      return {
        ok: true,
        session: state.session
      };
    },
    async logout() {
      state.session = null;
    },
    async getOperatorSession() {
      return state.session;
    },
    async listCatalogProducts() {
      return [...catalog];
    },
    async getCatalogProduct(request) {
      return catalog.find((product) => product.productId === request.productId) ?? null;
    },
    async getFiscalStatus() {
      return {
        emitters: [],
        pendingQueue: [],
        recentDocuments: []
      };
    },
    async getFiscalDocumentStatus() {
      return null;
    },
    async listPendingFiscalQueue() {
      return [];
    },
    async reprocessFiscalQueue() {
      return {
        processedCount: 0,
        authorizedCount: 0,
        rejectedCount: 0,
        pendingCount: 0,
        contingencyCount: 0,
        jobs: []
      };
    },
    async queryFiscalStatusByAccessKey() {
      throw new Error("Fluxo fiscal nao faz parte do fake bridge do shell.");
    },
    async getPrintStatus() {
      return {
        routes: state.printRoutes,
        pendingJobs: []
      };
    },
    async listPrintPrinters() {
      return [
        {
          printerId: "IMP_COZINHA_01",
          printerName: "IMP_COZINHA_01",
          isOffline: false,
          isAvailable: true,
          status: "Idle"
        },
        {
          printerId: "IMP_BAR_01",
          printerName: "IMP_BAR_01",
          isOffline: false,
          isAvailable: true,
          status: "Idle"
        },
        {
          printerId: "IMP_CAIXA_01",
          printerName: "IMP_CAIXA_01",
          isOffline: false,
          isAvailable: true,
          status: "Idle"
        }
      ];
    },
    async listPrintJobs() {
      return [];
    },
    async reprocessPrintJob() {
      throw new Error("Fluxo de reprocessamento nao faz parte do fake bridge do shell.");
    },
    async getOperationalSnapshot() {
      return {
        comanda: getComandaSnapshot(),
        cash: getCashSnapshot()
      };
    },
    async openComanda(request) {
      const mutation = openComanda({
        comandaId: nextId("cmd"),
        numero: request.numero,
        mesaId: request.mesaId ?? null,
        actor: request.actor,
        openedAt: nowIso(),
        auditEventId: nextId("evt"),
        currentOwnerUserId: request.actor.userId
      });
      state.comanda = mutation.comanda;
      state.comandaAuditTrail = [...mutation.auditEvents];
      return getComandaSnapshot();
    },
    async addComandaItem(request) {
      const catalogProduct = catalog.find((product) => product.productId === request.produtoId);
      const mutation = addComandaItem(requireComanda(), {
        itemId: nextId("item"),
        produtoId: request.produtoId,
        productLabel: catalogProduct?.label ?? request.productLabel,
        setor: catalogProduct?.setor ?? request.setor,
        quantity: request.quantity,
        unitPriceCents: catalogProduct?.unitPriceCents ?? request.unitPriceCents,
        actor: request.actor,
        occurredAt: nowIso(),
        auditEventId: nextId("evt"),
        note: request.note ?? null
      });
      state.comanda = mutation.comanda;
      state.comandaAuditTrail = [...state.comandaAuditTrail, ...mutation.auditEvents];
      return getComandaSnapshot();
    },
    async cancelComandaItem(request) {
      const mutation = cancelComandaItem(requireComanda(), {
        itemId: request.itemId,
        reason: request.reason,
        actor: request.actor,
        occurredAt: nowIso(),
        auditEventId: nextId("evt")
      });
      state.comanda = mutation.comanda;
      state.comandaAuditTrail = [...state.comandaAuditTrail, ...mutation.auditEvents];
      return getComandaSnapshot();
    },
    async sendComandaToProduction(request) {
      const mutation = sendComandaToProduction(requireComanda(), {
        batchId: nextId("batch"),
        actor: request.actor,
        occurredAt: nowIso(),
        auditEventId: nextId("evt")
      });
      state.comanda = mutation.comanda;
      state.comandaAuditTrail = [...state.comandaAuditTrail, ...mutation.auditEvents];
      return getComandaSnapshot();
    },
    async startComandaCheckout(request) {
      const mutation = generateComandaPreConta(requireComanda(), {
        preContaId: nextId("pre"),
        actor: request.actor,
        occurredAt: nowIso(),
        auditEventId: nextId("evt")
      });
      state.comanda = mutation.comanda;
      state.comandaAuditTrail = [...state.comandaAuditTrail, ...mutation.auditEvents];
      return getComandaSnapshot();
    },
    async confirmComandaPayment(request) {
      const comandaMutation = checkoutComanda(requireComanda(), {
        actor: request.actor,
        occurredAt: nowIso(),
        auditEventId: nextId("evt"),
        payments: [
          {
            paymentId: nextId("pay"),
            method: request.paymentMethod,
            amountCents: request.amountCents
          }
        ]
      });
      const cashMutation = receiveCashPayment(requireCash(), {
        movementId: nextId("cashmov"),
        actor: request.actor,
        occurredAt: nowIso(),
        auditEventId: nextId("evt"),
        method: request.paymentMethod,
        amountCents: request.amountCents,
        sourceEntity: "COMANDA",
        sourceEntityId: request.comandaId,
        reason: `Checkout da comanda ${comandaMutation.comanda.numero}`
      });
      state.comanda = comandaMutation.comanda;
      state.comandaAuditTrail = [...state.comandaAuditTrail, ...comandaMutation.auditEvents];
      state.cash = cashMutation.session;
      state.cashAuditTrail = [...state.cashAuditTrail, ...cashMutation.auditEvents];
      return {
        comanda: getComandaSnapshot(),
        cash: getCashSnapshot()
      };
    },
    async openCashSession(request) {
      const mutation = openCashSession({
        cashSessionId: nextId("cash"),
        terminalId: request.actor.terminalId,
        actor: request.actor,
        openedAt: nowIso(),
        auditEventId: nextId("evt"),
        openingFundAmountCents: request.openingFundAmountCents,
        openingReason: request.openingReason ?? null
      });
      state.cash = mutation.session;
      state.cashAuditTrail = [...mutation.auditEvents];
      return getCashSnapshot();
    },
    async registerCashReceipt(request) {
      const mutation = receiveCashPayment(requireCash(), {
        movementId: nextId("cashmov"),
        actor: request.actor,
        occurredAt: nowIso(),
        auditEventId: nextId("evt"),
        method: request.method,
        amountCents: request.amountCents,
        reason: request.reason ?? null
      });
      state.cash = mutation.session;
      state.cashAuditTrail = [...state.cashAuditTrail, ...mutation.auditEvents];
      return getCashSnapshot();
    },
    async registerCashSupply(request) {
      const mutation = registerCashSupply(requireCash(), {
        movementId: nextId("cashmov"),
        actor: request.actor,
        occurredAt: nowIso(),
        auditEventId: nextId("evt"),
        amountCents: request.amountCents,
        reason: request.reason
      });
      state.cash = mutation.session;
      state.cashAuditTrail = [...state.cashAuditTrail, ...mutation.auditEvents];
      return getCashSnapshot();
    },
    async registerCashWithdrawal(request) {
      const mutation = registerCashWithdrawal(requireCash(), {
        movementId: nextId("cashmov"),
        actor: request.actor,
        occurredAt: nowIso(),
        auditEventId: nextId("evt"),
        amountCents: request.amountCents,
        reason: request.reason
      });
      state.cash = mutation.session;
      state.cashAuditTrail = [...state.cashAuditTrail, ...mutation.auditEvents];
      return getCashSnapshot();
    },
    async startCashClosure(request) {
      const mutation = startCashClosure(requireCash(), {
        actor: request.actor,
        occurredAt: nowIso(),
        auditEventId: nextId("evt"),
        pendingComandasInPaymentCount: state.comanda?.status === "EM_PAGAMENTO" ? 1 : 0
      });
      state.cash = mutation.session;
      state.cashAuditTrail = [...state.cashAuditTrail, ...mutation.auditEvents];
      return getCashSnapshot();
    },
    async closeCashSession(request) {
      const mutation = closeCashSession(requireCash(), {
        actor: request.actor,
        occurredAt: nowIso(),
        auditEventId: nextId("evt"),
        counts: request.counts,
        note: request.note ?? null,
        divergenceReason: request.divergenceReason ?? null
      });
      state.cash = mutation.session;
      state.cashAuditTrail = [...state.cashAuditTrail, ...mutation.auditEvents];
      return getCashSnapshot();
    },
    async exportCashAudit() {
      return getCashSnapshot();
    }
  };
}

function createRuntimeSnapshot() {
  return {
    bootstrap: {
      appVersion: "0.1.0-test",
      environment: "test",
      offlineFirst: true,
      httpApiEnabled: false,
      ipcMode: "electron-ipc",
      databaseReady: true,
      logFilePath: "C:\\ProgramData\\RayzenPDV\\logs\\rayzen.log"
    },
    health: {
      ready: true,
      databaseReady: true,
      httpApiEnabled: false,
      ipcMode: "electron-ipc",
      dbFilePath: "C:\\ProgramData\\RayzenPDV\\data\\rayzen-pdv.sqlite",
      logFilePath: "C:\\ProgramData\\RayzenPDV\\logs\\rayzen.log"
    }
  };
}

function createEmptyCashWorkspace() {
  return {
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
  };
}

function createEmptyFirstRunWorkspace() {
  return {
    status: {
      firstRunPending: false,
      configFilePath: "C:\\ProgramData\\RayzenPDV\\config\\runtime-config.json",
      appVersion: "0.1.0-test",
      completedAt: "2026-03-12T18:00:00.000Z",
      company: {
        legalName: "Rayzen Restaurante Matriz",
        tradeName: "Rayzen Bar",
        document: "12.345.678/0001-99"
      },
      printRoutes: [
        { setor: "COZINHA", impressoras: ["IMP_COZINHA_01"] },
        { setor: "BAR", impressoras: ["IMP_BAR_01"] },
        { setor: "CAIXA", impressoras: ["IMP_CAIXA_01"] }
      ],
      seedState: {
        adminReady: true,
        productCount: 4,
        printRouteCount: 3
      }
    },
    availablePrinters: [],
    companyLegalNameDraft: "",
    companyTradeNameDraft: "",
    companyDocumentDraft: "",
    cozinhaPrinterDraft: "IMP_COZINHA_01",
    barPrinterDraft: "IMP_BAR_01",
    caixaPrinterDraft: "IMP_CAIXA_01",
    submitting: false
  };
}

export async function runAllPdvShellTests() {
  await runAuthenticationScenario();
  await runControllerScenario();
  await runFirstRunScenario();
  await runCashControllerScenario();
  runShortcutFixtureScenario();
  runComandaUiRenderScenario();
  runCashUiRenderScenario();
  runFirstRunUiRenderScenario();
  runComandaLifecycleScenario();
  runComandaCancellationScenario();
  runComandaGuardrailScenario();
  runCashLifecycleScenario();
  runCashGuardrailScenario();

  console.log("[apps/pdv] 13 runtime checks passed.");
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await runAllPdvShellTests();
}
