import { createShellThemeCssVariables, rayzenShellTheme } from "./theme.js";

import {
  SHELL_SHORTCUTS,
  calculateCashSessionTotals,
  getMainNavigationForRole,
  type CashSessionAggregate,
  type ComandaAggregate,
  type ComandaItem,
  type MainViewId,
  type ShellState
} from "../domain/index.js";

const PAYMENT_METHODS = [
  "DINHEIRO",
  "PIX",
  "CARTAO_CREDITO",
  "CARTAO_DEBITO",
  "OUTRO"
] as const;

export function applyShellTheme(target: HTMLElement): void {
  for (const [token, value] of createShellThemeCssVariables(rayzenShellTheme)) {
    target.style.setProperty(token, value);
  }
}

export function renderShellScaffold(): string {
  return `
    <main class="pdv-shell">
      <div class="pdv-shell__frame">
        <div id="status-region"></div>
        <section id="auth-region"></section>
        <section id="workspace-region" class="shell-workspace shell-workspace--comanda" hidden>
          <aside id="categorias"></aside>
          <section id="produtos"></section>
          <aside id="pedido"></aside>
        </section>
      </div>
    </main>
  `;
}

export function renderShell(state: ShellState): string {
  const workspaceVisible = !state.firstRunWorkspace.status?.firstRunPending && Boolean(state.session);

  return `
    ${renderShellScaffold()
      .replace('<div id="status-region"></div>', `<div id="status-region">${renderStatusStrip(state)}</div>`)
      .replace(
        '<section id="auth-region"></section>',
        `<section id="auth-region"${workspaceVisible ? " hidden" : ""}>${renderAuthRegion(state)}</section>`
      )
      .replace(
        '<section id="workspace-region" class="shell-workspace shell-workspace--comanda" hidden>\n          <aside id="categorias"></aside>\n          <section id="produtos"></section>\n          <aside id="pedido"></aside>\n        </section>',
        `<section id="workspace-region" class="shell-workspace shell-workspace--comanda"${workspaceVisible ? "" : " hidden"}>
          <aside id="categorias">${workspaceVisible ? renderCategorias(state) : ""}</aside>
          <section id="produtos">${workspaceVisible ? renderProdutos(state) : ""}</section>
          <aside id="pedido">${workspaceVisible ? renderPedido(state) : ""}</aside>
        </section>`
      )}
  `;
}

export function getPreferredFocusSelector(state: ShellState): string | null {
  switch (state.focusTarget) {
    case "setup-company-legal-name":
      return "#setup-company-legal-name";
    case "pin-input":
      return "#pin-input";
    case "mesas-primary-action":
      return "#mesas-primary-action";
    case "product-search":
      return "#product-search";
    case "comanda-numero":
      return "#comanda-numero";
    case "cancel-reason":
      return "#cancel-reason";
    case "checkout-amount":
      return "#checkout-amount";
    case "cash-opening-fund":
      return "#cash-opening-fund";
    case "cash-receipt-amount":
      return "#cash-receipt-amount";
    case "cash-divergence-reason":
      return "#cash-divergence-reason";
    default:
      return !state.session ? "#pin-input" : null;
  }
}

function renderFirstRunWizard(state: ShellState): string {
  const discoveredPrinters = state.firstRunWorkspace.availablePrinters;

  return `
    <section class="shell-auth" aria-label="First-run do terminal">
      <article class="panel">
        <p class="panel__eyebrow">Instalacao inicial</p>
        <h1 class="panel__title">Configurar o terminal antes de liberar o PDV</h1>
        <p class="panel__lead">
          Banco de dados local pronto. Configure os dados da empresa e as impressoras termicas para liberar o terminal.
        </p>
        <div class="summary-stack">
          <div class="info-card">
            <span class="muted-text">Admin inicial</span>
            <strong>${state.firstRunWorkspace.status?.seedState.adminReady ? "ADMIN pronto" : "ADMIN pendente"}</strong>
          </div>
          <div class="info-card">
            <span class="muted-text">Catalogo seed</span>
            <strong>${state.firstRunWorkspace.status?.seedState.productCount ?? 0} produtos locais</strong>
          </div>
          <div class="info-card">
            <span class="muted-text">Config persistida</span>
            <strong>${escapeHtml(state.firstRunWorkspace.status?.configFilePath ?? "config indefinida")}</strong>
          </div>
        </div>
        <ol class="item-table">
          <li class="item-row"><span>1. Operador admin</span><span>seed idempotente no SQLite</span></li>
          <li class="item-row"><span>2. Empresa</span><span>nome fantasia e documento local</span></li>
          <li class="item-row"><span>3. Impressoras</span><span>cozinha, bar e caixa</span></li>
          <li class="item-row"><span>4. Banco inicial</span><span>criado em %ProgramData%\\RayzenPDV\\data</span></li>
          <li class="item-row"><span>5. Seed</span><span>produtos e rotas base reaproveitados</span></li>
        </ol>
      </article>
      <article class="panel">
        <p class="panel__eyebrow">Wizard de first-run</p>
        <h2 class="panel__title">Dados mínimos para liberar o terminal</h2>
        <div class="cash-form-grid">
          <label class="field-block">
            <span class="field-label">Razão social ou nome operacional</span>
            <input id="setup-company-legal-name" value="${escapeHtml(state.firstRunWorkspace.companyLegalNameDraft)}" placeholder="Rayzen Restaurante Matriz" />
          </label>
          <label class="field-block">
            <span class="field-label">Nome fantasia</span>
            <input id="setup-company-trade-name" value="${escapeHtml(state.firstRunWorkspace.companyTradeNameDraft)}" placeholder="Rayzen Bar" />
          </label>
          <label class="field-block">
            <span class="field-label">Documento</span>
            <input id="setup-company-document" value="${escapeHtml(state.firstRunWorkspace.companyDocumentDraft)}" placeholder="00.000.000/0001-00" />
          </label>
        </div>
        <div class="cash-form-grid">
          <label class="field-block">
            <span class="field-label">Impressora cozinha</span>
            <input id="setup-printer-cozinha" value="${escapeHtml(state.firstRunWorkspace.cozinhaPrinterDraft)}" placeholder="IMP_COZINHA_01" />
          </label>
          <label class="field-block">
            <span class="field-label">Impressora bar</span>
            <input id="setup-printer-bar" value="${escapeHtml(state.firstRunWorkspace.barPrinterDraft)}" placeholder="IMP_BAR_01" />
          </label>
          <label class="field-block">
            <span class="field-label">Impressora caixa</span>
            <input id="setup-printer-caixa" value="${escapeHtml(state.firstRunWorkspace.caixaPrinterDraft)}" placeholder="IMP_CAIXA_01" />
          </label>
        </div>
        <label class="field-block">
          <span class="field-label">Logo do terminal</span>
          <input id="setup-company-logo-file-path" value="${escapeHtml(state.firstRunWorkspace.companyLogoFilePathDraft)}" placeholder="C:\\logos\\cliente.png" />
          <span class="muted-text">Informe um arquivo local PNG, JPG, JPEG, WEBP ou SVG. O caminho fica salvo no terminal.</span>
        </label>
        <div class="section-actions">
          <button type="button" class="hero-button" data-action="complete-first-run">
            ${state.firstRunWorkspace.submitting ? "Aplicando configuração..." : "Concluir first-run"}
          </button>
        </div>
        ${renderFeedback(state)}
        <div class="summary-stack">
          <div class="info-card">
            <span class="muted-text">Impressoras detectadas no Windows</span>
            <strong>${discoveredPrinters.length > 0 ? `${discoveredPrinters.length} encontradas` : "nenhuma detectada agora"}</strong>
            <span class="muted-text">${escapeHtml(discoveredPrinters.map((printer) => printer.printerName).join(", ") || "Você pode informar o nome manualmente.")}</span>
          </div>
        </div>
      </article>
    </section>
  `;
}

export function renderStatusStrip(state: ShellState): string {
  const currentComanda = getSelectedComandaFromState(state);
  const currentCashSession = state.cashWorkspace.currentSession;
  const brandName = state.firstRunWorkspace.status?.company?.tradeName
    ?? state.firstRunWorkspace.status?.company?.legalName
    ?? "Terminal local";
  const activeComandaChip = currentComanda
    ? renderStatusChip("Comanda", `${currentComanda.numero} ${formatComandaStatus(currentComanda.status)}`, "ok")
    : renderStatusChip("Comanda", "sem aberta", "warn");
  const activeCashChip = currentCashSession
    ? renderStatusChip("Caixa", formatCashStatus(currentCashSession.status), currentCashSession.status === "FECHADO" ? "warn" : "ok")
    : renderStatusChip("Caixa", "fechado", "warn");

  return `
    <section class="status-strip" aria-label="Status operacional do shell">
      <div class="status-strip__brand">
        <span class="status-strip__eyebrow">${escapeHtml(brandName)}</span>
        <strong class="status-strip__title">Rayzen PDV</strong>
      </div>
      <div class="status-strip__meta">
        ${renderStatusChip("Local", state.bootstrap.offlineFirst ? "ativo" : "pendente", "ok")}
        ${renderStatusChip("Base", state.health.databaseReady ? "pronta" : "pendente", state.health.databaseReady ? "ok" : "warn")}
        ${activeCashChip}
        ${activeComandaChip}
        ${state.waiterUrl ? renderStatusChip("Garçom", state.waiterUrl, "ok") : ""}
      </div>
    </section>
  `;
}

function renderAuth(state: ShellState): string {
  return `
    <section class="shell-auth" aria-label="Autenticação local por PIN">
      <article class="panel">
        <p class="panel__eyebrow">Acesso local</p>
        <h1 class="panel__title">Confirme o PIN local para acessar o terminal</h1>
        <p class="panel__lead">
          Acesso validado localmente. Nenhuma conexao com internet e necessaria para operar o terminal.
        </p>
        <div class="summary-stack">
          <div class="info-card">
            <span class="muted-text">Base local</span>
            <strong>Operadores e catálogo no SQLite</strong>
          </div>
          <div class="info-card">
            <span class="muted-text">Primeiro acesso</span>
            <strong>ADMIN / PIN 1234</strong>
          </div>
        </div>
      </article>
      <article class="panel">
        <p class="panel__eyebrow">PIN local</p>
        <h2 class="panel__title">Login local do PDV</h2>
        <div class="pin-stage">
          <div class="pin-display">
            <label class="sr-only" for="pin-input">PIN local</label>
            <input
              id="pin-input"
              type="password"
              inputmode="numeric"
              autocomplete="off"
              maxlength="6"
              placeholder="Digite o PIN"
              value="${escapeHtml(state.pinInput)}"
            />
            <span class="muted-text">Use ENTER para confirmar e ESC para limpar o campo.</span>
          </div>
          ${renderFeedback(state)}
          <div class="pad-grid" aria-label="Teclado numérico local">
            ${["1", "2", "3", "4", "5", "6", "7", "8", "9"]
              .map((digit) => {
                return `
                  <button type="button" class="pad-button" data-action="pin-digit" data-value="${digit}">
                    ${digit}
                  </button>
                `;
              })
              .join("")}
            <button type="button" class="pad-button" data-action="pin-clear">Limpar</button>
            <button type="button" class="pad-button" data-action="pin-digit" data-value="0">0</button>
            <button type="button" class="pad-button" data-action="pin-backspace">Apagar</button>
          </div>
          <button type="button" class="hero-button" data-action="submit-pin">
            Confirmar sessão local
          </button>
        </div>
      </article>
    </section>
  `;
}

export function renderAuthRegion(state: ShellState): string {
  return state.firstRunWorkspace.status?.firstRunPending ? renderFirstRunWizard(state) : state.session ? "" : renderAuth(state);
}

export function renderCategorias(state: ShellState): string {
  const session = state.session;

  if (!session) {
    return "";
  }

  const navigation = getMainNavigationForRole(session.role);

  return `
    <aside class="panel panel--dense panel--nav panel--nav-compact">
      <p class="panel__eyebrow">Navegação principal</p>
      <nav class="workspace-nav" aria-label="Fluxos principais">
        ${navigation
          .map((view) => {
            const isCurrent = view.id === state.currentViewId;

            return `
              <button
                type="button"
                class="nav-button${isCurrent ? " categoria--ativa" : ""}"
                data-action="navigate"
                data-view-id="${view.id}"
                aria-current="${isCurrent ? "page" : "false"}"
              >
                <span class="nav-button__title">${escapeHtml(view.label)}</span>
                <span class="nav-button__shortcut">${view.shortcut ? escapeHtml(view.shortcut) : "sem atalho"}</span>
                <span class="operator-card__meta">${escapeHtml(resolveNavigationHint(view.id))}</span>
              </button>
            `;
          })
          .join("")}
      </nav>
    </aside>
  `;
}

