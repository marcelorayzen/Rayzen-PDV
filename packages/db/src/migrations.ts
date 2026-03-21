import fs from "node:fs";
import path from "node:path";

import type {
  AppliedMigration,
  DatabaseConfig,
  MigrationDefinition,
  MigrationPlan
} from "./types.js";

import { openDatabaseConnection, type DatabaseConnection } from "./connection.js";

interface MigrationFilter {
  toVersion?: string;
  steps?: number;
}

export function loadMigrations(migrationsDir: string): MigrationDefinition[] {
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  const directories = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  return directories.map((directoryName) => {
    const directoryPath = path.join(migrationsDir, directoryName);
    const [version, ...nameParts] = directoryName.split("_");

    if (!version) {
      throw new Error(`Migration com versao invalida: ${directoryName}`);
    }

    return {
      version,
      name: nameParts.join("_") || directoryName,
      directoryPath,
      upSql: fs.readFileSync(path.join(directoryPath, "up.sql"), "utf8"),
      downSql: fs.readFileSync(path.join(directoryPath, "down.sql"), "utf8")
    };
  });
}

export function getAppliedMigrations(connection: DatabaseConnection): AppliedMigration[] {
  return connection.db.prepare(
    `
      SELECT version, name, applied_at AS appliedAt
      FROM schema_migrations
      ORDER BY version ASC
    `
  ).all() as unknown as AppliedMigration[];
}

export function getMigrationPlan(connection: DatabaseConnection): MigrationPlan {
  const appliedMigrations = getAppliedMigrations(connection);
  const appliedVersions = new Set(appliedMigrations.map((migration) => migration.version));

  return {
    applied: appliedMigrations,
    pending: loadMigrations(connection.config.migrationsDir).filter(
      (migration) => !appliedVersions.has(migration.version)
    )
  };
}

export function migrateUp(connection: DatabaseConnection, filter: MigrationFilter = {}): AppliedMigration[] {
  const appliedVersions = new Set(getAppliedMigrations(connection).map((migration) => migration.version));

  const pendingMigrations = loadMigrations(connection.config.migrationsDir).filter((migration) => {
    if (appliedVersions.has(migration.version)) {
      return false;
    }

    if (filter.toVersion && migration.version > filter.toVersion) {
      return false;
    }

    return true;
  });

  const migrationsToApply =
    typeof filter.steps === "number" ? pendingMigrations.slice(0, filter.steps) : pendingMigrations;

  for (const migration of migrationsToApply) {
    runMigrationTransaction(connection.db, migration.upSql, () => {
      connection.db
        .prepare(
          `
            INSERT INTO schema_migrations (version, name, applied_at)
            VALUES (:version, :name, :appliedAt)
          `
        )
        .run({
          version: migration.version,
          name: migration.name,
          appliedAt: new Date().toISOString()
        });
    });
  }

  return getAppliedMigrations(connection);
}

export function migrateDown(connection: DatabaseConnection, filter: MigrationFilter = {}): AppliedMigration[] {
  const appliedMigrations = getAppliedMigrations(connection);
  const rollbackCandidates = [...appliedMigrations].reverse().filter((migration) => {
    if (filter.toVersion) {
      return migration.version > filter.toVersion;
    }

    return true;
  });

  const migrationsToRollback =
    typeof filter.steps === "number" ? rollbackCandidates.slice(0, filter.steps) : rollbackCandidates;

  const availableMigrations = new Map(
    loadMigrations(connection.config.migrationsDir).map((migration) => [migration.version, migration])
  );

  for (const appliedMigration of migrationsToRollback) {
    const migration = availableMigrations.get(appliedMigration.version);

    if (!migration) {
      throw new Error(`Migration aplicada sem artefato local: ${appliedMigration.version}`);
    }

    runMigrationTransaction(connection.db, migration.downSql, () => {
      connection.db
        .prepare(
          `
            DELETE FROM schema_migrations
            WHERE version = :version
          `
        )
        .run({ version: appliedMigration.version });
    });
  }

  return getAppliedMigrations(connection);
}

export function withMigratedDatabase(config: DatabaseConfig): DatabaseConnection {
  const connection = openDatabaseConnection(config);
  migrateUp(connection);
  return connection;
}

function runMigrationTransaction(
  db: DatabaseConnection["db"],
  sql: string,
  afterExec: () => void
): void {
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(sql);
    afterExec();
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
