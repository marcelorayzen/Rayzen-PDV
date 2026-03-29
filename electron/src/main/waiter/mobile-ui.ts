export function renderMobileUi(): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<meta name="mobile-web-app-capable" content="yes"/>
<meta name="apple-mobile-web-app-capable" content="yes"/>
<title>Rayzen — Atendimento</title>
<style>
:root {
  --blue: #2563eb;
  --blue-dark: #1d4ed8;
  --gold: #c8960e;
  --gold-dark: #b07c0a;
  --danger: #dc2626;
  --success: #16a34a;
  --bg: #eef3fb;
  --surface: #ffffff;
  --border: rgba(59,130,246,.15);
  --text: #1e293b;
  --muted: #64748b;
  --radius: 14px;
}
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
body{font-family:"Segoe UI",sans-serif;background:var(--bg);color:var(--text);min-height:100dvh;overflow-x:hidden;}
#app{display:flex;flex-direction:column;min-height:100dvh;}

/* HEADER */
.header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--surface);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:10;}
.header__brand{font-size:15px;font-weight:800;color:var(--blue);}
.header__sub{font-size:11px;color:var(--muted);}
.header__btn{padding:6px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:12px;font-weight:600;cursor:pointer;}

/* FEEDBACK */
.feedback{padding:8px 16px;font-size:13px;font-weight:600;text-align:center;}
.feedback--error{background:#fef2f2;color:#991b1b;border-bottom:1px solid rgba(220,38,38,.2);}
.feedback--ok{background:#f0fdf4;color:#166534;border-bottom:1px solid rgba(22,163,74,.2);}

/* SCREENS */
.screen{display:none;flex-direction:column;flex:1;}
.screen.active{display:flex;}

/* PIN SCREEN */
.pin-wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;gap:20px;padding:24px;}
.pin-wrap h1{font-size:22px;font-weight:800;color:var(--blue);}
.pin-wrap p{font-size:13px;color:var(--muted);text-align:center;}
.pin-input{width:100%;max-width:280px;height:56px;font-size:22px;letter-spacing:.3em;text-align:center;border:2px solid var(--border);border-radius:var(--radius);background:var(--surface);color:var(--text);}
.pin-input:focus{outline:none;border-color:var(--blue);}
.btn-primary{width:100%;max-width:280px;height:52px;background:var(--gold);border:none;border-radius:var(--radius);color:#1a1200;font-size:16px;font-weight:800;cursor:pointer;}
.btn-primary:active{background:var(--gold-dark);}

/* COMANDA SCREEN */
.comanda-bar{display:flex;gap:8px;padding:12px 16px;background:var(--surface);border-bottom:1px solid var(--border);}
.comanda-bar input{flex:1;height:44px;padding:0 12px;border:1px solid var(--border);border-radius:10px;background:var(--bg);font-size:15px;color:var(--text);}
.comanda-bar input:focus{outline:none;border-color:var(--blue);}
.btn-buscar{height:44px;padding:0 16px;background:var(--blue);border:none;border-radius:10px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;white-space:nowrap;}
.btn-buscar:active{background:var(--blue-dark);}

/* COMANDA INFO */
.comanda-info{padding:10px 16px;background:var(--surface);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;min-height:44px;}
.comanda-info__title{font-size:14px;font-weight:700;}
.comanda-info__meta{font-size:12px;color:var(--muted);}
.comanda-info__total{margin-left:auto;font-size:14px;font-weight:800;color:var(--gold);}

/* TABS */
.tabs{display:flex;gap:6px;padding:10px 16px;overflow-x:auto;background:var(--surface);border-bottom:1px solid var(--border);}
.tab{flex-shrink:0;padding:6px 14px;border-radius:20px;border:1px solid var(--border);background:var(--bg);font-size:13px;font-weight:600;color:var(--muted);cursor:pointer;}
.tab.active{background:var(--blue);border-color:var(--blue);color:#fff;}
.tab:active{opacity:.8;}

/* PRODUCTS */
.products{flex:1;overflow-y:auto;padding:8px;}
.product-row{display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface);border:1px solid var(--border);border-radius:10px;margin-bottom:6px;}
.product-row__hint{width:32px;text-align:center;font-size:11px;font-weight:700;color:var(--muted);background:var(--bg);border-radius:6px;padding:3px 0;}
.product-row__name{flex:1;font-size:14px;font-weight:600;}
.product-row__setor{font-size:11px;color:var(--muted);}
.product-row__price{font-size:13px;font-weight:700;color:var(--gold);margin-right:4px;white-space:nowrap;}
.btn-add{width:36px;height:36px;border-radius:10px;border:none;background:var(--gold);color:#1a1200;font-size:20px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;}
.btn-add:active{background:var(--gold-dark);}

/* ITEMS (pedido) */
.items-panel{background:var(--surface);border-top:2px solid var(--border);}
.items-header{display:flex;align-items:center;justify-content:space-between;padding:8px 16px;border-bottom:1px solid var(--border);}
.items-header span{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);}
.btn-producao{padding:7px 14px;background:var(--blue);border:none;border-radius:8px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;}
.btn-producao:active{background:var(--blue-dark);}
.btn-producao:disabled{opacity:.5;cursor:not-allowed;}
.item-list{max-height:36dvh;overflow-y:auto;}
.item-row{display:flex;align-items:center;gap:8px;padding:8px 16px;border-bottom:1px solid var(--border);font-size:13px;}
.item-row__name{flex:1;}
.item-row__qty{color:var(--muted);}
.item-row__price{font-weight:700;color:var(--gold);}
.item-row__status{font-size:10px;font-weight:700;padding:2px 6px;border-radius:20px;background:var(--bg);color:var(--muted);}
.item-row__status--lancado{color:#d97706;}
.item-row__status--enviado{color:var(--success);}
.empty-items{padding:16px;text-align:center;color:var(--muted);font-size:13px;}
</style>
</head>
<body>
<div id="app">
  <div class="header">
    <div>
      <div class="header__brand">Rayzen</div>
      <div class="header__sub" id="header-sub">Atendimento</div>
    </div>
    <button class="header__btn" id="btn-sair" style="display:none">Sair</button>
  </div>
  <div id="feedback" style="display:none"></div>

  <!-- PIN -->
  <div class="screen active" id="screen-pin">
    <div class="pin-wrap">
      <h1>Rayzen PDV</h1>
      <p>Digite seu PIN para iniciar o atendimento</p>
      <input class="pin-input" id="pin-input" type="password" inputmode="numeric" maxlength="6" placeholder="••••" autocomplete="off"/>
      <button class="btn-primary" id="btn-login">Entrar</button>
    </div>
  </div>

  <!-- COMANDA -->
  <div class="screen" id="screen-comanda">
    <div class="comanda-bar">
      <input id="comanda-num" type="text" inputmode="numeric" placeholder="Nº comanda" maxlength="6"/>
      <input id="mesa-num" type="text" placeholder="Mesa (opcional)" maxlength="6"/>
      <button class="btn-buscar" id="btn-buscar">Buscar</button>
    </div>
    <div class="comanda-info" id="comanda-info" style="display:none"></div>
    <div class="tabs" id="tabs" style="display:none"></div>
    <div class="products" id="products"></div>
    <div class="items-panel" id="items-panel" style="display:none">
      <div class="items-header">
        <span id="items-count">0 itens</span>
        <button class="btn-producao" id="btn-producao" disabled>Enviar para produção</button>
      </div>
      <div class="item-list" id="item-list"></div>
    </div>
  </div>
</div>

<script>
(function(){
  let session = null;
  let catalog = [];
  let activeCategory = null;
  let workspace = null;

  const $ = id => document.getElementById(id);

  function fmt(cents) {
    return "R$ " + (cents / 100).toFixed(2).replace(".", ",");
  }

  function showFeedback(msg, type) {
    const el = $("feedback");
    el.textContent = msg;
    el.className = "feedback feedback--" + type;
    el.style.display = "block";
    if (type === "ok") setTimeout(() => { el.style.display = "none"; }, 2500);
  }

  function hideFeedback() { $("feedback").style.display = "none"; }

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    $(id).classList.add("active");
  }

  async function api(path, body) {
    const opts = { method: body ? "POST" : "GET", headers: {} };
    if (body) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
    if (session) opts.headers["X-Session-Id"] = session.sessionId;
    const res = await fetch("/api" + path, opts);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Erro desconhecido");
    return json;
  }

  // PIN LOGIN
  async function doLogin() {
    const pin = $("pin-input").value.trim();
    if (!pin) return;
    hideFeedback();
    try {
      session = await api("/auth", { pin });
      $("header-sub").textContent = session.displayLabel;
      $("btn-sair").style.display = "block";
      const data = await api("/catalog");
      catalog = data.products;
      showScreen("screen-comanda");
      $("comanda-num").focus();
    } catch(e) {
      showFeedback(e.message, "error");
      $("pin-input").value = "";
    }
  }

  $("btn-login").addEventListener("click", doLogin);
  $("pin-input").addEventListener("keydown", e => { if(e.key === "Enter") doLogin(); });

  // LOGOUT
  $("btn-sair").addEventListener("click", () => {
    session = null; workspace = null; catalog = [];
    $("pin-input").value = "";
    $("btn-sair").style.display = "none";
    $("header-sub").textContent = "Atendimento";
    $("comanda-info").style.display = "none";
    $("tabs").style.display = "none";
    $("items-panel").style.display = "none";
    $("products").innerHTML = "";
    hideFeedback();
    showScreen("screen-pin");
  });

  // BUSCAR / ABRIR COMANDA
  async function doBuscar() {
    const numero = $("comanda-num").value.trim();
    const mesa = $("mesa-num").value.trim() || null;
    if (!numero) return;
    hideFeedback();
    try {
      workspace = await api("/comanda/open", { numero, mesa });
      renderComanda();
    } catch(e) {
      showFeedback(e.message, "error");
    }
  }

  $("btn-buscar").addEventListener("click", doBuscar);
  $("comanda-num").addEventListener("keydown", e => { if(e.key === "Enter") doBuscar(); });

  function renderComanda() {
    if (!workspace) return;
    const c = workspace.comanda;
    const activeItems = (c.items || []).filter(i => i.status !== "CANCELADO");
    const total = activeItems.reduce((s, i) => s + i.quantity * i.unitPriceCents, 0);
    const pending = activeItems.filter(i => i.status === "LANCADO").length;

    // info bar
    const info = $("comanda-info");
    info.style.display = "flex";
    info.innerHTML =
      '<span class="comanda-info__title">Comanda ' + esc(c.numero) + '</span>' +
      (c.mesaId ? '<span class="comanda-info__meta">' + esc(c.mesaId) + '</span>' : '') +
      '<span class="comanda-info__meta">' + esc(c.status) + '</span>' +
      '<span class="comanda-info__total">' + fmt(total) + '</span>';

    // tabs
    const cats = [...new Set(catalog.map(p => p.category))];
    if (!activeCategory || !cats.includes(activeCategory)) activeCategory = cats[0] || null;
    const tabsEl = $("tabs");
    tabsEl.style.display = "flex";
    tabsEl.innerHTML = cats.map(cat =>
      '<button class="tab' + (cat === activeCategory ? " active" : "") + '" data-cat="' + esc(cat) + '">' + esc(cat) + '</button>'
    ).join("");

    renderProducts();
    renderItems(activeItems, pending);
  }

  $("tabs").addEventListener("click", e => {
    const btn = e.target.closest("[data-cat]");
    if (!btn) return;
    activeCategory = btn.dataset.cat;
    renderComanda();
  });

  function renderProducts() {
    const filtered = activeCategory ? catalog.filter(p => p.category === activeCategory) : catalog;
    $("products").innerHTML = filtered.map(p =>
      '<div class="product-row">' +
        '<span class="product-row__hint">' + esc(p.shortcutHint) + '</span>' +
        '<span class="product-row__name">' + esc(p.label) + '<br><span class="product-row__setor">' + esc(p.setor) + '</span></span>' +
        '<span class="product-row__price">' + fmt(p.unitPriceCents) + '</span>' +
        '<button class="btn-add" data-product-id="' + esc(p.productId) + '">+</button>' +
      '</div>'
    ).join("");
  }

  $("products").addEventListener("click", async e => {
    const btn = e.target.closest("[data-product-id]");
    if (!btn || !workspace) return;
    const productId = btn.dataset.productId;
    btn.disabled = true;
    try {
      workspace = await api("/comanda/add-item", {
        comandaId: workspace.comanda.comandaId,
        productId
      });
      renderComanda();
      showFeedback("Item adicionado.", "ok");
    } catch(err) {
      showFeedback(err.message, "error");
    } finally {
      btn.disabled = false;
    }
  });

  function renderItems(activeItems, pendingCount) {
    const panel = $("items-panel");
    if (activeItems.length === 0) {
      panel.style.display = "none";
      return;
    }
    panel.style.display = "block";
    $("items-count").textContent = activeItems.length + " " + (activeItems.length === 1 ? "item" : "itens");
    const btnProd = $("btn-producao");
    btnProd.disabled = pendingCount === 0;
    $("item-list").innerHTML = activeItems.map(i => {
      const statusClass = i.status === "LANCADO" ? "lancado" : i.status === "EM_PRODUCAO" ? "enviado" : "";
      return '<div class="item-row">' +
        '<span class="item-row__name">' + esc(i.productLabel) + '</span>' +
        '<span class="item-row__qty">' + i.quantity + 'x</span>' +
        '<span class="item-row__price">' + fmt(i.quantity * i.unitPriceCents) + '</span>' +
        '<span class="item-row__status item-row__status--' + statusClass + '">' + esc(i.status) + '</span>' +
      '</div>';
    }).join("") || '<div class="empty-items">Nenhum item ainda.</div>';
  }

  // ENVIAR PARA PRODUCAO
  $("btn-producao").addEventListener("click", async () => {
    if (!workspace) return;
    $("btn-producao").disabled = true;
    hideFeedback();
    try {
      workspace = await api("/comanda/producao", {
        comandaId: workspace.comanda.comandaId
      });
      renderComanda();
      showFeedback("Enviado para producao!", "ok");
      // volta pro input de comanda para proximo atendimento
      $("comanda-num").value = "";
      $("mesa-num").value = "";
      workspace = null;
      $("comanda-info").style.display = "none";
      $("tabs").style.display = "none";
      $("items-panel").style.display = "none";
      $("products").innerHTML = "";
      $("comanda-num").focus();
    } catch(err) {
      showFeedback(err.message, "error");
      $("btn-producao").disabled = false;
    }
  });

  function esc(s) {
    return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }
})();
</script>
</body>
</html>`;
}