export function renderProdutos(state: ShellState): string {
  const session = state.session;

  if (!session) {
    return "";
  }

  /*
   * ESTRUTURA CORRIGIDA:
   * A section .workspace-main precisa de height: 100% + overflow: hidden para
   * que o #produtos-mainview preencha o espaço sem vazar para fora do flex container.
   * O inline style garante isso independente do CSS externo.
   */
  if (state.currentViewId === "comandas") {
    return `
      <section
        class="workspace-main workspace-main--comandas"
        style="display:flex;flex-direction:column;height:100%;overflow:hidden;"
      >
        <div
          id="produtos-mainview"
          style="display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;"
        >${renderMainView(state)}</div>
      </section>
    `;
  }

  return `
    <section class="workspace-main">
      <header class="panel panel--dense workspace-header workspace-header--compact workspace-header--micro">
        <div class="workspace-header__row">
          <div class="workspace-header__meta" id="workspace-header-meta">${renderWorkspaceHeaderMeta(state)}</div>
          <button type="button" class="secondary-button secondary-button--micro" data-action="logout-session">
            Sair
          </button>
        </div>
        <div id="workspace-feedback">${renderFeedback(state)}</div>
      </header>
      <div id="produtos-mainview">${renderMainView(state)}</div>
      <section class="panel panel--dense">
        <p class="panel__eyebrow">Atalhos canonicos</p>
        <div class="command-bar command-bar--compact">
          ${Object.entries(SHELL_SHORTCUTS)
            .map(([shortcut, description]) => {
              return `
                <span class="command-hint">
                  <strong>${shortcut}</strong>
                  <span>${escapeHtml(description)}</span>
                </span>
              `;
            })
            .join("")}
        </div>
      </section>
    </section>
  `;
}

/*
 * PEDIDO REFATORADO:
 *
 * View "comandas":
 *   - Coluna superior (flex: 1, overflow-y: auto): lista de itens da comanda
 *   - Coluna inferior (flex-shrink: 0): seção de CANCELAMENTO sempre visível
 *
 * Isso elimina a duplicação (a tabela de itens não fica mais no centro E no pedido)
 * e garante que o cancel nunca seja cortado.
 *
 * Outras views mantêm o comportamento original.
 */
export function renderPedido(state: ShellState): string {
  const currentComanda = getSelectedComandaFromState(state);
  const currentCashSession = state.cashWorkspace.currentSession;
  const totals = currentComanda ? summarizeComanda(currentComanda) : null;
  const cashTotals = currentCashSession ? summarizeCashSession(currentCashSession) : null;
  const showAuditTrail = state.currentViewId === "caixa";

  if (state.currentViewId === "comandas") {
    return renderPedidoComandasLayout(state, currentComanda, totals);
  }

  if (state.currentViewId === "equipe") {
    return "";
  }

  return `
    <aside class="aside-grid">
      <article class="panel panel--dense">
        <p class="panel__eyebrow">${state.currentViewId === "caixa" ? "Resumo do caixa" : "Pedido atual"}</p>
        ${state.currentViewId === "caixa"
          ? renderCashSummary(currentCashSession, cashTotals)
          : currentComanda && totals
            ? `
                ${renderPedidoPanel(currentComanda, totals, state.comandaWorkspace.selectedItemId)}
              `
            : `<div class="empty-copy">Abra uma comanda para ver totais e itens do pedido.</div>`}
      </article>
      ${showAuditTrail
        ? `
            <article class="panel panel--dense">
              <p class="panel__eyebrow" id="pedido-audit-title">Auditoria do caixa</p>
              <div id="pedido-audit-body">${renderAuditTrail(state)}</div>
            </article>
          `
        : ""}
    </aside>
  `;
}

/*
 * LAYOUT DO PEDIDO PARA A VIEW COMANDAS:
 *
 * Aside dividido em dois blocos com flex-direction: column height: 100%:
 *
 *  ┌─────────────────────────┐
 *  │  PEDIDO ATUAL           │  ← header fixo
 *  │  KPIs: mesa/status/saldo│
 *  │  ┌───────────────────┐  │
 *  │  │  lista de itens   │  │  ← flex: 1, overflow-y: auto (scroll)
 *  │  │  (scrollable)     │  │
 *  │  └───────────────────┘  │
 *  │  Totais (sempre visível) │  ← flex-shrink: 0
 *  ├─────────────────────────┤
 *  │  CANCELAR ITEM          │  ← flex-shrink: 0, SEMPRE VISÍVEL
 *  │  motivo + botão         │
 *  └─────────────────────────┘
 *
 * Com isso:
 * - Não há mais tabela de itens duplicada no centro E no aside
 * - Cancel nunca é cortado independente da quantidade de itens
 * - Um único scroll controlado na lista de itens
 */
function renderPedidoComandasLayout(
  state: ShellState,
  currentComanda: ComandaAggregate | null,
  totals: ReturnType<typeof summarizeComanda> | null
): string {
  const selectedItem = currentComanda?.items.find(
    (item) => item.itemId === state.comandaWorkspace.selectedItemId
  ) ?? null;

  return `
    <aside
      class="aside-grid aside-grid--comandas"
      style="display:flex;flex-direction:column;height:100%;overflow:hidden;gap:0;"
    >
      <!-- BLOCO SUPERIOR: itens da comanda (ocupa espaço disponível, scrollável) -->
      <article
        class="panel panel--dense"
        style="display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;"
      >
        <p class="panel__eyebrow">Pedido atual</p>

        ${currentComanda && totals
          ? `
              <!-- Resumo compacto: mesa · status · saldo em uma linha -->
              <div
                id="pedido-kpis-bar"
                style="flex-shrink:0;display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;margin-bottom:.5rem;"
              >
                <strong id="pedido-title" style="white-space:nowrap;">${escapeHtml(currentComanda.mesaId ?? "Sem mesa")}</strong>
                <span class="surface-pill" id="pedido-meta" style="font-size:11px;">${escapeHtml(formatComandaStatus(currentComanda.status))}</span>
                <span class="muted-text" id="pedido-count" style="font-size:12px;">${currentComanda.items.filter(i => i.status !== "CANCELADO").length} itens</span>
                <span style="flex:1;"></span>
                <strong id="pedido-total-due" style="color:var(--rayzen-colorAccentSoft,#f2bc67);white-space:nowrap;">${formatCurrency(totals.dueCents)}</strong>
              </div>

              <!-- Lista de itens: scroll interno -->
              <div
                class="pedido-list"
                id="pedido-list"
                aria-label="Itens do pedido"
                style="flex:1;overflow-y:auto;min-height:0;"
              >${renderPedidoList(currentComanda, state.comandaWorkspace.selectedItemId)}</div>

              <!-- Totais fixos na base do bloco superior -->
              <div
                class="pedido-footer"
                id="pedido-footer"
                style="flex-shrink:0;border-top:1px solid var(--color-border, rgba(255,255,255,.08));padding-top:.5rem;margin-top:.5rem;"
              >
                <div class="pedido-total">
                  <span class="muted-text">Total</span>
                  <strong id="pedido-total-value">${formatCurrency(totals.totalCents)}</strong>
                </div>
                <button type="button" class="hero-button btn-finalizar" data-action="generate-preconta">Pré-conta</button>
              </div>
            `
          : `<div class="empty-copy">Abra uma comanda para ver o pedido.</div>`}
      </article>

      <!-- BLOCO INFERIOR: cancelamento — sempre visível, nunca scrollado para fora -->
      <article
        class="panel panel--dense panel--cancel"
        style="flex-shrink:0;"
      >
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem;">
          <p class="panel__eyebrow" style="margin:0;">Cancelar item</p>
          <span class="surface-pill" id="comanda-cancel-summary">
            ${selectedItem ? escapeHtml(selectedItem.productLabel) : "Selecione um item"}
          </span>
        </div>
        <div id="comanda-cancel-panel">${renderComandaCancelPanel(state)}</div>
      </article>
    </aside>
  `;
}

export function updateProdutosRegion(target: HTMLElement, state: ShellState): void {
  const layoutKey = `${state.session?.operatorId ?? "anon"}:${state.currentViewId}`;
  const currentLayout = target.dataset["layoutKey"];

  if (currentLayout !== layoutKey || !target.querySelector("#produtos-mainview")) {
    target.innerHTML = renderProdutos(state);
    target.dataset["layoutKey"] = layoutKey;
    return;
  }

  const headerMeta = target.querySelector<HTMLElement>("#workspace-header-meta");
  const feedback = target.querySelector<HTMLElement>("#workspace-feedback");
  const mainview = target.querySelector<HTMLElement>("#produtos-mainview");

  if (headerMeta) {
    headerMeta.innerHTML = renderWorkspaceHeaderMeta(state);
  }

  if (feedback) {
    feedback.innerHTML = renderFeedback(state);
  }

  /*
   * Para a view de comandas a estrutura foi simplificada:
   * o centro agora tem apenas busca + catálogo + header da comanda.
   * A tabela de itens e o cancel foram para o #pedido (renderPedidoComandasLayout).
   *
   * Só fazemos reconciliação do product-list e dos campos de input.
   */
  if (state.currentViewId === "comandas") {
    if (mainview) {
      // Feedback inline
      const feedbackContainer = mainview.querySelector<HTMLElement>("#comanda-feedback-container");
      if (feedbackContainer) {
        feedbackContainer.innerHTML = state.feedbackMessage ? renderFeedback(state) : "";
      }

      // Estado da comanda em foco (pill no row 1)
      const focusPill = mainview.querySelector<HTMLElement>("[data-comanda-foco-pill]");
      if (focusPill) {
        const currentComanda = getSelectedComandaFromState(state);
        focusPill.textContent = currentComanda
          ? `${currentComanda.numero} · ${formatComandaStatus(currentComanda.status)}`
          : "sem comanda";
      }

      // Tabs de categoria
      const categoryTabs = mainview.querySelector<HTMLElement>("#catalog-category-tabs");
      if (categoryTabs) {
        categoryTabs.innerHTML = renderCategoryTabs(state);
      }

      // Lista rápida de produtos
      const productList = mainview.querySelector<HTMLElement>("#product-list");
      if (productList) {
        productList.innerHTML = renderProductQuickList(state);
      }

      // Sincroniza inputs
      syncInputValue(mainview.querySelector<HTMLInputElement>("#comanda-numero"), state.comandaWorkspace.comandaNumeroDraft);
      syncInputValue(mainview.querySelector<HTMLInputElement>("#mesa-draft"), state.comandaWorkspace.mesaDraft);
    }

    return;
  }

  if (mainview) {
    mainview.innerHTML = renderMainView(state);
  }
}

