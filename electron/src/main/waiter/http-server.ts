import http from "node:http";
import os from "node:os";

import { sanitizePinInput } from "@rayzen/pdv";

import type { OperatorAuthService } from "../auth/service.js";
import type { CatalogService } from "../catalog/service.js";
import type { PdvRoundtripService } from "../pdv/service.js";
import type { MainProcessLogStore } from "../log-store.js";
import { WaiterSessionStore } from "./session-store.js";
import { renderMobileUi } from "./mobile-ui.js";

export interface WaiterHttpServerOptions {
  port?: number;
}

export interface WaiterServerStatus {
  running: boolean;
  port: number;
  localIp: string | null;
  url: string | null;
}

export class WaiterHttpServer {
  readonly #auth: OperatorAuthService;
  readonly #catalog: CatalogService;
  readonly #pdv: PdvRoundtripService;
  readonly #logger: MainProcessLogStore;
  readonly #sessions = new WaiterSessionStore();
  readonly #port: number;
  #server: http.Server | null = null;

  constructor(
    auth: OperatorAuthService,
    catalog: CatalogService,
    pdv: PdvRoundtripService,
    logger: MainProcessLogStore,
    options: WaiterHttpServerOptions = {}
  ) {
    this.#auth = auth;
    this.#catalog = catalog;
    this.#pdv = pdv;
    this.#logger = logger;
    this.#port = options.port ?? 3030;
  }

  start(): void {
    if (this.#server) return;

    this.#server = http.createServer((req, res) => {
      this.#handle(req, res).catch((err) => {
        this.#logger.warn("waiter.http.unhandled-error", { error: String(err) });
        if (!res.headersSent) {
          res.writeHead(500).end(JSON.stringify({ error: "Internal error" }));
        }
      });
    });

    this.#server.listen(this.#port, "0.0.0.0", () => {
      this.#logger.info("waiter.http.started", { port: this.#port, ip: this.#getLocalIp() });
    });

    this.#server.on("error", (err) => {
      this.#logger.warn("waiter.http.error", { error: String(err) });
    });
  }

  stop(): void {
    this.#server?.close();
    this.#server = null;
  }

  getStatus(): WaiterServerStatus {
    const localIp = this.#getLocalIp();
    const running = this.#server !== null;
    return {
      running,
      port: this.#port,
      localIp,
      url: running && localIp ? `http://${localIp}:${this.#port}` : null
    };
  }

  async #handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = req.url ?? "/";
    const method = req.method ?? "GET";

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Session-Id");

    if (method === "OPTIONS") {
      res.writeHead(204).end();
      return;
    }

    // Serve mobile UI
    if (method === "GET" && url === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderMobileUi());
      return;
    }

    // API routes
    if (url.startsWith("/api/")) {
      await this.#handleApi(url.slice(4), method, req, res);
      return;
    }

    res.writeHead(404).end(JSON.stringify({ error: "Not found" }));
  }

  async #handleApi(path: string, method: string, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const json = (status: number, data: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    };

    const body = await readBody(req);

    // POST /api/auth — login with PIN
    if (path === "/auth" && method === "POST") {
      const pin = sanitizePinInput(String(body?.["pin"] ?? ""));
      if (!pin) {
        json(400, { error: "PIN obrigatorio." });
        return;
      }
      const result = this.#auth.login({ pin, terminalId: "waiter-mobile" });
      if (!result.ok) {
        json(401, { error: result.failure.message });
        return;
      }
      const session = this.#sessions.create({
        operatorId: result.session.operatorId,
        operatorCode: result.session.operatorCode,
        displayLabel: result.session.displayLabel,
        role: result.session.role
      });
      json(200, session);
      return;
    }

    // All routes below require session
    const sessionId = req.headers["x-session-id"] as string | undefined;
    const session = sessionId ? this.#sessions.get(sessionId) : null;

    if (!session) {
      json(401, { error: "Sessao expirada. Faca login novamente." });
      return;
    }

    const actor = {
      userId: session.operatorId,
      terminalId: "waiter-mobile",
      role: session.role as "GARCOM" | "CAIXA" | "GERENTE"
    };

    // GET /api/catalog
    if (path === "/catalog" && method === "GET") {
      const products = this.#catalog.listProducts();
      json(200, { products });
      return;
    }

    // POST /api/comanda/open
    if (path === "/comanda/open" && method === "POST") {
      const numero = String(body?.["numero"] ?? "").trim();
      const mesaRaw = body?.["mesa"];
      const mesa = mesaRaw ? String(mesaRaw).trim() || null : null;
      if (!numero) {
        json(400, { error: "Numero da comanda obrigatorio." });
        return;
      }
      const workspace = this.#pdv.openComanda({ numero, mesaId: mesa, actor });
      const comanda = workspace.currentComanda ?? workspace.activeComandas[0] ?? null;
      json(200, { comanda });
      return;
    }

    // POST /api/comanda/add-item
    if (path === "/comanda/add-item" && method === "POST") {
      const comandaId = body?.["comandaId"] != null ? String(body["comandaId"]) : null;
      const productId = body?.["productId"] != null ? String(body["productId"]) : null;
      if (!comandaId || !productId) {
        json(400, { error: "comandaId e productId obrigatorios." });
        return;
      }
      const product = this.#catalog.findProduct(productId);
      if (!product) {
        json(404, { error: "Produto nao encontrado." });
        return;
      }
      const workspace = this.#pdv.addComandaItem({
        comandaId,
        produtoId: product.productId,
        productLabel: product.label,
        setor: product.setor,
        quantity: 1,
        unitPriceCents: product.unitPriceCents,
        actor
      });
      const comanda = workspace.activeComandas.find(c => c.comandaId === comandaId) ?? null;
      json(200, { comanda });
      return;
    }

    // POST /api/comanda/producao
    if (path === "/comanda/producao" && method === "POST") {
      const comandaId = body?.["comandaId"] != null ? String(body["comandaId"]) : null;
      if (!comandaId) {
        json(400, { error: "comandaId obrigatorio." });
        return;
      }
      const workspace = this.#pdv.sendComandaToProduction({ comandaId, actor });
      const comanda = workspace.activeComandas.find(c => c.comandaId === comandaId) ?? null;
      json(200, { comanda });
      return;
    }

    json(404, { error: "Rota nao encontrada." });
  }

  #getLocalIp(): string | null {
    const nets = os.networkInterfaces();
    for (const iface of Object.values(nets)) {
      for (const addr of iface ?? []) {
        if (addr.family === "IPv4" && !addr.internal) {
          return addr.address;
        }
      }
    }
    return null;
  }
}

async function readBody(req: http.IncomingMessage): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", chunk => { data += chunk; });
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : null); }
      catch { resolve(null); }
    });
    req.on("error", () => resolve(null));
  });
}
