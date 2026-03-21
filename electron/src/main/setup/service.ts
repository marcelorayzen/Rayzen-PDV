import fs from "node:fs";

import {
  seedInitialFoundationIfEmpty,
  type RayzenDatabaseClient
} from "@rayzen/db";

import type {
  CompleteFirstRunRequest,
  InstallationStatusSnapshot
} from "../../contracts/ipc.js";
import type { MainProcessLogStore } from "../log-store.js";
import type { MainProcessPaths } from "../paths.js";

interface RuntimeConfigFile {
  schemaVersion: 1;
  firstRunCompletedAt: string | null;
  appVersion: string;
  company: {
    legalName: string;
    tradeName: string | null;
    document: string | null;
  } | null;
  printers: {
    cozinha: string;
    bar: string;
    caixa: string;
  };
  seed: {
    seededOperators: number;
    seededProducts: number;
    seededPrintRoutes: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface SetupServiceOptions {
  appVersion: string;
}

export class FirstRunSetupService {
  readonly #client: RayzenDatabaseClient;
  readonly #logger: MainProcessLogStore;
  readonly #paths: MainProcessPaths;
  readonly #appVersion: string;

  constructor(
    client: RayzenDatabaseClient,
    logger: MainProcessLogStore,
    paths: MainProcessPaths,
    options: SetupServiceOptions
  ) {
    this.#client = client;
    this.#logger = logger;
    this.#paths = paths;
    this.#appVersion = options.appVersion;
  }

  getStatus(): InstallationStatusSnapshot {
    const config = this.#readConfig();
    const routes = this.#client.printRouting.listAll();

    return {
      firstRunPending: config?.firstRunCompletedAt == null,
      configFilePath: this.#paths.runtimeConfigFilePath,
      appVersion: this.#appVersion,
      completedAt: config?.firstRunCompletedAt ?? null,
      company: config?.company ?? null,
      printRoutes: routes.map((route) => ({
        setor: route.setor,
        impressoras: [route.printerName]
      })),
      seedState: {
        adminReady: this.#client.operators.listActive().some((operator) => operator.operatorCode === "ADMIN"),
        productCount: this.#client.products.countAll(),
        printRouteCount: routes.length
      }
    };
  }

  completeFirstRun(request: CompleteFirstRunRequest): InstallationStatusSnapshot {
    const legalName = request.companyLegalName.trim();
    const tradeName = normalizeOptionalText(request.companyTradeName);
    const document = normalizeOptionalText(request.companyDocument);
    const cozinhaPrinter = request.printers.cozinha.trim();
    const barPrinter = request.printers.bar.trim();
    const caixaPrinter = request.printers.caixa.trim();

    if (legalName.length < 3) {
      throw new Error("Informe o nome da empresa com pelo menos 3 caracteres.");
    }

    if (!cozinhaPrinter || !barPrinter || !caixaPrinter) {
      throw new Error("Configure as impressoras de cozinha, bar e caixa antes de concluir o first-run.");
    }

    const seeded = this.#client.transaction(() => {
      const seedResult = seedInitialFoundationIfEmpty(this.#client);

      this.#client.printRouting.upsert({
        route: {
          setor: "COZINHA",
          printerName: cozinhaPrinter
        }
      });
      this.#client.printRouting.upsert({
        route: {
          setor: "BAR",
          printerName: barPrinter
        }
      });
      this.#client.printRouting.upsert({
        route: {
          setor: "CAIXA",
          printerName: caixaPrinter
        }
      });
      this.#client.auditEvents.append({
        eventId: createOperationalEventId("setup", request.occurredAt),
        entity: "INSTALLATION",
        entityId: "first-run",
        action: "FIRST_RUN_COMPLETED",
        actorUserId: null,
        actorTerminalId: "pdv-main",
        actorRole: "SYSTEM",
        occurredAt: request.occurredAt,
        payload: {
          companyLegalName: legalName,
          companyTradeName: tradeName,
          companyDocument: document,
          printers: {
            cozinha: cozinhaPrinter,
            bar: barPrinter,
            caixa: caixaPrinter
          }
        }
      });

      return seedResult;
    });

    const now = request.occurredAt;
    const currentConfig = this.#readConfig();
    const runtimeConfig: RuntimeConfigFile = {
      schemaVersion: 1,
      firstRunCompletedAt: now,
      appVersion: this.#appVersion,
      company: {
        legalName,
        tradeName,
        document
      },
      printers: {
        cozinha: cozinhaPrinter,
        bar: barPrinter,
        caixa: caixaPrinter
      },
      seed: seeded,
      createdAt: currentConfig?.createdAt ?? now,
      updatedAt: now
    };

    this.#writeConfig(runtimeConfig);
    this.#logger.info("electron.setup.first-run-completed", {
      configFilePath: this.#paths.runtimeConfigFilePath,
      companyLegalName: legalName
    });

    return this.getStatus();
  }

  readRuntimeConfigFile(): Record<string, unknown> | null {
    const config = this.#readConfig();

    if (!config) {
      return null;
    }

    return {
      schemaVersion: config.schemaVersion,
      firstRunCompletedAt: config.firstRunCompletedAt,
      appVersion: config.appVersion,
      company: config.company,
      printers: config.printers,
      seed: config.seed,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt
    };
  }

  #readConfig(): RuntimeConfigFile | null {
    if (!fs.existsSync(this.#paths.runtimeConfigFilePath)) {
      return null;
    }

    return JSON.parse(fs.readFileSync(this.#paths.runtimeConfigFilePath, "utf8")) as RuntimeConfigFile;
  }

  #writeConfig(config: RuntimeConfigFile): void {
    fs.mkdirSync(this.#paths.configDir, { recursive: true });
    fs.writeFileSync(this.#paths.runtimeConfigFilePath, JSON.stringify(config, null, 2), "utf8");
  }
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function createOperationalEventId(prefix: string, occurredAt: string): string {
  return `evt_${prefix}_${occurredAt.replace(/[^0-9A-Za-z]/g, "")}`;
}