export function updatePedidoRegion(target: HTMLElement, state: ShellState): void {
  /*
   * Para comandas: o layout key inclui o selectedComandaId para re-renderizar
   * apenas quando a comanda selecionada muda. Dentro da mesma comanda,
   * fazemos reconciliação incremental.
   */
  if (state.currentViewId === "comandas") {
    const layoutKey = `comandas:${state.comandaWorkspace.selectedComandaId ?? "none"}`;
    const currentLayout = target.dataset["layoutKey"];

    if (currentLayout !== layoutKey || !target.querySelector("#pedido-list")) {
      target.innerHTML = renderPedido(state);
      target.dataset["layoutKey"] = layoutKey;
      return;
    }

    const currentComanda = getSelectedComandaFromState(state);
    const totals = currentComanda ? summarizeComanda(currentComanda) : null;
    const pedidoList = target.querySelector<HTMLElement>("#pedido-list");
    const pedidoTitle = target.querySelector<HTMLElement>("#pedido-title");
    const pedidoMeta = target.querySelector<HTMLElement>("#pedido-meta");
    const pedidoCount = target.querySelector<HTMLElement>("#pedido-count");
    const totalValue = target.querySelector<HTMLElement>("#pedido-total-value");
    const totalDue = target.querySelector<HTMLElement>("#pedido-total-due");
    const cancelPanel = target.querySelector<HTMLElement>("#comanda-cancel-panel");
    const cancelSummary = target.querySelector<HTMLElement>("#comanda-cancel-summary");

    if (!currentComanda || !totals) {
      target.innerHTML = renderPedido(state);
      target.dataset["layoutKey"] = layoutKey;
      return;
    }

    if (pedidoTitle) {
      pedidoTitle.textContent = escapeHtml(currentComanda.mesaId ?? "Sem mesa");
    }

    if (pedidoMeta) {
      pedidoMeta.textContent = formatComandaStatus(currentComanda.status);
    }

    if (pedidoCount) {
      pedidoCount.textContent = `${currentComanda.items.filter((item) => item.status !== "CANCELADO").length} itens`;
    }

    if (pedidoList) {
      reconcilePedidoList(
        pedidoList,
        currentComanda.items.filter((item) => item.status !== "CANCELADO"),
        state.comandaWorkspace.selectedItemId
      );
    }

    if (totalValue) {
      totalValue.textContent = formatCurrency(totals.totalCents);
    }

    if (totalDue) {
      totalDue.textContent = formatCurrency(totals.dueCents);
    }

    if (cancelPanel) {
      cancelPanel.innerHTML = renderComandaCancelPanel(state);
    }

    if (cancelSummary) {
      const selectedItem = currentComanda.items.find((item) => item.itemId === state.comandaWorkspace.selectedItemId) ?? null;
      cancelSummary.textContent = selectedItem?.productLabel ?? "Selecione um item";
    }

    syncInputValue(target.querySelector<HTMLInputElement>("#cancel-reason"), state.comandaWorkspace.cancelReasonDraft);
    return;
  }

  // Para todas as outras views, comportamento original
  const layoutKey = `${state.currentViewId}:${state.comandaWorkspace.selectedComandaId ?? "none"}:${state.cashWorkspace.currentSession?.cashSessionId ?? "no-cash"}`;
  const currentLayout = target.dataset["layoutKey"];

  if (currentLayout !== layoutKey || !target.querySelector(".pedido-panel")) {
    target.innerHTML = renderPedido(state);
    target.dataset["layoutKey"] = layoutKey;
    return;
  }

  if (state.currentViewId === "caixa") {
    target.innerHTML = renderPedido(state);
    target.dataset["layoutKey"] = layoutKey;
    return;
  }

  const currentComanda = getSelectedComandaFromState(state);
  const totals = currentComanda ? summarizeComanda(currentComanda) : null;
  const pedidoList = target.querySelector<HTMLElement>("#pedido-list");
  const pedidoTitle = target.querySelector<HTMLElement>("#pedido-title");
  const pedidoMeta = target.querySelector<HTMLElement>("#pedido-meta");
  const pedidoCount = target.querySelector<HTMLElement>("#pedido-count");
  const totalValue = target.querySelector<HTMLElement>("#pedido-total-value");
  const totalDue = target.querySelector<HTMLElement>("#pedido-total-due");
  const auditTitle = target.querySelector<HTMLElement>("#pedido-audit-title");
  const auditBody = target.querySelector<HTMLElement>("#pedido-audit-body");

  if (!currentComanda || !totals) {
    target.innerHTML = renderPedido(state);
    target.dataset["layoutKey"] = layoutKey;
    return;
  }

  if (pedidoTitle) {
    pedidoTitle.textContent = `Comanda ${currentComanda.numero}`;
  }

  if (pedidoMeta) {
    pedidoMeta.textContent = `${currentComanda.mesaId ?? "Sem mesa"} · ${currentComanda.status}`;
  }

  if (pedidoCount) {
    pedidoCount.textContent = `${currentComanda.items.filter((item) => item.status !== "CANCELADO").length} itens`;
  }

  if (pedidoList) {
    reconcilePedidoList(
      pedidoList,
      currentComanda.items.filter((item) => item.status !== "CANCELADO"),
      state.comandaWorkspace.selectedItemId
    );
  }

  if (totalValue) {
    totalValue.textContent = formatCurrency(totals.totalCents);
  }

  if (totalDue) {
    totalDue.textContent = `Em aberto ${formatCurrency(totals.dueCents)}`;
  }

  if (auditTitle) {
    auditTitle.textContent = "Trilha local";
  }

  if (auditBody) {
    auditBody.innerHTML = renderAuditTrail(state);
  }
}

function renderMainView(state: ShellState): string {
  switch (state.currentViewId) {
    case "comandas":
      return renderComandasView(state);
    case "catalogo":
      return renderCatalogoView(state);
    case "producao":
      return renderProducaoView(state);
    case "preconta":
      return renderPreContaView(state);
    case "checkout":
      return renderCheckoutView(state);
    case "mesas":
      return renderMesasView(state);
    case "caixa":
      return renderCaixaView(state);
    case "equipe":
      return renderEquipeView(state);
  }
}

/*
 * COMANDAS VIEW — LAYOUT OPERACIONAL:
 *
 *  ROW 1 (flex-shrink:0) — BARRA ÚNICA de comanda + lançamento:
 *    [#101 input] [Buscar] | [Produção] [Pré-conta] | [Sair]
 *
 *  ROW 2 (flex-shrink:0) — TABS de categoria (Bebidas | Pratos | Porções...)
 *
 *  ROW 3 (flex:1) — PRODUTOS da categoria selecionada com botão [+] por item
 *
 *  ROW 4 (flex-shrink:0) — HINTS de teclado
 *
 * Fluxo primário: tab de categoria → toque no [+] ao lado do produto → adicionado.
 * Sem títulos, sem descrições, sem labels desnecessários.
 */
function renderComandasView(state: ShellState): string {
  return `
    <section
      class="comanda-console"
      style="display:flex;flex-direction:column;height:100%;overflow:hidden;gap:0;"
    >
      <!-- ROW 1: busca de comanda + ações de lançamento + identidade — UMA LINHA -->
      <div
        class="panel panel--dense"
        style="flex-shrink:0;display:flex;align-items:center;gap:.5rem;flex-wrap:nowrap;padding-top:.5rem;padding-bottom:.5rem;"
      >
        <!-- Busca de comanda: número + mesa opcional + botão -->
        <input
          id="comanda-numero"
          value="${escapeHtml(state.comandaWorkspace.comandaNumeroDraft)}"
          placeholder="Nº comanda"
          style="width:7rem;flex-shrink:0;"
          inputmode="numeric"
        />
        <input
          id="mesa-draft"
          value="${escapeHtml(state.comandaWorkspace.mesaDraft)}"
          placeholder="Mesa (opcional)"
          style="width:8rem;flex-shrink:0;"
        />
        <button
          type="button"
          class="hero-button hero-button--compact"
          data-action="open-comanda"
          style="flex-shrink:0;"
        >Buscar</button>

        <!-- Separador visual -->
        <span style="width:1px;height:1.5rem;background:var(--color-border,rgba(255,255,255,.15));flex-shrink:0;margin:0 .25rem;"></span>

        <!-- Ações de lançamento -->
        <button type="button" class="secondary-button secondary-button--compact" data-action="send-production" style="flex-shrink:0;">Produção</button>
        <button type="button" class="secondary-button secondary-button--compact" data-action="generate-preconta" style="flex-shrink:0;">Pré-conta</button>

        <!-- Espaço elástico -->
        <span style="flex:1;min-width:0;"></span>

        <button type="button" class="secondary-button secondary-button--micro" data-action="logout-session" style="flex-shrink:0;">Sair</button>
      </div>

      <!-- Feedback inline (só aparece quando há mensagem) -->
      <div id="comanda-feedback-container" style="flex-shrink:0;">
        ${state.feedbackMessage ? renderFeedback(state) : ""}
      </div>

      <!-- ROW 2: tabs de categoria -->
      <div
        id="catalog-category-tabs"
        style="flex-shrink:0;display:flex;gap:.25rem;overflow-x:auto;padding:.3rem .5rem;border-bottom:1px solid var(--color-border,rgba(255,255,255,.1));"
      >${renderCategoryTabs(state)}</div>

      <!-- ROW 3: lista de produtos da categoria — cada item tem botão [+] -->
      <div
        id="product-list"
        tabindex="-1"
        style="flex:1;overflow-y:auto;min-height:0;"
      >${renderProductQuickList(state)}</div>

      <!-- ROW 4: hints de teclado (fixo na base) -->
      <div
        class="command-bar comanda-console__hints panel panel--dense"
        style="flex-shrink:0;padding-top:.25rem;padding-bottom:.25rem;"
      >
        <span class="command-hint"><strong>[+]</strong><span>Adicionar item</span></span>
        <span class="command-hint"><strong>F6</strong><span>Produção</span></span>
        <span class="command-hint"><strong>F7</strong><span>Pré-conta</span></span>
      </div>
    </section>
  `;
}

function renderMesasView(state: ShellState): string {
  const mesaGroups = getMesaGroups(state);
  const selectedComanda = getSelectedComandaFromState(state) ?? mesaGroups[0]?.comandas[0] ?? null;
  const selectedMesaGroup = selectedComanda
    ? mesaGroups.find((group) => group.comandas.some((comanda) => comanda.comandaId === selectedComanda.comandaId)) ?? null
    : mesaGroups[0] ?? null;
  const mesaLabel = selectedMesaGroup?.mesaId ?? selectedComanda?.mesaId ?? (state.comandaWorkspace.mesaDraft || "Sem mesa vinculada");
  const totals = selectedComanda ? summarizeComanda(selectedComanda) : null;
  const nextAction = resolveMesaNextAction(selectedComanda);
  const setores = summarizeMesaSetores(selectedComanda);
  const totalDueAmountCents = mesaGroups.reduce((sum, group) => sum + group.dueAmountCents, 0);

  return `
    <section class="mesas-grid">
      <article class="hero-card hero-card--compact">
        <span class="hero-tagline">Sala</span>
        <h2 class="hero-card__title hero-card__title--compact">Mesas e comandas</h2>
        <p class="hero-card__body">Selecione a comanda certa da mesa e retome lançamento ou cobrança.</p>
        <div class="hero-card__actions">
          <button
            type="button"
            class="hero-button hero-button--compact"
            id="mesas-primary-action"
            data-action="select-mesa-comanda"
            data-comanda-id="${escapeHtml(selectedComanda?.comandaId ?? "")}"
            data-view-id="comandas"
            ${selectedComanda ? "" : "disabled"}
          >
            Retomar lançamento
          </button>
          <button
            type="button"
            class="secondary-button secondary-button--compact"
            data-action="select-mesa-comanda"
            data-comanda-id="${escapeHtml(selectedComanda?.comandaId ?? "")}"
            data-view-id="checkout"
            ${selectedComanda ? "" : "disabled"}
          >
            Ir para checkout
          </button>
        </div>
      </article>
      <article class="panel">
        <div class="kpi-grid">
          <div class="info-card">
            <span class="muted-text">Mesas em aberto</span>
            <strong class="info-card__value">${mesaGroups.length}</strong>
            <span class="muted-text">${state.comandaWorkspace.activeComandas.length} comandas ativas</span>
          </div>
          <div class="info-card">
            <span class="muted-text">Mesa em foco</span>
            <strong class="info-card__value">${escapeHtml(mesaLabel)}</strong>
            <span class="muted-text">${selectedComanda ? `Comanda ${escapeHtml(selectedComanda.numero)}` : "Selecione uma comanda para continuar"}</span>
          </div>
          <div class="info-card">
            <span class="muted-text">Saldo da sala</span>
            <strong class="info-card__value">${formatCurrency(totalDueAmountCents)}</strong>
            <span class="muted-text">${selectedComanda ? nextAction : "Nenhum atendimento ativo agora"}</span>
          </div>
        </div>
      </article>
      <article class="panel">
        <div class="section-head">
          <div>
            <p class="panel__eyebrow">Mapa de mesas</p>
            <h2 class="section-title section-title--compact">Agrupamento por mesa</h2>
          </div>
          <span class="surface-pill">${mesaGroups.length === 1 ? "1 mesa visível" : mesaGroups.length > 1 ? `${mesaGroups.length} mesas visíveis` : "sem mesas no turno"}</span>
        </div>
        ${mesaGroups.length > 0
          ? `
              <div class="mesa-map-grid">
                ${mesaGroups
                  .map((group) => renderMesaGroupCard(group, selectedComanda?.comandaId ?? null))
                  .join("")}
              </div>
            `
          : `<div class="empty-copy">Sem mesas ou comandas ativas neste terminal. Abra a próxima comanda e volte aqui para acompanhar a sala.</div>`}
      </article>
      <article class="panel">
        <div class="section-head">
          <div>
            <p class="panel__eyebrow">Mesa em foco</p>
            <h2 class="section-title section-title--compact">${escapeHtml(mesaLabel)}</h2>
          </div>
          <span class="surface-pill">${escapeHtml(setores)}</span>
        </div>
        ${selectedComanda
          ? `
              <div class="mesa-stage-grid">
                <div class="mesa-stage-card">
                  <span class="muted-text">Abertura</span>
                  <strong>${new Date(selectedComanda.openedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</strong>
                  <span class="muted-text">Comanda aberta e rastreada localmente</span>
                </div>
                <div class="mesa-stage-card">
                  <span class="muted-text">Produção</span>
                  <strong>${totals?.sentItems ?? 0} itens enviados</strong>
                  <span class="muted-text">${(selectedComanda.productionBatches.at(-1)?.setores ?? []).join(", ") || "Nenhum lote enviado ainda"}</span>
                </div>
                <div class="mesa-stage-card">
                  <span class="muted-text">Cobrança</span>
                  <strong>${formatCurrency(totals?.dueCents ?? 0)}</strong>
                  <span class="muted-text">${selectedComanda.status === "EM_PAGAMENTO" ? "Mesa pronta para conferência" : "Checkout ainda não iniciado"}</span>
                </div>
              </div>
            `
          : `<div class="empty-copy">Sem comanda selecionada. Use um card do mapa para escolher qual atendimento deve voltar ao foco.</div>`}
      </article>
    </section>
  `;
}

function renderWorkspaceHeaderMeta(state: ShellState): string {
  const session = state.session;

  if (!session) {
    return "";
  }

  return `
    <span class="surface-pill">${escapeHtml(session.operatorCode)}</span>
    <span class="surface-pill">${escapeHtml(session.role)}</span>
  `;
}

function resolveNavigationHint(viewId: MainViewId): string {
  switch (viewId) {
    case "comandas":
      return "Abrir e retomar";
    case "mesas":
      return "Ver a sala";
    case "catalogo":
      return "Buscar itens";
    case "producao":
      return "Enviar lotes";
    case "preconta":
      return "Conferir conta";
    case "checkout":
      return "Receber e fechar";
    case "caixa":
      return "Abrir e conferir";
    case "equipe":
      return "Colaboradores";
  }
}

function getCatalogCategories(state: ShellState): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const p of state.comandaWorkspace.catalogProducts) {
    if (!seen.has(p.category)) {
      seen.add(p.category);
      result.push(p.category);
    }
  }
  return result;
}

