import { createPdvShellController } from "./application/index.js";
import { createDesktopBridge } from "./infra/index.js";
import { mountPdvShell } from "./ui/index.js";

const container = document.querySelector<HTMLElement>("#app");

if (!container) {
  throw new Error("Renderer root #app not found.");
}

const controller = createPdvShellController({
  desktopBridge: createDesktopBridge()
});

mountPdvShell({
  container,
  controller
});

void controller.start().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Falha inesperada ao carregar o terminal.";
  const statusRegion = container.querySelector<HTMLElement>("#status-region");
  const authRegion = container.querySelector<HTMLElement>("#auth-region");
  const workspaceRegion = container.querySelector<HTMLElement>("#workspace-region");
  const categoriasRegion = container.querySelector<HTMLElement>("#categorias");
  const produtosRegion = container.querySelector<HTMLElement>("#produtos");
  const pedidoRegion = container.querySelector<HTMLElement>("#pedido");

  if (statusRegion) {
    statusRegion.innerHTML = "";
  }

  if (workspaceRegion) {
    workspaceRegion.hidden = true;
  }

  if (categoriasRegion) {
    categoriasRegion.innerHTML = "";
  }

  if (produtosRegion) {
    produtosRegion.innerHTML = "";
  }

  if (pedidoRegion) {
    pedidoRegion.innerHTML = "";
  }

  if (authRegion) {
    authRegion.hidden = false;
    authRegion.innerHTML = `
      <section class="shell-auth" aria-label="Falha de carregamento do terminal">
        <article class="panel">
          <p class="panel__eyebrow">Falha no bootstrap do terminal</p>
          <h1 class="panel__title">O Rayzen PDV nao conseguiu carregar a interface.</h1>
          <p class="panel__lead">Verifique logs locais e configuracao do terminal antes de tentar novamente.</p>
          <div class="feedback-banner" data-tone="danger">
            <span>${escapeHtml(message)}</span>
          </div>
        </article>
      </section>
    `;
  }

  // eslint-disable-next-line no-console
  console.error("rayzen.renderer.bootstrap-failed", error);
});

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}
