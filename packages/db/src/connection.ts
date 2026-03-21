import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import type { DatabaseConfig, ResolvedDatabaseConfig } from "./types.js";

const DEFAULT_BUSY_TIMEOUT_MS = 5_000;
const MIGRATION_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  );
`;

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultMigrationsDir = path.resolve(packageRoot, "migrations");

export interface DatabaseConnection {
  readonly db: DatabaseSync;
  readonly config: ResolvedDatabaseConfig;
  checkpoint(mode?: "PASSIVE" | "FULL" | "RESTART" | "TRUNCATE"): void;
  getJournalMode(): string;
  close(): void;
}

export function resolveDatabaseConfig(config: DatabaseConfig): ResolvedDatabaseConfig {
  return {
    filePath: config.filePath,
    migrationsDir: config.migrationsDir ?? defaultMigrationsDir,
    walMode: config.walMode ?? "enabled",
    busyTimeoutMs: config.busyTimeoutMs ?? DEFAULT_BUSY_TIMEOUT_MS,
    foreignKeys: config.foreignKeys ?? true
  };
}

export function openDatabaseConnection(config: DatabaseConfig): DatabaseConnection {
  const resolvedConfig = resolveDatabaseConfig(config);

  ensureDatabaseDirectory(resolvedConfig.filePath);

  const db = new DatabaseSync(resolvedConfig.filePath);
  db.exec(`PRAGMA busy_timeout = ${resolvedConfig.busyTimeoutMs}`);
  db.exec(`PRAGMA foreign_keys = ${resolvedConfig.foreignKeys ? "ON" : "OFF"}`);
  db.prepare(`PRAGMA journal_mode = ${resolvedConfig.walMode === "enabled" ? "WAL" : "DELETE"}`).get();
  db.exec(MIGRATION_TABLE_SQL);

  return {
    db,
    config: resolvedConfig,
    checkpoint(mode = "PASSIVE") {
      db.prepare(`PRAGMA wal_checkpoint(${mode})`).all();
    },
    getJournalMode() {
      const row = db.prepare("PRAGMA journal_mode").get() as { journal_mode: string };
      return row.journal_mode;
    },
    close() {
      db.close();
    }
  };
}

export function getSqliteSidecarPaths(filePath: string): string[] {
  return [filePath, `${filePath}-wal`, `${filePath}-shm`];
}

function ensureDatabaseDirectory(filePath: string): void {
  if (filePath === ":memory:") {
    return;
  }

  const directoryPath = path.dirname(filePath);

  if (directoryPath === "." || directoryPath.length === 0) {
    return;
  }

  fs.mkdirSync(directoryPath, { recursive: true });
}