function renderCategoryTabs(state: ShellState): string {
  const categories = getCatalogCategories(state);
  const active = state.comandaWorkspace.selectedCatalogCategory ?? categories[0] ?? null;

  if (categories.length === 0) {
    return `<span class="muted-text" style="font-size:.8rem;">Nenhum produto cadastrado.</span>`;
  }

  return categories
    .map((cat) => {
      const isActive = cat === active;
      return `
        <button
          type="button"
          class="${isActive ? "hero-button hero-button--compact" : "secondary-button secondary-button--compact"}"
          data-action="select-catalog-category"
          data-category="${escapeHtml(cat)}"
          style="white-space:nowrap;"
        >${escapeHtml(cat)}</button>
      `;
    })
    .join("");
}

function renderProductQuickList(state: ShellState): string {
  const active = state.comandaWorkspace.selectedCatalogCategory ?? getCatalogCategories(state)[0] ?? null;
  const products = active
    ? state.comandaWorkspace.catalogProducts.filter((p) => p.category === active)
    : state.comandaWorkspace.catalogProducts;

  if (products.length === 0) {
    return `<div class="empty-copy" style="padding:.75rem;">Nenhum produto nesta categoria.</div>`;
  }

  return products
    .map((product) => `
      <div
        style="display:flex;align-items:center;gap:.5rem;padding:.45rem .6rem;border-bottom:1px solid var(--color-border,rgba(255,255,255,.08));"
        data-product-row="${escapeHtml(product.productId)}"
      >
        <span class="shortcut-pill" style="flex-shrink:0;">${escapeHtml(product.shortcutHint)}</span>
        <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(product.label)}</span>
        <span class="muted-text" style="flex-shrink:0;font-size:.8rem;">${escapeHtml(product.setor)}</span>
        <span style="flex-shrink:0;font-size:.85rem;color:var(--rayzen-colorAccentSoft,#f2bc67);white-space:nowrap;">${formatCurrency(product.unitPriceCents)}</span>
        <button
          type="button"
          class="hero-button hero-button--micro"
          data-action="add-product-quick"
          data-product-id="${escapeHtml(product.productId)}"
          style="flex-shrink:0;min-width:2rem;padding:.2rem .4rem;font-size:.9rem;"
          title="Adicionar ${escapeHtml(product.label)}"
        >+</button>
      </div>
    `)
    .join("");
}

function renderComandaCancelPanel(state: ShellState): string {
  const currentComanda = getSelectedComandaFromState(state);
  const selectedItem = currentComanda?.items.find((item) => item.itemId === state.comandaWorkspace.selectedItemId) ?? null;

  return `
    ${selectedItem
      ? `
          <div style="display:flex;align-items:baseline;justify-content:space-between;gap:.5rem;margin-bottom:.25rem;">
            <strong style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(selectedItem.productLabel)}</strong>
            <span style="flex-shrink:0;color:var(--rayzen-colorAccentSoft,#f2bc67);">${selectedItem.quantity}x · ${formatCurrency(Math.round(selectedItem.quantity * selectedItem.unitPriceCents))}</span>
          </div>
          <span class="muted-text" style="font-size:.8rem;display:block;margin-bottom:.5rem;">${escapeHtml(selectedItem.status)} · ${escapeHtml(selectedItem.setor)}</span>
        `
      : `<div class="empty-copy">Selecione um item na lista para habilitar o cancelamento.</div>`}
    <label class="field-block">
      <span class="field-label">Motivo</span>
      <input
        id="cancel-reason"
        value="${escapeHtml(state.comandaWorkspace.cancelReasonDraft)}"
        placeholder="Ex.: cliente desistiu"
      />
    </label>
    <button type="button" class="secondary-button secondary-button--danger secondary-button--compact" data-action="cancel-selected-item">Cancelar item</button>
  `;
}

function renderCatalogoView(state: ShellState): string {
  const filteredProducts = filterProducts(state);
  const draft = state.catalogDraft;
  const isNewMode = draft.mode === "new";
  const existingCategories = [...new Set(state.comandaWorkspace.catalogProducts.map((p) => p.category))];

  return `
    <section class="catalog-view-grid">
      <article class="hero-card">
        <span class="hero-tagline">Catalogo operacional</span>
        <h2 class="hero-card__title">${isNewMode ? "Novo produto" : "Busca e selecao"}</h2>
        <p class="hero-card__body">${isNewMode
          ? "Preencha os campos e salve. O produto estara disponivel imediatamente nas comandas."
          : "Busque por nome, setor ou atalho. ENTER lanca na comanda ativa."
        }</p>
        <div class="hero-card__actions">
          ${isNewMode
            ? `<button type="button" class="secondary-button secondary-button--compact" data-action="catalog-close-form">Cancelar</button>`
            : `<button type="button" class="hero-button hero-button--compact" data-action="catalog-open-form">+ Novo produto</button>`
          }
        </div>
      </article>

      ${isNewMode ? `
        <article class="panel" style="display:flex;flex-direction:column;gap:.75rem;padding:1rem;">
          <div class="field-block">
            <span class="field-label">Nome *</span>
            <input id="catalog-nome" type="text" placeholder="Ex: Cerveja Brahma 600ml" value="${escapeHtml(draft.nomeDraft)}" data-catalog-field="nomeDraft" />
          </div>
          <div class="field-block">
            <span class="field-label">Categoria *</span>
            <input id="catalog-categoria" type="text" placeholder="Ex: Bebidas" value="${escapeHtml(draft.categoriaDraft)}" list="catalog-categorias-list" data-catalog-field="categoriaDraft" />
            <datalist id="catalog-categorias-list">
              ${existingCategories.map((c) => `<option value="${escapeHtml(c)}">`).join("")}
            </datalist>
          </div>
          <div class="field-block">
            <span class="field-label">Setor *</span>
            <select id="catalog-setor" data-catalog-field="setorDraft">
              <option value="BAR"${draft.setorDraft === "BAR" ? " selected" : ""}>BAR</option>
              <option value="COZINHA"${draft.setorDraft === "COZINHA" ? " selected" : ""}>COZINHA</option>
              <option value="CAIXA"${draft.setorDraft === "CAIXA" ? " selected" : ""}>CAIXA</option>
            </select>
          </div>
          <div class="field-block">
            <span class="field-label">Preco (R$) *</span>
            <input id="catalog-preco" type="text" inputmode="decimal" placeholder="Ex: 12,00" value="${escapeHtml(draft.precoDraft)}" data-catalog-field="precoDraft" />
          </div>
          <div class="field-block">
            <span class="field-label">Atalho (opcional)</span>
            <input id="catalog-shortcut" type="text" placeholder="Ex: B3" maxlength="4" value="${escapeHtml(draft.shortcutHintDraft)}" data-catalog-field="shortcutHintDraft" style="width:6rem;" />
          </div>
          <button type="button" class="hero-button" data-action="catalog-save-product" style="margin-top:.25rem;">Salvar produto</button>
        </article>
      ` : `
        <article class="panel">
          <div class="workspace-search">
            <label class="sr-only" for="product-search">Busca de produto</label>
            <input
              id="product-search"
              type="search"
              placeholder="Filtre por nome, setor ou atalho"
              value="${escapeHtml(state.productSearch)}"
            />
          </div>
          <div class="catalog-list catalog-list--full" id="product-list" tabindex="-1">
            ${filteredProducts
              .map((product) => {
                const isSelected = product.productId === state.comandaWorkspace.selectedCatalogProductId;
                return `
                  <button
                    type="button"
                    class="catalog-card"
                    data-action="select-product"
                    data-product-id="${escapeHtml(product.productId)}"
                    aria-pressed="${isSelected ? "true" : "false"}"
                  >
                    <span class="shortcut-pill">${escapeHtml(product.shortcutHint)}</span>
                    <strong>${escapeHtml(product.label)}</strong>
                    <span class="muted-text">${escapeHtml(product.category)} · ${escapeHtml(product.setor)}</span>
                    <span class="catalog-card__price">${formatCurrency(product.unitPriceCents)}</span>
                  </button>
                `;
              })
              .join("")}
          </div>
          <div class="section-actions">
            <button type="button" class="hero-button" data-action="add-selected-product">Lancar item selecionado</button>
          </div>
        </article>
      `}
    </section>
  `;
}

function renderProducaoView(state: ShellState): string {
  const currentComanda = getSelectedComandaFromState(state);
  const pendingItems = currentComanda?.items.filter((item) => item.status === "LANCADO") ?? [];
  const sentItems = currentComanda?.items.filter((item) => item.status === "ENVIADO") ?? [];

  return `
    <section class="panel-stack">
      <article class="hero-card">
        <span class="hero-tagline">Envio por setor</span>
        <h2 class="hero-card__title">Producao sem perder o ritmo</h2>
        <p class="hero-card__body">Revise os itens pendentes e envie para cozinha e bar. F6 dispara o envio do lote atual.</p>
        <div class="hero-card__actions">
          <button type="button" class="hero-button" data-action="send-production">Enviar lote atual</button>
          <span class="shortcut-pill">F6</span>
        </div>
      </article>
      <article class="panel">
        <div class="kpi-grid">
          <div class="info-card">
            <span class="muted-text">Pendentes</span>
            <strong class="info-card__value">${pendingItems.length}</strong>
            <span class="muted-text">Itens ainda sem envio</span>
          </div>
          <div class="info-card">
            <span class="muted-text">Já enviados</span>
            <strong class="info-card__value">${sentItems.length}</strong>
            <span class="muted-text">Itens em producao</span>
          </div>
          <div class="info-card">
            <span class="muted-text">Setores</span>
            <strong class="info-card__value">${escapeHtml(joinSetores(currentComanda))}</strong>
            <span class="muted-text">Visão compacta por lote</span>
          </div>
        </div>
      </article>
      ${currentComanda ? renderItensTable(currentComanda, state.comandaWorkspace.selectedItemId) : `<article class="panel"><div class="empty-copy">Abra uma comanda para enviar o primeiro lote.</div></article>`}
    </section>
  `;
}

