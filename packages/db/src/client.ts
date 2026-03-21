import type { DatabaseConfig } from "./types.js";

import { openDatabaseConnection, type DatabaseConnection } from "./connection.js";
import {
  getAppliedMigrations,
  getMigrationPlan,
  migrateDown,
  migrateUp
} from "./migrations.js";
import { AuditEventRepository } from "./repositories/audit-events.js";
import { CashSessionRepository } from "./repositories/cash-sessions.js";
import { ComandaRepository } from "./repositories/comandas.js";
import { FiscalRepository } from "./repositories/fiscal.js";
import { FiscalQueueRepository } from "./repositories/fiscal-queue.js";
import { OperatorRepository } from "./repositories/operators.js";
import { PrintRoutingRepository } from "./repositories/print-routing.js";
import { PrintSpoolRepository } from "./repositories/print-spool.js";
import { ProductRepository } from "./repositories/products.js";
import { executeTransaction } from "./transaction.js";

export class RayzenDatabaseClient {
  readonly #connection: DatabaseConnection;
  readonly auditEvents: AuditEventRepository;
  readonly cashSessions: CashSessionRepository;
  readonly comandas: ComandaRepository;
  readonly printRouting: PrintRoutingRepository;
  readonly printSpool: PrintSpoolRepository;
  readonly fiscal: FiscalRepository;
  readonly fiscalQueue: FiscalQueueRepository;
  readonly operators: OperatorRepository;
  readonly products: ProductRepository;

  constructor(config: DatabaseConfig) {
    this.#connection = openDatabaseConnection(config);
    this.auditEvents = new AuditEventRepository(this.#connection.db);
    this.cashSessions = new CashSessionRepository(this.#connection.db);
    this.comandas = new ComandaRepository(this.#connection.db);
    this.printRouting = new PrintRoutingRepository(this.#connection.db);
    this.printSpool = new PrintSpoolRepository(this.#connection.db);
    this.fiscal = new FiscalRepository(this.#connection.db);
    this.fiscalQueue = new FiscalQueueRepository(this.#connection.db);
    this.operators = new OperatorRepository(this.#connection.db);
    this.products = new ProductRepository(this.#connection.db);
  }

  get config() {
    return this.#connection.config;
  }

  get raw() {
    return this.#connection.db;
  }

  migrateUp(options?: { toVersion?: string; steps?: number }) {
    return migrateUp(this.#connection, options);
  }

  migrateDown(options?: { toVersion?: string; steps?: number }) {
    return migrateDown(this.#connection, options);
  }

  getMigrationPlan() {
    return getMigrationPlan(this.#connection);
  }

  getAppliedMigrations() {
    return getAppliedMigrations(this.#connection);
  }

  checkpoint(mode?: "PASSIVE" | "FULL" | "RESTART" | "TRUNCATE"): void {
    this.#connection.checkpoint(mode);
  }

  transaction<T>(callback: () => T): T {
    let result: T | undefined;

    executeTransaction(this.#connection.db, () => {
      result = callback();
    });

    return result as T;
  }

  close(): void {
    this.#connection.close();
  }
}

export function createRayzenDatabaseClient(config: DatabaseConfig): RayzenDatabaseClient {
  return new RayzenDatabaseClient(config);
}

export function initializeRayzenDatabase(config: DatabaseConfig): RayzenDatabaseClient {
  const client = createRayzenDatabaseClient(config);
  client.migrateUp();
  return client;
}
