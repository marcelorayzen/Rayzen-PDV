import {
  initializeRayzenDatabase,
  seedInitialFoundationIfEmpty,
  type AppliedMigration,
  type SqliteJournalMode
} from "@rayzen/db";

import type { DatabaseStatusSnapshot } from "../contracts/ipc.js";
import type { MainProcessPaths } from "./paths.js";

export interface DatabaseServiceOptions {
  walMode?: SqliteJournalMode;
}

export class ElectronDatabaseService {
  readonly #paths: MainProcessPaths;
  readonly #walMode: SqliteJournalMode;
  #client: ReturnType<typeof initializeRayzenDatabase> | null = null;

  constructor(paths: MainProcessPaths, options: DatabaseServiceOptions = {}) {
    this.#paths = paths;
    this.#walMode = options.walMode ?? "enabled";
  }

  start(): DatabaseStatusSnapshot {
    if (!this.#client) {
      this.#client = initializeRayzenDatabase({
        filePath: this.#paths.dbFilePath,
        walMode: this.#walMode
      });
      seedInitialFoundationIfEmpty(this.#client);
    }

    return this.getStatus();
  }

  isReady(): boolean {
    return this.#client !== null;
  }

  getStatus(): DatabaseStatusSnapshot {
    const client = this.getClient();
    const journalModeRow = client.raw.prepare("PRAGMA journal_mode").get() as { journal_mode: string };

    return {
      filePath: client.config.filePath,
      walMode: client.config.walMode,
      journalMode: journalModeRow.journal_mode,
      appliedMigrations: client.getAppliedMigrations(),
      pendingMigrationVersions: client.getMigrationPlan().pending.map((migration) => migration.version)
    };
  }

  getAppliedMigrations(): AppliedMigration[] {
    return this.getClient().getAppliedMigrations();
  }

  get client() {
    return this.getClient();
  }

  close(): void {
    if (!this.#client) {
      return;
    }

    this.#client.close();
    this.#client = null;
  }

  private getClient() {
    if (!this.#client) {
      throw new Error("Database service not started.");
    }

    return this.#client;
  }
}