function renderPreContaView(state: ShellState): string {
  const currentComanda = getSelectedComandaFromState(state);
  const settlementComandas = getSettlementComandas(state);
  const snapshot = state.comandaWorkspace.lastPreContaSnapshot;

  return `
    <section class="panel-stack">
      <article class="hero-card hero-card--compact">
        <span class="hero-tagline">Pré-conta</span>
        <h2 class="hero-card__title hero-card__title--compact">Conferência antes do caixa</h2>
        <p class="hero-card__body">Gere a visão local da conta antes de cobrar.</p>
        <div class="hero-card__actions">
          <button type="button" class="hero-button hero-button--compact" data-action="generate-preconta">Gerar pré-conta</button>
          <button
            type="button"
            class="secondary-button secondary-button--compact"
            data-action="request-cash-checkout"
            ${currentComanda && currentComanda.status === "EM_PAGAMENTO" ? "" : "disabled"}
          >
            Encaminhar ao caixa
          </button>
          <button type="button" class="secondary-button secondary-button--compact" data-action="navigate" data-view-id="checkout">Ir para checkout</button>
          <button
            type="button"
            class="secondary-button secondary-button--compact"
            data-action="reopen-comanda"
            ${currentComanda && currentComanda.status === "EM_PAGAMENTO" ? "" : "disabled"}
          >
            Reabrir
          </button>
        </div>
      </article>
      ${renderComandaFocusPanel(state, {
        title: "Comanda em conferência",
        description: "Escolha explicitamente qual atendimento vai gerar ou revisar a pré-conta antes de seguir para cobrança.",
        emptyCopy: "Nenhuma comanda ativa para conferência neste terminal.",
        currentViewId: "preconta",
        actionLabel: "Retomar pré-conta",
        comandas: settlementComandas,
        selectedComanda: currentComanda
      })}
      <article class="panel">
        ${snapshot
          ? `
              <div class="section-head">
                <div>
                  <p class="panel__eyebrow">Snapshot ${snapshot.version}</p>
                  <h2 class="section-title section-title--compact">${formatCurrency(snapshot.totalAmountCents)}</h2>
                </div>
                <span class="surface-pill">${snapshot.itemCount} itens</span>
              </div>
              <div class="item-table">
                <div class="item-table__header">
                  <span>Item</span>
                  <span>Setor</span>
                  <span>Qtd</span>
                  <span>Total</span>
                </div>
                ${snapshot.items
                  .map((item) => {
                    return `
                      <div class="item-row">
                        <span>${escapeHtml(item.productLabel)}</span>
                        <span>${escapeHtml(item.setor)}</span>
                        <span>${item.quantity}</span>
                        <span>${formatCurrency(item.lineTotalCents)}</span>
                      </div>
                    `;
                  })
                  .join("")}
              </div>
            `
          : `<div class="empty-copy">Ainda nao ha snapshot de pré-conta. Use F7 ou o botao acima.</div>`}
      </article>
    </section>
  `;
}

