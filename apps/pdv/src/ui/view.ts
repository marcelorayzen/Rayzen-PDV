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

export function renderShell(state: ShellState): string {
  return `
    <main class="pdv-shell">
      <div class="pdv-shell__frame">
        ${renderStatusStrip(state)}
        ${state.firstRunWorkspace.status?.firstRunPending ? renderFirstRunWizard(state) : state.session ? renderWorkspace(state) : renderAuth(state)}
      </div>
    </main>
  `;
}

export function getPreferredFocusSelector(state: ShellState): string | null {
  switch (state.focusTarget) {
    case "setup-company-legal-name":
      return "#setup-company-legal-name";
    case "pin-input":
      return "#pin-input";
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
          O banco local e o seed base ja foram preparados no processo principal. Falta validar a empresa, revisar as impressoras e concluir o bootstrap operacional.
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
        <h2 class="panel__title">Dados mÃ­nimos para liberar o terminal</h2>
        <div class="cash-form-grid">
          <label class="field-block">
            <span class="field-label">RazÃ£o social ou nome operacional</span>
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
        <div class="section-actions">
          <button type="button" class="hero-button" data-action="complete-first-run">
            ${state.firstRunWorkspace.submitting ? "Aplicando configuraÃ§Ã£o..." : "Concluir first-run"}
          </button>
        </div>
        ${renderFeedback(state)}
        <div class="summary-stack">
          <div class="info-card">
            <span class="muted-text">Impressoras detectadas no Windows</span>
            <strong>${discoveredPrinters.length > 0 ? `${discoveredPrinters.length} encontradas` : "nenhuma detectada agora"}</strong>
            <span class="muted-text">${escapeHtml(discoveredPrinters.map((printer) => printer.printerName).join(", ") || "VocÃª pode informar o nome manualmente.")}</span>
          </div>
        </div>
      </article>
    </section>
  `;
}

function renderStatusStrip(state: ShellState): string {
  const currentComanda = state.comandaWorkspace.currentComanda;
  const currentCashSession = state.cashWorkspace.currentSession;
  const activeComandaChip = currentComanda
    ? renderStatusChip("Comanda", `${currentComanda.numero} ${currentComanda.status}`, "ok")
    : renderStatusChip("Comanda", "nenhuma aberta", "warn");
  const activeCashChip = currentCashSession
    ? renderStatusChip("Caixa", currentCashSession.status, currentCashSession.status === "FECHADO" ? "warn" : "ok")
    : renderStatusChip("Caixa", "fechado", "warn");

  return `
    <section class="status-strip" aria-label="Status operacional do shell">
      <div class="status-strip__brand">
        <span class="status-strip__eyebrow">Renderer desktop teclado-first</span>
        <strong class="status-strip__title">Rayzen PDV</strong>
      </div>
      <div class="status-strip__meta">
        ${renderStatusChip("Modo", state.bootstrap.offlineFirst ? "offline-first" : "indefinido", "ok")}
        ${renderStatusChip("IPC", state.bootstrap.ipcMode, state.bootstrap.ipcMode === "electron-ipc" ? "ok" : "warn")}
        ${renderStatusChip("Banco", state.health.databaseReady ? "pronto" : "pendente", state.health.databaseReady ? "ok" : "warn")}
        ${activeCashChip}
        ${activeComandaChip}
      </div>
    </section>
  `;
}

function renderAuth(state: ShellState): string {
  return `
    <section class="shell-auth" aria-label="AutenticaÃ§Ã£o local por PIN">
      <article class="panel">
        <p class="panel__eyebrow">Acesso local</p>
        <h1 class="panel__title">Confirme o PIN local para acessar o terminal</h1>
        <p class="panel__lead">
          SessÃ£o validada no processo principal, sem internet e sem API HTTP local. O renderer apenas reflete o estado persistido.
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
          <div class="pad-grid" aria-label="Teclado numÃ©rico local">
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
            Confirmar sessÃ£o local
          </button>
        </div>
      </article>
    </section>
  `;
}

function renderWorkspace(state: ShellState): string {
  const session = state.session;

  if (!session) {
    return "";
  }

  const currentComanda = state.comandaWorkspace.currentComanda;
  const currentCashSession = state.cashWorkspace.currentSession;
  const navigation = getMainNavigationForRole(session.role);
  const totals = currentComanda ? summarizeComanda(currentComanda) : null;
  const cashTotals = currentCashSession ? summarizeCashSession(currentCashSession) : null;

  return `
    <section class="shell-workspace shell-workspace--comanda" aria-label="Shell operacional do PDV">
      <aside class="panel panel--dense">
        <p class="panel__eyebrow">NavegaÃ§Ã£o principal</p>
        <nav class="workspace-nav" aria-label="Fluxos principais">
          ${navigation
            .map((view) => {
              const isCurrent = view.id === state.currentViewId;

              return `
                <button
                  type="button"
                  class="nav-button"
                  data-action="navigate"
                  data-view-id="${view.id}"
                  aria-current="${isCurrent ? "page" : "false"}"
                >
                  <span class="nav-button__title">${escapeHtml(view.label)}</span>
                  <span class="nav-button__shortcut">${view.shortcut ? escapeHtml(view.shortcut) : "sem atalho"}</span>
                  <span class="operator-card__meta">${escapeHtml(view.description)}</span>
                </button>
              `;
            })
            .join("")}
        </nav>
      </aside>
      <section class="workspace-main">
        <header class="panel workspace-header">
          <div class="workspace-header__meta">
            <span class="surface-pill">${escapeHtml(session.operatorCode)}</span>
            <span class="surface-pill">${escapeHtml(session.role)}</span>
            <span class="surface-pill">${escapeHtml(state.bootstrap.environment)}</span>
            <span class="surface-pill">${state.health.ready ? "main pronto" : "main pendente"}</span>
            <span class="surface-pill">${currentComanda ? `status ${escapeHtml(currentComanda.status)}` : "sem comanda ativa"}</span>
          </div>
          <button type="button" class="secondary-button" data-action="logout-session">
            Encerrar sessÃ£o
          </button>
          ${renderFeedback(state)}
        </header>
        ${renderMainView(state)}
        <section class="panel">
          <p class="panel__eyebrow">Atalhos canonicos</p>
          <div class="command-bar">
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
      <aside class="aside-grid">
        <article class="panel panel--dense">
          <p class="panel__eyebrow">${state.currentViewId === "caixa" ? "Resumo do caixa" : "Resumo da comanda"}</p>
          ${state.currentViewId === "caixa"
            ? renderCashSummary(currentCashSession, cashTotals)
            : currentComanda && totals
              ? `
                  <div class="summary-stack">
                    <div class="info-card">
                      <span class="muted-text">Número</span>
                      <strong class="info-card__value">${escapeHtml(currentComanda.numero)}</strong>
                      <span class="muted-text">${escapeHtml(currentComanda.mesaId ?? "sem mesa")}</span>
                    </div>
                    <div class="info-card">
                      <span class="muted-text">Total</span>
                      <strong class="info-card__value">${formatCurrency(totals.totalCents)}</strong>
                      <span class="muted-text">${totals.activeItems} itens ativos, ${totals.sentItems} enviados</span>
                    </div>
                    <div class="info-card">
                      <span class="muted-text">Pagamento</span>
                      <strong class="info-card__value">${formatCurrency(totals.dueCents)}</strong>
                      <span class="muted-text">Em aberto ${formatCurrency(totals.dueCents)}</span>
                    </div>
                  </div>
                `
              : `<div class="empty-copy">Abra uma comanda para ver totais, itens e trilha local.</div>`}
        </article>
        <article class="panel panel--dense">
          <p class="panel__eyebrow">${state.currentViewId === "caixa" ? "Auditoria do caixa" : "Trilha local"}</p>
          ${renderAuditTrail(state)}
        </article>
      </aside>
    </section>
  `;
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
      return renderPlaceholderView("Mapa de mesas", "A sala entra na proxima chamada com foco visual e produtividade.");
    case "caixa":
      return renderCaixaView(state);
  }
}

function renderComandasView(state: ShellState): string {
  const currentComanda = state.comandaWorkspace.currentComanda;
  const selectedItem = currentComanda?.items.find((item) => item.itemId === state.comandaWorkspace.selectedItemId) ?? null;
  const filteredProducts = filterProducts(state);

  return `
    <section class="comanda-grid">
      <article class="panel">
        <p class="panel__eyebrow">Abertura rÃ¡pida</p>
        <div class="comanda-open-grid">
          <label class="field-block">
            <span class="field-label">NÃºmero da comanda</span>
            <input id="comanda-numero" value="${escapeHtml(state.comandaWorkspace.comandaNumeroDraft)}" placeholder="Ex.: 101" />
          </label>
          <label class="field-block">
            <span class="field-label">Mesa</span>
            <input id="mesa-draft" value="${escapeHtml(state.comandaWorkspace.mesaDraft)}" placeholder="Ex.: M12" />
          </label>
          <button type="button" class="hero-button" data-action="open-comanda">Abrir comanda</button>
        </div>
        <div class="command-bar">
          <span class="command-hint"><strong>F2</strong><span>Retorna para abertura ou retomada rÃ¡pida</span></span>
        </div>
      </article>
      <article class="panel">
        <p class="panel__eyebrow">LanÃ§amento teclado-first</p>
        <div class="workspace-search">
          <label class="sr-only" for="product-search">Busca de produto</label>
          <input
            id="product-search"
            type="search"
            placeholder="F4 busca no catálogo, ENTER lança o item selecionado"
            value="${escapeHtml(state.productSearch)}"
          />
        </div>
        <div class="comanda-entry-grid">
          <div class="catalog-list">
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
          <div class="entry-side">
            <label class="field-block">
              <span class="field-label">Quantidade</span>
              <input id="item-quantity" value="${escapeHtml(state.comandaWorkspace.quantityDraft)}" />
            </label>
            <label class="field-block">
              <span class="field-label">Observação curta</span>
              <input id="item-note" value="${escapeHtml(state.comandaWorkspace.itemNoteDraft)}" placeholder="sem cebola, meio ponto..." />
            </label>
            <button type="button" class="hero-button" data-action="add-selected-product">Adicionar item</button>
            <div class="command-bar">
              <span class="command-hint"><strong>ENTER</strong><span>Confirma o item selecionado</span></span>
              <span class="command-hint"><strong>F6</strong><span>Envia o lote atual para produção</span></span>
            </div>
          </div>
        </div>
      </article>
      <article class="panel">
        <div class="section-head">
          <div>
            <p class="panel__eyebrow">Itens da comanda</p>
            <h2 class="section-title">${currentComanda ? `Comanda ${escapeHtml(currentComanda.numero)}` : "Nenhuma comanda ativa"}</h2>
          </div>
          <div class="section-actions">
            <button type="button" class="secondary-button" data-action="send-production">Enviar produção</button>
            <button type="button" class="secondary-button" data-action="generate-preconta">Gerar prÃ©-conta</button>
          </div>
        </div>
        ${currentComanda ? renderItensTable(currentComanda, state.comandaWorkspace.selectedItemId) : `<div class="empty-copy">Abra uma comanda para iniciar o atendimento.</div>`}
      </article>
      <article class="panel">
        <p class="panel__eyebrow">Cancelamento com motivo</p>
        ${selectedItem
          ? `
              <div class="info-card">
                <span class="muted-text">Item selecionado</span>
                <strong class="info-card__value">${escapeHtml(selectedItem.productLabel)}</strong>
                <span class="muted-text">${escapeHtml(selectedItem.status)} · ${escapeHtml(selectedItem.setor)}</span>
              </div>
            `
          : `<div class="empty-copy">Selecione um item na tabela para habilitar o cancelamento.</div>`}
        <label class="field-block">
          <span class="field-label">Motivo</span>
          <input
            id="cancel-reason"
            value="${escapeHtml(state.comandaWorkspace.cancelReasonDraft)}"
            placeholder="Ex.: cliente desistiu"
          />
        </label>
        <button type="button" class="secondary-button secondary-button--danger" data-action="cancel-selected-item">Cancelar item</button>
      </article>
    </section>
  `;
}

function renderCatalogoView(state: ShellState): string {
  const filteredProducts = filterProducts(state);

  return `
    <section class="catalog-view-grid">
      <article class="hero-card">
        <span class="hero-tagline">Catalogo operacional</span>
        <h2 class="hero-card__title">Busca e selecao rapida</h2>
        <p class="hero-card__body">Use F4 para cair na busca, setas para percorrer o resultado e ENTER para lancar o item direto na comanda ativa.</p>
      </article>
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
        <div class="catalog-list catalog-list--full">
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
    </section>
  `;
}

function renderProducaoView(state: ShellState): string {
  const currentComanda = state.comandaWorkspace.currentComanda;
  const pendingItems = currentComanda?.items.filter((item) => item.status === "LANCADO") ?? [];
  const sentItems = currentComanda?.items.filter((item) => item.status === "ENVIADO") ?? [];

  return `
    <section class="panel-stack">
      <article class="hero-card">
        <span class="hero-tagline">Envio por setor</span>
        <h2 class="hero-card__title">Producao sem perder o ritmo</h2>
        <p class="hero-card__body">F6 executa o envio do lote atual. A UI mostra o contexto; o domínio valida a transicao e a trilha de auditoria.</p>
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
  const snapshot = state.comandaWorkspace.lastPreContaSnapshot;

  return `
    <section class="panel-stack">
      <article class="hero-card">
        <span class="hero-tagline">Conferencia antes do caixa</span>
        <h2 class="hero-card__title">Pré-conta auditável</h2>
        <p class="hero-card__body">F7 gera o snapshot local e trava a visão que vai para conferência e checkout.</p>
        <div class="hero-card__actions">
          <button type="button" class="hero-button" data-action="generate-preconta">Gerar nova pré-conta</button>
          <button type="button" class="secondary-button" data-action="navigate" data-view-id="checkout">Ir para checkout</button>
        </div>
      </article>
      <article class="panel">
        ${snapshot
          ? `
              <div class="section-head">
                <div>
                  <p class="panel__eyebrow">Snapshot ${snapshot.version}</p>
                  <h2 class="section-title">${formatCurrency(snapshot.totalAmountCents)}</h2>
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
  const currentComanda = state.comandaWorkspace.currentComanda;
  const totals = currentComanda ? summarizeComanda(currentComanda) : null;

  return `
    <section class="checkout-grid">
      <article class="hero-card">
        <span class="hero-tagline">Encerramento rápido</span>
        <h2 class="hero-card__title">Checkout da comanda</h2>
        <p class="hero-card__body">F8 traz o foco para o valor. O domínio continua validando total, troco e encerramento auditável.</p>
      </article>
      <article class="panel">
        <div class="kpi-grid">
          <div class="info-card">
            <span class="muted-text">Total da conta</span>
            <strong class="info-card__value">${formatCurrency(totals?.totalCents ?? 0)}</strong>
            <span class="muted-text">Sem descontos nesta chamada</span>
          </div>
          <div class="info-card">
            <span class="muted-text">Pago</span>
            <strong class="info-card__value">${formatCurrency(totals?.paidCents ?? 0)}</strong>
            <span class="muted-text">Historico local de pagamentos confirmados</span>
          </div>
          <div class="info-card">
            <span class="muted-text">Em aberto</span>
            <strong class="info-card__value">${formatCurrency(totals?.dueCents ?? 0)}</strong>
            <span class="muted-text">Valor sugerido para confirmacao</span>
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
            <button type="button" class="secondary-button" data-action="fill-checkout-due">Usar valor exato</button>
            <button type="button" class="hero-button" data-action="checkout-submit">Confirmar checkout</button>
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

  return `
    <section class="cash-grid">
      <article class="hero-card">
        <span class="hero-tagline">Controle auditável</span>
        <h2 class="hero-card__title">Caixa do turno</h2>
        <p class="hero-card__body">Abertura, recebimentos por forma, sangria, suprimento e fechamento ficam concentrados aqui, sempre com trilha local exportável.</p>
      </article>
      <article class="panel">
        <div class="section-head">
          <div>
            <p class="panel__eyebrow">Sessão atual</p>
            <h2 class="section-title">${currentSession ? escapeHtml(currentSession.status) : "Caixa fechado"}</h2>
          </div>
          <div class="section-actions">
            <button type="button" class="secondary-button" data-action="export-cash-audit">Preparar auditoria</button>
          </div>
        </div>
        ${currentSession
          ? `
              <div class="kpi-grid">
                <div class="info-card">
                  <span class="muted-text">Esperado</span>
                  <strong class="info-card__value">${formatCurrency(totals?.totalExpectedAmountCents ?? 0)}</strong>
                  <span class="muted-text">${totals?.movementCount ?? 0} movimentos</span>
                </div>
                <div class="info-card">
                  <span class="muted-text">Contado</span>
                  <strong class="info-card__value">${formatCurrency(totals?.totalCountedAmountCents ?? 0)}</strong>
                  <span class="muted-text">Preenchido no fechamento</span>
                </div>
                <div class="info-card">
                  <span class="muted-text">Divergência</span>
                  <strong class="info-card__value">${formatCurrency(totals?.totalDivergenceAmountCents ?? 0)}</strong>
                  <span class="muted-text">Explícita e auditável</span>
                </div>
              </div>
            `
          : `<div class="empty-copy">Abra o caixa para habilitar recebimentos, sangrias, suprimentos e conferência.</div>`}
      </article>
      <article class="panel">
        <p class="panel__eyebrow">Abertura</p>
        <div class="cash-form-grid">
          <label class="field-block">
            <span class="field-label">Fundo inicial</span>
            <input id="cash-opening-fund" value="${escapeHtml(state.cashWorkspace.openingFundDraft)}" placeholder="0,00" />
          </label>
          <label class="field-block">
            <span class="field-label">Observação</span>
            <input id="cash-opening-reason" value="${escapeHtml(state.cashWorkspace.openingReasonDraft)}" placeholder="troco inicial do turno" />
          </label>
          <button type="button" class="hero-button" data-action="open-cash-session">Abrir caixa</button>
        </div>
      </article>
      <article class="panel">
        <p class="panel__eyebrow">Recebimento por forma</p>
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
        <div class="cash-form-grid">
          <label class="field-block">
            <span class="field-label">Valor</span>
            <input id="cash-receipt-amount" value="${escapeHtml(state.cashWorkspace.receiptAmountDraft)}" placeholder="0,00" />
          </label>
          <label class="field-block">
            <span class="field-label">Referência</span>
            <input id="cash-receipt-reason" value="${escapeHtml(state.cashWorkspace.receiptReasonDraft)}" placeholder="checkout avulso, acerto local..." />
          </label>
          <button type="button" class="hero-button" data-action="register-cash-receipt">Registrar recebimento</button>
        </div>
      </article>
      <article class="panel">
        <div class="section-head">
          <div>
            <p class="panel__eyebrow">Sangria e suprimento</p>
            <h2 class="section-title">Movimentos em dinheiro</h2>
          </div>
          <div class="section-actions">
            <button type="button" class="secondary-button" data-action="start-cash-closure">Iniciar fechamento</button>
          </div>
        </div>
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
            <button type="button" class="secondary-button secondary-button--danger" data-action="register-cash-withdrawal">Registrar sangria</button>
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
            <button type="button" class="secondary-button" data-action="register-cash-supply">Registrar suprimento</button>
          </div>
        </div>
      </article>
      <article class="panel">
        <div class="section-head">
          <div>
            <p class="panel__eyebrow">Conferencia por forma</p>
            <h2 class="section-title">Fechamento do caixa</h2>
          </div>
          <div class="section-actions">
            <button type="button" class="hero-button" data-action="confirm-cash-closure">Concluir fechamento</button>
          </div>
        </div>
        ${totals
          ? `
              <div class="closure-table">
                <div class="item-table__header">
                  <span>Forma</span>
                  <span>Esperado</span>
                  <span>Contado</span>
                  <span>Divergência</span>
                </div>
                ${totals.byMethod
                  .map((item) => {
                    return `
                      <div class="item-row">
                        <span>${formatMethod(item.method)}</span>
                        <span>${formatCurrency(item.expectedAmountCents)}</span>
                        <span>
                          <input
                            id="cash-count-${item.method}"
                            value="${escapeHtml(state.cashWorkspace.closureCountDrafts[item.method] ?? "")}"
                            placeholder="0,00"
                          />
                        </span>
                        <span>${formatCurrency(parseCashDraft(state.cashWorkspace.closureCountDrafts[item.method]) - item.expectedAmountCents)}</span>
                      </div>
                    `;
                  })
                  .join("")}
              </div>
            `
          : `<div class="empty-copy">Abra o caixa para habilitar a conferência.</div>`}
        <div class="cash-form-grid">
          <label class="field-block">
            <span class="field-label">Observação de fechamento</span>
            <input id="cash-closure-note" value="${escapeHtml(state.cashWorkspace.closureNoteDraft)}" placeholder="fechamento do turno da noite" />
          </label>
          <label class="field-block">
            <span class="field-label">Justificativa da divergencia</span>
            <input id="cash-divergence-reason" value="${escapeHtml(state.cashWorkspace.divergenceReasonDraft)}" placeholder="obrigatória quando houver diferença" />
          </label>
        </div>
      </article>
      <article class="panel">
        <p class="panel__eyebrow">Auditoria exportável</p>
        ${state.cashWorkspace.auditExport
          ? `<pre class="audit-export-pre">${escapeHtml(JSON.stringify(state.cashWorkspace.auditExport, null, 2))}</pre>`
          : `<div class="empty-copy">Use o botao de auditoria para preparar o bundle local do caixa.</div>`}
      </article>
    </section>
  `;
}

function renderPlaceholderView(title: string, body: string): string {
  return `
    <section class="hero-card">
      <span class="hero-tagline">Em preparo</span>
      <h2 class="hero-card__title">${escapeHtml(title)}</h2>
      <p class="hero-card__body">${escapeHtml(body)}</p>
    </section>
  `;
}

function renderItensTable(comanda: ComandaAggregate, selectedItemId: string | null): string {
  return `
    <div class="item-table">
      <div class="item-table__header">
        <span>Item</span>
        <span>Status</span>
        <span>Setor</span>
        <span>Qtd</span>
        <span>Total</span>
      </div>
      ${comanda.items
        .map((item) => {
          return renderItemRow(item, item.itemId === selectedItemId);
        })
        .join("")}
    </div>
  `;
}

function renderItemRow(item: ComandaItem, isSelected: boolean): string {
  return `
    <button
      type="button"
      class="item-row item-row--button"
      data-action="select-item"
      data-item-id="${escapeHtml(item.itemId)}"
      aria-pressed="${isSelected ? "true" : "false"}"
    >
      <span>
        <strong>${escapeHtml(item.productLabel)}</strong>
        <small class="muted-text">${escapeHtml(item.note ?? "sem observação")}</small>
      </span>
      <span><span class="status-badge status-badge--${item.status.toLowerCase()}">${escapeHtml(item.status)}</span></span>
      <span>${escapeHtml(item.setor)}</span>
      <span>${item.quantity}</span>
      <span>${formatCurrency(Math.round(item.quantity * item.unitPriceCents))}</span>
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
    return `<div class="empty-copy">Sem alertas locais no momento.</div>`;
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

  return `
    <div class="summary-stack">
      <div class="info-card">
        <span class="muted-text">Sessao</span>
        <strong class="info-card__value">${escapeHtml(currentSession.cashSessionId)}</strong>
        <span class="muted-text">${escapeHtml(currentSession.status)}</span>
      </div>
      <div class="info-card">
        <span class="muted-text">Esperado</span>
        <strong class="info-card__value">${formatCurrency(totals.totalExpectedAmountCents)}</strong>
        <span class="muted-text">${totals.movementCount} movimentos</span>
      </div>
      <div class="info-card">
        <span class="muted-text">Divergência</span>
        <strong class="info-card__value">${formatCurrency(totals.totalDivergenceAmountCents)}</strong>
        <span class="muted-text">${currentSession.closedAt ? "fechamento concluido" : "aguardando conferência"}</span>
      </div>
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

function formatCurrency(valueCents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(valueCents / 100);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