function renderCheckoutView(state: ShellState): string {
  const currentComanda = getSelectedComandaFromState(state);
  const totals = currentComanda ? summarizeComanda(currentComanda) : null;
  const settlementComandas = getSettlementComandas(state);

  return `
    <section class="checkout-grid">
      <article class="hero-card hero-card--compact">
        <span class="hero-tagline">Checkout</span>
        <h2 class="hero-card__title hero-card__title--compact">Receber e fechar</h2>
        <p class="hero-card__body">Confirme a comanda, registre o valor e encerre.</p>
      </article>
      ${renderComandaFocusPanel(state, {
        title: "Comanda em cobrança",
        description: "Quando houver mais de uma comanda na mesma mesa, confirme aqui qual atendimento está em foco antes de registrar o pagamento.",
        emptyCopy: "Nenhuma comanda ativa para checkout neste terminal.",
        currentViewId: "checkout",
        actionLabel: "Trazer para checkout",
        comandas: settlementComandas,
        selectedComanda: currentComanda
      })}
      <article class="panel">
        <div class="kpi-grid">
          <div class="info-card">
            <span class="muted-text">Total da conta</span>
            <strong class="info-card__value">${formatCurrency(totals?.totalCents ?? 0)}</strong>
            <span class="muted-text">Conta atual</span>
          </div>
          <div class="info-card">
            <span class="muted-text">Pago</span>
            <strong class="info-card__value">${formatCurrency(totals?.paidCents ?? 0)}</strong>
            <span class="muted-text">Pagamentos confirmados</span>
          </div>
          <div class="info-card">
            <span class="muted-text">Em aberto</span>
            <strong class="info-card__value">${formatCurrency(totals?.dueCents ?? 0)}</strong>
            <span class="muted-text">Valor a receber</span>
          </div>
          <div class="info-card">
            <span class="muted-text">Fila do caixa</span>
            <strong class="info-card__value">${currentComanda?.cashCheckoutRequestedAt ? "Encaminhada" : "Consulta local"}</strong>
            <span class="muted-text">${currentComanda?.cashCheckoutRequestedAt ? `Desde ${new Date(currentComanda.cashCheckoutRequestedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "Fora da fila principal"}</span>
          </div>
        </div>
      </article>
      <article class="panel">
        <p class="panel__eyebrow">Forma de pagamento</p>
        <div class="method-grid">
          ${PAYMENT_METHODS
            .map((method) => {
              const isSelected = state.comandaWorkspace.checkoutMethodDraft === method;
              return `
                <button
                  type="button"
                  class="method-chip"
                  data-action="select-checkout-method"
                  data-method="${method}"
                  aria-pressed="${isSelected ? "true" : "false"}"
                >
                  ${formatMethod(method)}
                </button>
              `;
            })
            .join("")}
        </div>
        <div class="checkout-form">
          <label class="field-block">
            <span class="field-label">Valor</span>
            <input id="checkout-amount" value="${escapeHtml(state.comandaWorkspace.checkoutAmountDraft)}" placeholder="0,00" />
          </label>
          <div class="section-actions">
            <button type="button" class="secondary-button secondary-button--compact" data-action="fill-checkout-due">Valor exato</button>
            <button type="button" class="hero-button hero-button--compact" data-action="checkout-submit">Confirmar</button>
          </div>
        </div>
      </article>
      ${currentComanda ? `<article class="panel">${renderItensTable(currentComanda, state.comandaWorkspace.selectedItemId)}</article>` : ""}
    </section>
  `;
}

function renderCaixaView(state: ShellState): string {
  const currentSession = state.cashWorkspace.currentSession;
  const totals = currentSession ? summarizeCashSession(currentSession) : null;
  const queuedCashComandas = getSettlementComandas(state)
    .filter((comanda) => comanda.status === "EM_PAGAMENTO" && comanda.cashCheckoutRequestedAt);
  const consultableComandas = getSettlementComandas(state)
    .filter((comanda) => !comanda.cashCheckoutRequestedAt);
  const currentSessionStatusCopy = currentSession
    ? currentSession.status === "FECHAMENTO"
      ? "Conferência em andamento. Revise contado e justificativa antes de concluir."
      : currentSession.status === "FECHADO"
        ? "Sessão encerrada. Você pode exportar a auditoria ou abrir um novo turno."
        : "Sessão pronta para recebimentos, sangrias e suprimentos."
    : "Nenhuma sessão aberta neste terminal.";

  return `
    <section class="cash-console">
      <article class="panel panel--dense cash-console__top">
        <div class="cash-console__hero">
          <span class="hero-tagline">Controle auditável</span>
          <h2 class="hero-card__title cash-console__title">Caixa do turno</h2>
          <p class="hero-card__body">Escolha a comanda do cliente, registre movimentos e feche o turno com conferência local exportável.</p>
        </div>
        <div class="cash-console__session">
          <div class="section-head section-head--compact">
            <div>
              <p class="panel__eyebrow">Sessão atual</p>
              <h2 class="section-title section-title--compact">${currentSession ? formatCashStatus(currentSession.status) : "fechado"}</h2>
            </div>
            <button type="button" class="secondary-button secondary-button--compact" data-action="export-cash-audit">Auditoria</button>
          </div>
          ${currentSession
            ? `
                <div class="kpi-grid kpi-grid--compact">
                  <div class="info-card">
                    <span class="muted-text">Esperado</span>
                    <strong class="info-card__value">${formatCurrency(totals?.totalExpectedAmountCents ?? 0)}</strong>
                    <span class="muted-text">${totals?.movementCount ?? 0} movimentos</span>
                  </div>
                  <div class="info-card">
                    <span class="muted-text">Contado</span>
                    <strong class="info-card__value">${formatCurrency(totals?.totalCountedAmountCents ?? 0)}</strong>
                    <span class="muted-text">Fechamento local</span>
                  </div>
                  <div class="info-card">
                    <span class="muted-text">Diferença</span>
                    <strong class="info-card__value">${formatCurrency(totals?.totalDivergenceAmountCents ?? 0)}</strong>
                    <span class="muted-text">Sempre auditável</span>
                  </div>
                </div>
              `
            : `<div class="empty-copy">Abra o caixa para habilitar recebimentos, sangrias, suprimentos e conferência.</div>`}
          <div class="cash-status-banner">
            <strong>Status</strong>
            <span>${currentSessionStatusCopy}</span>
          </div>
        </div>
      </article>

      <div class="cash-console__selection">
        <article class="panel panel--dense">
          <div class="section-head section-head--compact">
            <div>
              <p class="panel__eyebrow">Fila principal</p>
              <h2 class="section-title section-title--compact">Comandas liberadas</h2>
            </div>
            <span class="surface-pill">${queuedCashComandas.length} na fila</span>
          </div>
          <p class="muted-text">O caixa escolhe manualmente a comanda conforme o cliente chega.</p>
          ${queuedCashComandas.length > 0
            ? `
                <div class="mesa-command-list">
                  ${queuedCashComandas
                    .map((comanda) => renderSettlementQueueButton(comanda, state.comandaWorkspace.selectedComandaId))
                    .join("")}
                </div>
              `
            : `<div class="empty-copy">Nenhuma comanda foi encaminhada ao caixa neste terminal.</div>`}
        </article>
        <article class="panel panel--dense">
          <div class="section-head section-head--compact">
            <div>
              <p class="panel__eyebrow">Consulta manual</p>
              <h2 class="section-title section-title--compact">Outras comandas</h2>
            </div>
            <span class="surface-pill">${consultableComandas.length} fora da fila</span>
          </div>
          <p class="muted-text">Use esta lista para conferir ou assumir manualmente um fechamento fora da fila.</p>
          ${consultableComandas.length > 0
            ? `
                <div class="mesa-command-list">
                  ${consultableComandas
                    .map((comanda) => renderManualCashConsultButton(comanda, state.comandaWorkspace.selectedComandaId))
                    .join("")}
                </div>
              `
            : `<div class="empty-copy">Todas as comandas ativas deste terminal já estão na fila principal do caixa.</div>`}
        </article>
      </div>

      <div class="cash-console__body">
        <article class="panel panel--dense cash-console__left">
          ${(!currentSession || currentSession.status === "FECHADO")
            ? `
                <div class="cash-console__form-block">
                  <div class="section-head section-head--compact">
                    <div>
                      <p class="panel__eyebrow">Abertura</p>
                      <h2 class="section-title section-title--compact">Início do turno</h2>
                    </div>
                  </div>
                  <div class="cash-form-grid cash-form-grid--opening">
                    <label class="field-block">
                      <span class="field-label">Fundo inicial</span>
                      <input id="cash-opening-fund" value="${escapeHtml(state.cashWorkspace.openingFundDraft)}" placeholder="0,00" />
                    </label>
                    <label class="field-block">
                      <span class="field-label">Observação</span>
                      <input id="cash-opening-reason" value="${escapeHtml(state.cashWorkspace.openingReasonDraft)}" placeholder="troco inicial do turno" />
                    </label>
                    <button type="button" class="hero-button hero-button--compact" data-action="open-cash-session">Abrir caixa</button>
                  </div>
                </div>
              `
            : ""}

          ${(currentSession && currentSession.status === "ABERTO")
            ? `
                <div class="cash-console__form-block">
                  <div class="section-head section-head--compact">
                    <div>
                      <p class="panel__eyebrow">Recebimento</p>
                      <h2 class="section-title section-title--compact">Por forma</h2>
                    </div>
                  </div>
                  <div class="method-grid">
                    ${PAYMENT_METHODS.map((method) => {
                      const isSelected = state.cashWorkspace.receiptMethodDraft === method;
                      return `
                        <button
                          type="button"
                          class="method-chip"
                          data-action="select-cash-method"
                          data-method="${method}"
                          aria-pressed="${isSelected ? "true" : "false"}"
                        >
                          ${formatMethod(method)}
                        </button>
                      `;
                    }).join("")}
                  </div>
                  <div class="cash-form-grid cash-form-grid--receipt">
                    <label class="field-block">
                      <span class="field-label">Valor</span>
                      <input id="cash-receipt-amount" value="${escapeHtml(state.cashWorkspace.receiptAmountDraft)}" placeholder="0,00" />
                    </label>
                    <label class="field-block">
                      <span class="field-label">Referência</span>
                      <input id="cash-receipt-reason" value="${escapeHtml(state.cashWorkspace.receiptReasonDraft)}" placeholder="checkout avulso, acerto local..." />
                    </label>
                    <button type="button" class="hero-button hero-button--compact" data-action="register-cash-receipt">Registrar</button>
                  </div>
                </div>

                <div class="cash-console__form-block">
                  <div class="section-head section-head--compact">
                    <div>
                      <p class="panel__eyebrow">Movimentos</p>
                      <h2 class="section-title section-title--compact">Sangria e suprimento</h2>
                    </div>
                  </div>
                  <button type="button" class="secondary-button secondary-button--compact" data-action="start-cash-closure">Iniciar fechamento</button>
                  <div class="cash-form-split">
              <div class="cash-form-stack">
                <label class="field-block">
                  <span class="field-label">Sangria</span>
                  <input id="cash-sangria-amount" value="${escapeHtml(state.cashWorkspace.sangriaAmountDraft)}" placeholder="0,00" />
                </label>
                <label class="field-block">
                  <span class="field-label">Motivo</span>
                  <input id="cash-sangria-reason" value="${escapeHtml(state.cashWorkspace.sangriaReasonDraft)}" placeholder="retirada de excesso do caixa" />
                </label>
                <button type="button" class="secondary-button secondary-button--danger secondary-button--compact" data-action="register-cash-withdrawal">Registrar sangria</button>
              </div>
              <div class="cash-form-stack">
                <label class="field-block">
                  <span class="field-label">Suprimento</span>
                  <input id="cash-suprimento-amount" value="${escapeHtml(state.cashWorkspace.suprimentoAmountDraft)}" placeholder="0,00" />
                </label>
                <label class="field-block">
                  <span class="field-label">Motivo</span>
                  <input id="cash-suprimento-reason" value="${escapeHtml(state.cashWorkspace.suprimentoReasonDraft)}" placeholder="reforço de troco" />
                </label>
                <button type="button" class="secondary-button secondary-button--compact" data-action="register-cash-supply">Registrar suprimento</button>
              </div>
            </div>
          </div>
              `
            : ""}
        </article>

        <aside class="cash-console__right">
          <article class="panel panel--dense">
            <div class="section-head section-head--compact">
              <div>
                <p class="panel__eyebrow">Fechamento</p>
                <h2 class="section-title section-title--compact">Conferência por forma</h2>
              </div>
              <button type="button" class="hero-button hero-button--compact" data-action="confirm-cash-closure">Concluir</button>
            </div>
            ${totals
              ? `
                  <div class="cash-closure-list">
                    ${totals.byMethod
                      .map((item) => {
                        const countedAmountCents = parseCashDraft(state.cashWorkspace.closureCountDrafts[item.method]);
                        const divergenceAmountCents = countedAmountCents - item.expectedAmountCents;

                        return `
                          <article class="cash-closure-card">
                            <div class="cash-closure-card__head">
                              <strong>${formatMethod(item.method)}</strong>
                              <span class="${divergenceAmountCents === 0 ? "muted-text" : "cash-method-card__alert"}">
                                ${divergenceAmountCents === 0 ? "Sem diferença" : formatCurrency(divergenceAmountCents)}
                              </span>
                            </div>
                            <div class="cash-closure-card__meta">
                              <span class="muted-text">Esperado ${formatCurrency(item.expectedAmountCents)}</span>
                              <label class="field-block">
                                <span class="field-label">Contado</span>
                                <input
                                  id="cash-count-${item.method}"
                                  value="${escapeHtml(state.cashWorkspace.closureCountDrafts[item.method] ?? "")}"
                                  placeholder="0,00"
                                />
                              </label>
                            </div>
                          </article>
                        `;
                      })
                      .join("")}
                  </div>
                  <div class="cash-method-overview cash-method-overview--compact">
                    ${totals.byMethod
                      .map((item) => {
                        const countedAmountCents = parseCashDraft(state.cashWorkspace.closureCountDrafts[item.method]);
                        const divergenceAmountCents = countedAmountCents - item.expectedAmountCents;

                        return `
                          <article class="cash-method-card">
                            <span class="muted-text">${formatMethod(item.method)}</span>
                            <strong>${formatCurrency(item.expectedAmountCents)}</strong>
                            <span class="muted-text">Contado ${formatCurrency(countedAmountCents)}</span>
                            <span class="${divergenceAmountCents === 0 ? "muted-text" : "cash-method-card__alert"}">
                              ${divergenceAmountCents === 0 ? "Sem divergência" : `Diferença ${formatCurrency(divergenceAmountCents)}`}
                            </span>
                          </article>
                        `;
                      })
                      .join("")}
                  </div>
                `
              : `<div class="empty-copy">Abra o caixa para habilitar a conferência.</div>`}
            <div class="cash-form-stack">
              <label class="field-block">
                <span class="field-label">Observação</span>
                <input id="cash-closure-note" value="${escapeHtml(state.cashWorkspace.closureNoteDraft)}" placeholder="fechamento do turno da noite" />
              </label>
              <label class="field-block">
                <span class="field-label">Justificativa</span>
                <input id="cash-divergence-reason" value="${escapeHtml(state.cashWorkspace.divergenceReasonDraft)}" placeholder="obrigatória quando houver diferença" />
              </label>
            </div>
          </article>

          <article class="panel panel--dense">
            <p class="panel__eyebrow">Auditoria exportável</p>
            ${state.cashWorkspace.auditExport
              ? `<pre class="audit-export-pre">${escapeHtml(JSON.stringify(state.cashWorkspace.auditExport, null, 2))}</pre>`
              : `<div class="empty-copy">Use o botão de auditoria para preparar o bundle local do caixa.</div>`}
          </article>
        </aside>
      </div>
    </section>
  `;
}

function renderItensTable(comanda: ComandaAggregate, selectedItemId: string | null): string {
  const activeItems = comanda.items.filter((item) => item.status !== "CANCELADO");
  const sentItems = comanda.items.filter((item) => item.status === "ENVIADO").length;
  const totalCents = activeItems.reduce((sum, item) => sum + Math.round(item.quantity * item.unitPriceCents), 0);

  return `
    <div class="item-table-shell">
      <div class="item-table__summary">
        <span class="surface-pill">${activeItems.length} itens ativos</span>
        <span class="surface-pill">${sentItems} enviados</span>
        <span class="surface-pill">Comanda ${escapeHtml(comanda.numero)}</span>
        <span class="surface-pill">Total ${formatCurrency(totalCents)}</span>
      </div>
      <div class="item-table">
        <div class="item-table__header">
          <span>Produto</span>
          <span>Status</span>
          <span>Qtd</span>
          <span>Total</span>
        </div>
        ${comanda.items
          .map((item) => {
            return renderItemRow(item, item.itemId === selectedItemId, item.itemId === selectedItemId);
          })
          .join("")}
      </div>
    </div>
  `;
}

function renderItemRow(item: ComandaItem, isSelected: boolean, isRecent: boolean = false): string {
  return `
    <button
      type="button"
      class="item-row item-row--button${isRecent ? " pedido-item--recent" : ""}"
      data-action="select-item"
      data-item-id="${escapeHtml(item.itemId)}"
      aria-pressed="${isSelected ? "true" : "false"}"
    >
      <span class="item-row__product">
        <strong>${escapeHtml(item.productLabel)}</strong>
        <small class="muted-text">${escapeHtml(item.note ?? "sem observação")}</small>
      </span>
      <span class="item-row__flow">
        <span class="status-badge status-badge--${item.status.toLowerCase()}">${escapeHtml(item.status)}</span>
        <small class="muted-text">${escapeHtml(item.setor)}</small>
      </span>
      <span class="item-row__qty">${item.quantity}x</span>
      <span class="item-row__total">${formatCurrency(Math.round(item.quantity * item.unitPriceCents))}</span>
    </button>
  `;
}

function renderAuditTrail(state: ShellState): string {
  const auditTrail = state.currentViewId === "caixa"
    ? [...state.cashWorkspace.auditTrail].reverse().slice(0, 6)
    : [...state.comandaWorkspace.auditTrail].reverse().slice(0, 6);

  if (auditTrail.length === 0) {
    return `<div class="empty-copy">A trilha local aparece aqui assim que o fluxo atual gerar eventos auditaveis.</div>`;
  }

  return `
    <div class="audit-list">
      ${auditTrail
        .map((event) => {
          return `
            <article class="audit-card">
              <span class="shortcut-pill">${escapeHtml(event.entity)}</span>
              <strong>${escapeHtml(event.action)}</strong>
              <span class="muted-text">${escapeHtml(new Date(event.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }))}</span>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderFeedback(state: ShellState): string {
  if (!state.feedbackMessage) {
    return "";
  }

  return `
    <div class="feedback-banner" data-tone="${state.feedbackTone}">
      <span>${escapeHtml(state.feedbackMessage)}</span>
      <button type="button" data-action="dismiss-feedback" aria-label="Fechar aviso">Fechar</button>
    </div>
  `;
}

function renderStatusChip(label: string, value: string, tone: "default" | "ok" | "warn"): string {
  const toneClass = tone === "default" ? "" : ` status-chip--${tone}`;

  return `
    <span class="status-chip${toneClass}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </span>
  `;
}

function summarizeComanda(comanda: ComandaAggregate) {
  const activeItems = comanda.items.filter((item) => item.status !== "CANCELADO");
  const totalCents = activeItems.reduce((sum, item) => sum + Math.round(item.quantity * item.unitPriceCents), 0);
  const paidCents = comanda.payments.reduce((sum, payment) => sum + payment.amountCents, 0);

  return {
    totalCents,
    paidCents,
    dueCents: Math.max(0, totalCents - paidCents),
    activeItems: activeItems.length,
    sentItems: comanda.items.filter((item) => item.status === "ENVIADO").length
  };
}

function summarizeCashSession(session: CashSessionAggregate) {
  return calculateCashSessionTotals(session);
}

function renderCashSummary(currentSession: CashSessionAggregate | null, totals: ReturnType<typeof summarizeCashSession> | null): string {
  if (!currentSession || !totals) {
    return `<div class="empty-copy">Abra o caixa para acompanhar esperado, contado e divergencia por forma.</div>`;
  }

  const openedAtFormatted = new Date(currentSession.openedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const showDivergence = currentSession.status === "FECHAMENTO" || currentSession.status === "FECHADO";

  return `
    <div class="summary-stack">
      <div class="info-card">
        <span class="muted-text">Turno aberto</span>
        <strong class="info-card__value">${openedAtFormatted}</strong>
        <span class="muted-text">${escapeHtml(formatCashStatus(currentSession.status))}</span>
      </div>
      <div class="info-card">
        <span class="muted-text">Esperado</span>
        <strong class="info-card__value">${formatCurrency(totals.totalExpectedAmountCents)}</strong>
        <span class="muted-text">${totals.movementCount} movimentos</span>
      </div>
      ${showDivergence
        ? `
            <div class="info-card">
              <span class="muted-text">Divergência</span>
              <strong class="info-card__value">${formatCurrency(totals.totalDivergenceAmountCents)}</strong>
              <span class="muted-text">${currentSession.closedAt ? "fechamento concluído" : "aguardando conferência"}</span>
            </div>
          `
        : ""}
    </div>
  `;
}

function filterProducts(state: ShellState) {
  const normalized = state.productSearch.trim().toLowerCase();

  return state.comandaWorkspace.catalogProducts.filter((product) => {
    if (!normalized) {
      return true;
    }

    return (
      product.label.toLowerCase().includes(normalized) ||
      product.setor.toLowerCase().includes(normalized) ||
      product.shortcutHint.toLowerCase().includes(normalized)
    );
  });
}

function joinSetores(comanda: ComandaAggregate | null): string {
  if (!comanda) {
    return "sem lote";
  }

  const setores = [...new Set(comanda.items.map((item) => item.setor))];
  return setores.length > 0 ? setores.join(", ") : "sem lote";
}

function parseCashDraft(value: string | undefined): number {
  const normalized = (value ?? "").replace(/\./g, "").replace(",", ".").trim();

  if (!normalized) {
    return 0;
  }

  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function syncInputValue(input: HTMLInputElement | null, value: string): void {
  if (!input) {
    return;
  }

  if (document.activeElement === input) {
    return;
  }

  if (input.value !== value) {
    input.value = value;
  }
}

function reconcilePedidoList(
  container: HTMLElement,
  items: ReadonlyArray<ComandaItem>,
  selectedItemId: string | null
): void {
  const focusState = captureReconciliationFocus(container, "id");

  if (items.length === 0) {
    if (container.childElementCount !== 1 || !container.querySelector(".empty-copy")) {
      container.replaceChildren(createElementFromHtml<HTMLDivElement>(`<div class="empty-copy">Nenhum item no pedido atual.</div>`));
    }
    return;
  }

  const emptyState = container.querySelector(".empty-copy");

  if (emptyState) {
    emptyState.remove();
  }

  const existingById = new Map<string, HTMLButtonElement>();

  for (const element of container.querySelectorAll<HTMLButtonElement>("[data-id]")) {
    if (element.dataset["id"]) {
      existingById.set(element.dataset["id"]!, element);
    }
  }

  let cursor: ChildNode | null = container.firstChild;

  for (const item of items) {
    const isSelected = item.itemId === selectedItemId;
    let element = existingById.get(item.itemId);

    if (!element) {
      element = createElementFromHtml<HTMLButtonElement>(renderPedidoItem(item, isSelected));
    } else {
      existingById.delete(item.itemId);
      updatePedidoItemElement(element, item, isSelected);
    }

    if (element !== cursor) {
      container.insertBefore(element, cursor);
    } else {
      cursor = cursor?.nextSibling ?? null;
    }

    if (element === cursor) {
      cursor = element.nextSibling;
    }
  }

  for (const staleElement of existingById.values()) {
    staleElement.remove();
  }

  restoreReconciliationFocus(container, "id", focusState, selectedItemId);
}

function captureReconciliationFocus(
  container: HTMLElement,
  datasetKey: "productId" | "id"
): { wasInside: boolean; focusedId: string | null } {
  const activeElement = document.activeElement;

  if (!(activeElement instanceof HTMLElement) || !container.contains(activeElement)) {
    return { wasInside: false, focusedId: null };
  }

  const focusedId = activeElement.dataset[datasetKey]
    ?? activeElement.closest<HTMLElement>(`[data-${datasetKey === "productId" ? "product-id" : "id"}]`)?.dataset[datasetKey]
    ?? null;

  return { wasInside: true, focusedId };
}

function restoreReconciliationFocus(
  container: HTMLElement,
  datasetKey: "productId" | "id",
  focusState: { wasInside: boolean; focusedId: string | null },
  fallbackId: string | null
): void {
  if (!focusState.wasInside) {
    return;
  }

  const nextId = focusState.focusedId ?? fallbackId;

  if (!nextId) {
    return;
  }

  const selector = `[data-${datasetKey === "productId" ? "product-id" : "id"}="${escapeAttribute(nextId)}"]`;
  const element = container.querySelector<HTMLElement>(selector);

  if (element) {
    element.focus();
  }
}

function updatePedidoItemElement(element: HTMLButtonElement, item: ComandaItem, isSelected: boolean): void {
  const renderKey = getPedidoItemRenderKey(item, isSelected);

  if (element.dataset["renderKey"] === renderKey) {
    return;
  }

  element.dataset["renderKey"] = renderKey;
  element.dataset["itemId"] = item.itemId;
  element.dataset["id"] = item.itemId;
  element.classList.toggle("pedido-item--recent", isSelected);
  element.setAttribute("aria-pressed", isSelected ? "true" : "false");

  const title = element.querySelector<HTMLElement>(".pedido-item__main strong");
  const note = element.querySelector<HTMLElement>(".pedido-item__main .muted-text");
  const quantity = element.querySelector<HTMLElement>(".pedido-item__meta strong");
  const total = element.querySelector<HTMLElement>(".pedido-item__meta small");

  syncTextContent(title, item.productLabel);
  syncTextContent(note, item.note ?? item.setor);
  syncTextContent(quantity, `${item.quantity}x`);
  syncTextContent(total, formatCurrency(Math.round(item.quantity * item.unitPriceCents)));
}

function getPedidoItemRenderKey(item: ComandaItem, isSelected: boolean): string {
  return [
    item.itemId,
    item.productLabel,
    item.note ?? "",
    item.setor,
    item.quantity,
    item.unitPriceCents,
    isSelected ? "1" : "0"
  ].join("|");
}

function syncTextContent(element: HTMLElement | null, nextValue: string): void {
  if (element && element.textContent !== nextValue) {
    element.textContent = nextValue;
  }
}

function createElementFromHtml<T extends Element>(markup: string): T {
  const template = document.createElement("template");
  template.innerHTML = markup.trim();
  return template.content.firstElementChild as T;
}

function getMesaGroups(state: ShellState) {
  const snapshotGroups = state.comandaWorkspace.mesaGroups;

  if (Array.isArray(snapshotGroups) && snapshotGroups.length > 0) {
    return snapshotGroups;
  }

  const currentComanda = getSelectedComandaFromState(state);

  if (!currentComanda) {
    return [];
  }

  const totals = summarizeComanda(currentComanda);

  return [
    {
      mesaId: currentComanda.mesaId,
      comandas: [currentComanda],
      comandaCount: 1,
      itemCount: totals.activeItems,
      totalAmountCents: totals.totalCents,
      paidAmountCents: totals.paidCents,
      dueAmountCents: totals.dueCents,
      statuses: [currentComanda.status]
    }
  ];
}

function getSelectedComandaFromState(state: ShellState) {
  const { selectedComandaId, activeComandas } = state.comandaWorkspace;
  return activeComandas.find((item) => item.comandaId === selectedComandaId) ?? null;
}

function getSettlementComandas(state: ShellState) {
  return [...state.comandaWorkspace.activeComandas]
    .filter((comanda) => comanda.status !== "ENCERRADA" && comanda.status !== "CANCELADA")
    .sort((left, right) => {
      if (left.comandaId === state.comandaWorkspace.selectedComandaId) {
        return -1;
      }

      if (right.comandaId === state.comandaWorkspace.selectedComandaId) {
        return 1;
      }

      const leftMesa = left.mesaId ?? "ZZZ";
      const rightMesa = right.mesaId ?? "ZZZ";
      return leftMesa.localeCompare(rightMesa, "pt-BR") || left.numero.localeCompare(right.numero, "pt-BR");
    });
}

function renderComandaFocusPanel(
  state: ShellState,
  options: {
    title: string;
    description: string;
    emptyCopy: string;
    currentViewId: "preconta" | "checkout";
    actionLabel: string;
    comandas: ComandaAggregate[];
    selectedComanda: ComandaAggregate | null;
  }
): string {
  const { title, description, emptyCopy, currentViewId, actionLabel, comandas, selectedComanda } = options;
  const totals = selectedComanda ? summarizeComanda(selectedComanda) : null;

  return `
    <article class="panel">
      <div class="section-head">
        <div>
          <p class="panel__eyebrow">${title}</p>
          <h2 class="section-title">${selectedComanda ? `Comanda ${escapeHtml(selectedComanda.numero)}` : "Nenhuma comanda selecionada"}</h2>
        </div>
        <span class="surface-pill">${selectedComanda ? escapeHtml(selectedComanda.status) : "sem foco"}</span>
      </div>
      <p class="muted-text">${description}</p>
      ${selectedComanda
        ? `
            <div class="kpi-grid">
              <div class="info-card">
                <span class="muted-text">Mesa</span>
                <strong class="info-card__value">${escapeHtml(selectedComanda.mesaId ?? "Sem mesa")}</strong>
                <span class="muted-text">${joinSetores(selectedComanda)}</span>
              </div>
              <div class="info-card">
                <span class="muted-text">Em aberto</span>
                <strong class="info-card__value">${formatCurrency(totals?.dueCents ?? 0)}</strong>
                <span class="muted-text">${totals?.activeItems ?? 0} itens ativos</span>
              </div>
              <div class="info-card">
                <span class="muted-text">Próxima ação</span>
                <strong class="info-card__value">${escapeHtml(resolveMesaNextAction(selectedComanda))}</strong>
                <span class="muted-text">Troque o foco abaixo se a mesa tiver mais de uma comanda</span>
              </div>
            </div>
          `
        : `<div class="empty-copy">${emptyCopy}</div>`}
      ${comandas.length > 0
        ? `
            <div class="section-head">
              <div>
                <p class="panel__eyebrow">Retomada rápida</p>
                <h3 class="section-title">${actionLabel}</h3>
              </div>
              <span class="surface-pill">${comandas.length} comandas visíveis</span>
            </div>
            <div class="mesa-command-list">
              ${comandas
                .map((comanda) => renderSettlementComandaRow(comanda, state.comandaWorkspace.selectedComandaId, currentViewId))
                .join("")}
            </div>
          `
        : ""}
    </article>
  `;
}

function renderPedidoPanel(
  comanda: ComandaAggregate,
  totals: ReturnType<typeof summarizeComanda>,
  selectedItemId: string | null
): string {
  const activeItems = comanda.items.filter((item) => item.status !== "CANCELADO").length;

  return `
    <div class="pedido-panel">
      <div class="pedido-header">
        <div class="pedido-header__copy">
          <span class="panel__eyebrow">Em foco</span>
          <strong class="info-card__value" id="pedido-title">Comanda ${escapeHtml(comanda.numero)}</strong>
          <div class="muted-text" id="pedido-meta">${escapeHtml(comanda.mesaId ?? "Sem mesa")} · ${escapeHtml(comanda.status)}</div>
        </div>
        <span class="surface-pill" id="pedido-count">${activeItems} itens</span>
      </div>
      <div class="pedido-summary-line">
        <span>${escapeHtml(comanda.mesaId ?? "Sem mesa")}</span>
        <span>${escapeHtml(comanda.status)}</span>
        <span>Em aberto ${formatCurrency(totals.dueCents)}</span>
      </div>
      <div class="pedido-list" id="pedido-list" aria-label="Itens do pedido">${renderPedidoList(comanda, selectedItemId)}</div>
      <div class="pedido-footer" id="pedido-footer">
        <div class="pedido-total">
          <span class="muted-text">Total</span>
          <strong id="pedido-total-value">${formatCurrency(totals.totalCents)}</strong>
          <span class="muted-text" id="pedido-total-due">Em aberto ${formatCurrency(totals.dueCents)}</span>
        </div>
        <button type="button" class="hero-button btn-finalizar" data-action="generate-preconta">Finalizar</button>
      </div>
    </div>
  `;
}

function renderPedidoList(comanda: ComandaAggregate, selectedItemId: string | null): string {
  const visibleItems = [...comanda.items].filter((item) => item.status !== "CANCELADO");

  return visibleItems.length > 0
    ? visibleItems
      .map((item) => renderPedidoItem(item, item.itemId === selectedItemId))
      .join("")
    : `<div class="empty-copy">Nenhum item no pedido atual.</div>`;
}

function renderPedidoItem(item: ComandaItem, isRecent: boolean): string {
  return `
    <button
      type="button"
      class="pedido-item${isRecent ? " pedido-item--recent" : ""}"
      data-action="select-item"
      data-item-id="${escapeHtml(item.itemId)}"
      data-id="${escapeHtml(item.itemId)}"
      aria-pressed="${isRecent ? "true" : "false"}"
      data-render-key="${escapeHtml(getPedidoItemRenderKey(item, isRecent))}"
    >
      <span class="pedido-item__main">
        <strong>${escapeHtml(item.productLabel)}</strong>
        <small class="muted-text">${escapeHtml(item.note ?? item.setor)}</small>
      </span>
      <span class="pedido-item__meta">
        <strong>${item.quantity}x</strong>
        <small>${formatCurrency(Math.round(item.quantity * item.unitPriceCents))}</small>
      </span>
    </button>
  `;
}

function renderMesaGroupCard(
  group: {
    mesaId: string | null;
    comandas: ComandaAggregate[];
    comandaCount: number;
    itemCount: number;
    dueAmountCents: number;
    statuses: ComandaAggregate["status"][];
  },
  selectedComandaId: string | null
): string {
  const hasSelectedComanda = group.comandas.some((comanda) => comanda.comandaId === selectedComandaId);

  return `
    <article class="mesa-map-card${hasSelectedComanda ? " mesa-map-card--selected" : ""}">
      <div class="section-head">
        <div>
          <p class="panel__eyebrow">Mesa</p>
          <h3 class="section-title">${escapeHtml(group.mesaId ?? "Sem mesa")}</h3>
        </div>
        <span class="surface-pill">${group.comandaCount} comandas</span>
      </div>
      <div class="summary-stack">
        <div class="info-card">
          <span class="muted-text">Em aberto</span>
          <strong>${formatCurrency(group.dueAmountCents)}</strong>
          <span class="muted-text">${group.itemCount} itens ativos</span>
        </div>
        <div class="info-card">
          <span class="muted-text">Status do grupo</span>
          <strong>${escapeHtml(group.statuses.join(" / "))}</strong>
          <span class="muted-text">${group.comandaCount > 1 ? "Mesa com atendimento paralelo" : "Atendimento único nesta mesa"}</span>
        </div>
      </div>
      <div class="mesa-comanda-list">
        ${group.comandas
          .map((comanda) => renderMesaComandaButton(comanda, selectedComandaId))
          .join("")}
      </div>
    </article>
  `;
}

function renderMesaComandaButton(comanda: ComandaAggregate, selectedComandaId: string | null): string {
  const totals = summarizeComanda(comanda);
  const isSelected = comanda.comandaId === selectedComandaId;

  return `
    <button
      type="button"
      class="mesa-comanda-button${isSelected ? " mesa-comanda-button--selected" : ""}"
      data-action="select-mesa-comanda"
      data-comanda-id="${escapeHtml(comanda.comandaId)}"
      aria-pressed="${isSelected ? "true" : "false"}"
    >
      <span>
        <strong>Comanda ${escapeHtml(comanda.numero)}</strong>
        <small class="muted-text">${escapeHtml(comanda.status)}</small>
      </span>
      <span>
        <strong>${formatCurrency(totals.dueCents)}</strong>
        <small class="muted-text">${totals.activeItems} itens</small>
      </span>
    </button>
  `;
}


function renderSettlementComandaRow(
  comanda: ComandaAggregate,
  selectedComandaId: string | null,
  targetViewId: "preconta" | "checkout"
): string {
  const totals = summarizeComanda(comanda);
  const isSelected = comanda.comandaId === selectedComandaId;

  return `
    <button
      type="button"
      class="mesa-command-row${isSelected ? " mesa-command-row--selected" : ""}"
      data-action="select-mesa-comanda"
      data-comanda-id="${escapeHtml(comanda.comandaId)}"
      data-view-id="${targetViewId}"
      aria-pressed="${isSelected ? "true" : "false"}"
    >
      <span><strong>Comanda ${escapeHtml(comanda.numero)}</strong></span>
      <span>${escapeHtml(comanda.mesaId ?? "Sem mesa")}</span>
      <span>${escapeHtml(comanda.status)}</span>
      <span>${formatCurrency(totals.dueCents)}</span>
    </button>
  `;
}

function renderSettlementQueueButton(comanda: ComandaAggregate, selectedComandaId: string | null): string {
  const totals = summarizeComanda(comanda);
  const isSelected = comanda.comandaId === selectedComandaId;

  return `
    <button
      type="button"
      class="mesa-command-row${isSelected ? " mesa-command-row--selected" : ""}"
      data-action="select-mesa-comanda"
      data-comanda-id="${escapeHtml(comanda.comandaId)}"
      data-view-id="checkout"
      aria-pressed="${isSelected ? "true" : "false"}"
    >
      <span><strong>Comanda ${escapeHtml(comanda.numero)}</strong></span>
      <span>${escapeHtml(comanda.mesaId ?? "Sem mesa")}</span>
      <span>${escapeHtml(comanda.status)}</span>
      <span>Ir para checkout · ${formatCurrency(totals.dueCents)}</span>
    </button>
  `;
}

function renderManualCashConsultButton(comanda: ComandaAggregate, selectedComandaId: string | null): string {
  const nextViewId = comanda.status === "EM_PAGAMENTO" ? "checkout" : comanda.status === "EM_PRODUCAO" ? "preconta" : "comandas";
  const totals = summarizeComanda(comanda);
  const isSelected = comanda.comandaId === selectedComandaId;

  return `
    <button
      type="button"
      class="mesa-command-row${isSelected ? " mesa-command-row--selected" : ""}"
      data-action="select-mesa-comanda"
      data-comanda-id="${escapeHtml(comanda.comandaId)}"
      data-view-id="${nextViewId}"
      aria-pressed="${isSelected ? "true" : "false"}"
    >
      <span><strong>Comanda ${escapeHtml(comanda.numero)}</strong></span>
      <span>${escapeHtml(comanda.mesaId ?? "Sem mesa")}</span>
      <span>${escapeHtml(comanda.status)}</span>
      <span>${nextViewId === "checkout" ? "Fechar no caixa" : nextViewId === "preconta" ? "Abrir pré-conta" : "Consultar comanda"} · ${formatCurrency(totals.dueCents)}</span>
    </button>
  `;
}

function renderEquipeView(state: ShellState): string {
  const { teamWorkspace } = state;
  const { operators, selectedOperatorId, nomeDraft, codeDraft, pinDraft, roleDraft, submitting, formMode } = teamWorkspace;

  const roleLabel = (role: string) => {
    switch (role) {
      case "GERENTE": return "Gerente";
      case "CAIXA": return "Caixa";
      default: return "Garcom";
    }
  };

  const operatorRows = operators.length === 0
    ? `<tr><td colspan="3" style="padding:12px;text-align:center;color:var(--color-text-muted)">Nenhum colaborador cadastrado</td></tr>`
    : operators.map((op) => {
        const isSelected = op.operatorId === selectedOperatorId;
        return `
          <tr
            class="equipe-row${isSelected ? " equipe-row--selected" : ""}"
            data-action="equipe-select-operator"
            data-operator-id="${escapeHtml(op.operatorId)}"
            style="cursor:pointer;"
          >
            <td style="padding:8px 12px;font-weight:500;">${escapeHtml(op.nome)}</td>
            <td style="padding:8px 12px;color:var(--color-text-muted);font-size:0.85rem;">${escapeHtml(op.operatorCode)}</td>
            <td style="padding:8px 12px;">${escapeHtml(roleLabel(op.role))}</td>
          </tr>
        `;
      }).join("");

  return `
    <div style="display:grid;grid-template-columns:1fr 320px;gap:16px;height:100%;overflow:hidden;">

      <!-- LISTA DE COLABORADORES -->
      <div style="display:flex;flex-direction:column;gap:10px;overflow:hidden;">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
          <h3 style="margin:0;font-size:1rem;">Colaboradores ativos</h3>
          <button
            type="button"
            class="btn btn--sm"
            data-action="equipe-new-operator"
          >Novo colaborador</button>
        </div>
        <div style="overflow-y:auto;flex:1;border:1px solid var(--color-border);border-radius:6px;">
          <table style="width:100%;border-collapse:collapse;">
            <thead style="background:var(--color-surface-alt);position:sticky;top:0;">
              <tr>
                <th style="padding:8px 12px;text-align:left;font-size:0.8rem;font-weight:600;color:var(--color-text-muted);">NOME</th>
                <th style="padding:8px 12px;text-align:left;font-size:0.8rem;font-weight:600;color:var(--color-text-muted);">CODIGO</th>
                <th style="padding:8px 12px;text-align:left;font-size:0.8rem;font-weight:600;color:var(--color-text-muted);">CARGO</th>
              </tr>
            </thead>
            <tbody>${operatorRows}</tbody>
          </table>
        </div>
      </div>

      <!-- FORMULARIO -->
      <div style="display:flex;flex-direction:column;gap:12px;overflow-y:auto;border:1px solid var(--color-border);border-radius:6px;padding:16px;">
        <h4 style="margin:0;font-size:0.95rem;">${formMode === "edit" ? "Editar colaborador" : "Novo colaborador"}</h4>

        <div style="display:flex;flex-direction:column;gap:4px;">
          <label style="font-size:0.8rem;font-weight:600;color:var(--color-text-muted);" for="equipe-operator-nome">NOME</label>
          <input
            id="equipe-operator-nome"
            type="text"
            value="${escapeHtml(nomeDraft)}"
            placeholder="Ex: Maria Silva"
            autocomplete="off"
          />
        </div>

        <div style="display:flex;flex-direction:column;gap:4px;">
          <label style="font-size:0.8rem;font-weight:600;color:var(--color-text-muted);" for="equipe-operator-code">CODIGO</label>
          <input
            id="equipe-operator-code"
            type="text"
            value="${escapeHtml(codeDraft)}"
            placeholder="Ex: MARIA ou G01"
            autocomplete="off"
          />
        </div>

        <div style="display:flex;flex-direction:column;gap:4px;">
          <label style="font-size:0.8rem;font-weight:600;color:var(--color-text-muted);" for="equipe-operator-pin">PIN (4-6 digitos)</label>
          <input
            id="equipe-operator-pin"
            type="password"
            value="${escapeHtml(pinDraft)}"
            placeholder="${formMode === "edit" ? "Deixe em branco para manter o atual" : "4 a 6 digitos"}"
            maxlength="6"
            autocomplete="new-password"
          />
        </div>

        <div style="display:flex;flex-direction:column;gap:4px;">
          <label style="font-size:0.8rem;font-weight:600;color:var(--color-text-muted);">CARGO</label>
          <div style="display:flex;gap:8px;">
            ${(["GARCOM", "CAIXA", "GERENTE"] as const).map((role) => `
              <button
                type="button"
                class="btn btn--sm${roleDraft === role ? " btn--active" : ""}"
                data-action="equipe-select-role"
                data-role="${role}"
              >${escapeHtml(roleLabel(role))}</button>
            `).join("")}
          </div>
        </div>

        <button
          type="button"
          class="btn btn--primary"
          data-action="equipe-save-operator"
          ${submitting ? "disabled" : ""}
          style="margin-top:4px;"
        >${submitting ? "Salvando..." : formMode === "edit" ? "Salvar alteracoes" : "Criar colaborador"}</button>

        ${formMode === "edit" && selectedOperatorId ? `
          <button
            type="button"
            class="btn btn--destructive btn--sm"
            data-action="equipe-deactivate-operator"
            data-operator-id="${escapeHtml(selectedOperatorId)}"
          >Desativar colaborador</button>
        ` : ""}
      </div>
    </div>
  `;
}

function resolveMesaNextAction(comanda: ComandaAggregate | null): string {
  if (!comanda) {
    return "Abra uma nova comanda para ocupar a próxima mesa.";
  }

  switch (comanda.status) {
    case "ABERTA":
      return "Lance itens ou envie o lote atual para produção.";
    case "EM_PRODUCAO":
      return "Acompanhe o preparo e gere a pré-conta quando a mesa pedir.";
    case "EM_PAGAMENTO":
      return "Conferir total e seguir para checkout.";
    case "ENCERRADA":
      return "Atendimento concluído. A mesa pode ser liberada.";
    case "CANCELADA":
      return "Comanda cancelada. Revise a trilha antes de reutilizar a mesa.";
  }
}

function summarizeMesaSetores(comanda: ComandaAggregate | null): string {
  if (!comanda || comanda.items.length === 0) {
    return "Sem setores ativos";
  }

  const setores = [...new Set(comanda.items
    .filter((item) => item.status !== "CANCELADO")
    .map((item) => item.setor))];

  return setores.length > 0 ? setores.join(" · ") : "Sem setores ativos";
}

function formatMethod(method: string): string {
  switch (method) {
    case "DINHEIRO":
      return "Dinheiro";
    case "PIX":
      return "PIX";
    case "CARTAO_CREDITO":
      return "Cartao credito";
    case "CARTAO_DEBITO":
      return "Cartao debito";
    default:
      return "Outro";
  }
}

function formatComandaStatus(status: ComandaAggregate["status"]): string {
  switch (status) {
    case "ABERTA":
      return "aberta";
    case "EM_PRODUCAO":
      return "producao";
    case "EM_PAGAMENTO":
      return "pagamento";
    case "ENCERRADA":
      return "encerrada";
    case "CANCELADA":
      return "cancelada";
  }
}

function formatCashStatus(status: CashSessionAggregate["status"]): string {
  switch (status) {
    case "ABERTO":
      return "aberto";
    case "FECHADO":
      return "fechado";
    default:
      return status.toLowerCase();
  }
}

function formatCurrency(valueCents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(valueCents / 100);
}

function escapeHtml(value: string | null | undefined): string {
  return (value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
}

