import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createRayzenDatabaseClient, getSqliteSidecarPaths } from "@rayzen/db";

import type {
  BackupArtifactSnapshot,
  BackupListEntrySnapshot,
  BackupListRequest,
  CreateBackupRequest,
  CreateBackupResult,
  RestoreBackupRequest,
  RestoreBackupResult
} from "../../contracts/ipc.js";
import type { ElectronDatabaseService } from "../db-service.js";
import type { MainProcessLogStore } from "../log-store.js";
import { ensureMainProcessPaths, type MainProcessPaths } from "../paths.js";
import type { FirstRunSetupService } from "../setup/service.js";

interface SupportServiceOptions {
  appVersion: string;
  environment: string;
  setup: FirstRunSetupService;
}

interface BackupManifest {
  manifestVersion: 1;
  createdAt: string;
  appVersion: string;
  environment: string;
  databaseFileName: string;
  appliedMigrations: string[];
  artifacts: BackupArtifactSnapshot[];
}

export class OperationalSupportService {
  readonly #paths: MainProcessPaths;
  readonly #logger: MainProcessLogStore;
  readonly #database: ElectronDatabaseService;
  readonly #appVersion: string;
  readonly #environment: string;
  readonly #setup: FirstRunSetupService;

  constructor(
    paths: MainProcessPaths,
    logger: MainProcessLogStore,
    database: ElectronDatabaseService,
    options: SupportServiceOptions
  ) {
    this.#paths = paths;
    this.#logger = logger;
    this.#database = database;
    this.#appVersion = options.appVersion;
    this.#environment = options.environment;
    this.#setup = options.setup;
  }

  createBackup(request: CreateBackupRequest): CreateBackupResult {
    const createdAt = request.requestedAt;
    const destinationDir = request.destinationDir ?? this.#paths.backupsDir;

    if (!path.isAbsolute(destinationDir)) {
      throw new Error("destinationDir must be an absolute path.");
    }

    ensureMainProcessPaths(this.#paths);
    const backupDirectory = path.join(destinationDir, `rayzen-pdv-backup-${formatTimestamp(createdAt)}`);
    fs.mkdirSync(backupDirectory, { recursive: true });

    this.#database.client.auditEvents.append({
      eventId: `evt_support_backup_${sanitizeId(createdAt)}`,
      entity: "SUPPORT_OPERATION",
      entityId: backupDirectory,
      action: "SUPPORT_BACKUP_CREATED",
      actorUserId: request.actor?.userId ?? null,
      actorTerminalId: request.actor?.terminalId ?? null,
      actorRole: request.actor?.role ?? null,
      occurredAt: createdAt,
      payload: {
        backupDirectory,
        includeLogs: request.includeLogs ?? false
      }
    });
    this.#database.client.checkpoint("TRUNCATE");

    const artifacts: BackupArtifactSnapshot[] = [];
    const sqlitePaths = getSqliteSidecarPaths(this.#paths.dbFilePath);
    const databaseRelativeDir = path.join("data");

    for (let index = 0; index < sqlitePaths.length; index += 1) {
      const sourcePath = sqlitePaths[index];

      if (!sourcePath) {
        continue;
      }

      if (!fs.existsSync(sourcePath)) {
        continue;
      }

      const destinationPath = path.join(backupDirectory, databaseRelativeDir, path.basename(sourcePath));
      copyFileArtifact(sourcePath, destinationPath);
      artifacts.push({
        kind: index === 0 ? "DATABASE" : "SQLITE_SIDECAR",
        relativePath: path.relative(backupDirectory, destinationPath)
      });
    }

    const configRelativePath = path.join("config", "runtime-config.json");
    const configDestinationPath = path.join(backupDirectory, configRelativePath);
    const runtimeConfigSnapshot = this.#setup.readRuntimeConfigFile();
    writeJsonArtifact(configDestinationPath, runtimeConfigSnapshot ?? {
      appVersion: this.#appVersion,
      environment: this.#environment,
      createdAt,
      databaseFileName: path.basename(this.#paths.dbFilePath),
      paths: {
        dataDir: this.#paths.dataDir,
        configDir: this.#paths.configDir,
        logsDir: this.#paths.logsDir,
        backupsDir: this.#paths.backupsDir,
        spoolDir: this.#paths.spoolDir,
        fiscalDir: this.#paths.fiscalDir,
        fiscalEventsDir: this.#paths.fiscalEventsDir,
        fiscalDanfeDir: this.#paths.fiscalDanfeDir,
        fiscalXmlDir: this.#paths.fiscalXmlDir
      },
      appliedMigrations: this.#database.getAppliedMigrations().map((migration) => migration.version)
    });
    artifacts.push({
      kind: "CONFIG_EXPORT",
      relativePath: configRelativePath
    });

    this.#copyDirectoryIfPopulated(this.#paths.spoolDir, backupDirectory, "spool", "SPOOL_DIR", artifacts);
    this.#copyDirectoryIfPopulated(this.#paths.fiscalXmlDir, backupDirectory, path.join("fiscal", "xml"), "FISCAL_XML_DIR", artifacts);
    this.#copyDirectoryIfPopulated(this.#paths.fiscalDanfeDir, backupDirectory, path.join("fiscal", "danfe"), "FISCAL_DANFE_DIR", artifacts);
    this.#copyDirectoryIfPopulated(this.#paths.fiscalEventsDir, backupDirectory, path.join("fiscal", "events"), "FISCAL_EVENTS_DIR", artifacts);

    if (request.includeLogs ?? false) {
      const exportedLogs = this.#logger.exportLogs(backupDirectory);
      artifacts.push({
        kind: "LOG_EXPORT",
        relativePath: path.relative(backupDirectory, exportedLogs.exportDirectory)
      });
    }

    const manifest: BackupManifest = {
      manifestVersion: 1,
      createdAt,
      appVersion: this.#appVersion,
      environment: this.#environment,
      databaseFileName: path.basename(this.#paths.dbFilePath),
      appliedMigrations: this.#database.getAppliedMigrations().map((migration) => migration.version),
      artifacts
    };
    const manifestFilePath = path.join(backupDirectory, "backup-manifest.json");
    fs.writeFileSync(manifestFilePath, JSON.stringify(manifest, null, 2));

    this.#logger.info("electron.support.backup-created", {
      backupDirectory,
      artifacts: artifacts.length
    });

    return {
      backupDirectory,
      manifestFilePath,
      artifacts,
      createdAt
    };
  }

  restoreBackup(request: RestoreBackupRequest): RestoreBackupResult {
    if (!path.isAbsolute(request.backupDirectory)) {
      throw new Error("backupDirectory must be an absolute path.");
    }

    const manifestFilePath = path.join(request.backupDirectory, "backup-manifest.json");
    const manifest = readBackupManifest(manifestFilePath);
    const validation = validateBackupManifest(request.backupDirectory, manifest);

    if (!validation.restorable) {
      throw new Error(`Backup invalido para restore: ${validation.issues.join("; ")}`);
    }

    const runtimeDatabaseConfig = this.#database.client.config;
    this.#validateBackupDatabaseIntegrity(request.backupDirectory, manifest, runtimeDatabaseConfig);
    const restoredArtifacts: BackupArtifactSnapshot[] = [];

    this.#database.close();
    ensureMainProcessPaths(this.#paths);

    for (const filePath of getSqliteSidecarPaths(this.#paths.dbFilePath)) {
      fs.rmSync(filePath, { force: true });
    }

    emptyDirectory(this.#paths.spoolDir);
    emptyDirectory(this.#paths.fiscalXmlDir);
    emptyDirectory(this.#paths.fiscalDanfeDir);
    emptyDirectory(this.#paths.fiscalEventsDir);

    for (const artifact of manifest.artifacts) {
      const sourcePath = resolveBackupArtifactPath(request.backupDirectory, artifact.relativePath);

      switch (artifact.kind) {
        case "DATABASE":
        case "SQLITE_SIDECAR":
          copyFileArtifact(
            sourcePath,
            path.join(this.#paths.dataDir, resolveRuntimeDatabaseArtifactName(artifact, this.#paths.dbFilePath))
          );
          restoredArtifacts.push(artifact);
          break;
        case "CONFIG_EXPORT":
          copyFileArtifact(sourcePath, this.#paths.runtimeConfigFilePath);
          restoredArtifacts.push(artifact);
          break;
        case "SPOOL_DIR":
          copyDirectoryArtifact(sourcePath, this.#paths.spoolDir);
          restoredArtifacts.push(artifact);
          break;
        case "FISCAL_XML_DIR":
          copyDirectoryArtifact(sourcePath, this.#paths.fiscalXmlDir);
          restoredArtifacts.push(artifact);
          break;
        case "FISCAL_DANFE_DIR":
          copyDirectoryArtifact(sourcePath, this.#paths.fiscalDanfeDir);
          restoredArtifacts.push(artifact);
          break;
        case "FISCAL_EVENTS_DIR":
          copyDirectoryArtifact(sourcePath, this.#paths.fiscalEventsDir);
          restoredArtifacts.push(artifact);
          break;
        case "LOG_EXPORT":
          break;
      }
    }

    this.#database.start();
    const integrityCheck = assertSqliteIntegrity(this.#database.client.config);
    this.#database.client.auditEvents.append({
      eventId: `evt_support_restore_${sanitizeId(request.requestedAt)}`,
      entity: "SUPPORT_OPERATION",
      entityId: request.backupDirectory,
      action: "SUPPORT_RESTORE_COMPLETED",
      actorUserId: request.actor?.userId ?? null,
      actorTerminalId: request.actor?.terminalId ?? null,
      actorRole: request.actor?.role ?? null,
      occurredAt: request.requestedAt,
      payload: {
        restoredArtifacts: restoredArtifacts.map((artifact) => artifact.kind),
        backupCreatedAt: manifest.createdAt
      }
    });

    this.#logger.info("electron.support.restore-completed", {
      backupDirectory: request.backupDirectory,
      restoredArtifacts: restoredArtifacts.length
    });

    return {
      backupDirectory: request.backupDirectory,
      manifestFilePath,
      restoredArtifacts,
      restoredAt: request.requestedAt,
      databaseReady: this.#database.isReady(),
      integrityCheck,
      requiresRestart: true
    };
  }

  listBackups(request?: BackupListRequest): BackupListEntrySnapshot[] {
    const directory = request?.directory ?? this.#paths.backupsDir;

    if (!path.isAbsolute(directory)) {
      throw new Error("directory must be an absolute path.");
    }

    if (!fs.existsSync(directory)) {
      return [];
    }

    return fs.readdirSync(directory, {
      withFileTypes: true
    })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(directory, entry.name))
      .map((backupDirectory) => {
        const manifestFilePath = path.join(backupDirectory, "backup-manifest.json");

        if (!fs.existsSync(manifestFilePath)) {
          return {
            backupDirectory,
            manifestFilePath,
            createdAt: "",
            appVersion: "",
            environment: "",
            artifactCount: 0,
            databaseFileName: "",
            restorable: false,
            issues: ["backup-manifest.json ausente."]
          } satisfies BackupListEntrySnapshot;
        }

        try {
          const manifest = readBackupManifest(manifestFilePath);
          const validation = validateBackupManifest(backupDirectory, manifest);

          return {
            backupDirectory,
            manifestFilePath,
            createdAt: manifest.createdAt,
            appVersion: manifest.appVersion,
            environment: manifest.environment,
            artifactCount: manifest.artifacts.length,
            databaseFileName: manifest.databaseFileName,
            restorable: validation.restorable,
            issues: validation.issues
          } satisfies BackupListEntrySnapshot;
        } catch (error) {
          return {
            backupDirectory,
            manifestFilePath,
            createdAt: "",
            appVersion: "",
            environment: "",
            artifactCount: 0,
            databaseFileName: "",
            restorable: false,
            issues: [error instanceof Error ? error.message : "Falha ao ler manifesto do backup."]
          } satisfies BackupListEntrySnapshot;
        }
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  #copyDirectoryIfPopulated(
    sourceDir: string,
    backupDirectory: string,
    relativePath: string,
    kind: BackupArtifactSnapshot["kind"],
    artifacts: BackupArtifactSnapshot[]
  ): void {
    if (!directoryHasContent(sourceDir)) {
      return;
    }

    const destinationPath = path.join(backupDirectory, relativePath);
    copyDirectoryArtifact(sourceDir, destinationPath);
    artifacts.push({
      kind,
      relativePath
    });
  }

  #validateBackupDatabaseIntegrity(
    backupDirectory: string,
    manifest: BackupManifest,
    runtimeDatabaseConfig: Parameters<typeof createRayzenDatabaseClient>[0]
  ): void {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rayzen-backup-validate-"));

    try {
      const stagedDbPath = path.join(tempRoot, path.basename(this.#paths.dbFilePath));

      for (const artifact of manifest.artifacts) {
        if (artifact.kind !== "DATABASE" && artifact.kind !== "SQLITE_SIDECAR") {
          continue;
        }

        const sourcePath = resolveBackupArtifactPath(backupDirectory, artifact.relativePath);
        copyFileArtifact(sourcePath, path.join(tempRoot, resolveRuntimeDatabaseArtifactName(artifact, stagedDbPath)));
      }

      assertSqliteIntegrity({
        ...runtimeDatabaseConfig,
        filePath: stagedDbPath
      });
    } finally {
      safeRemoveDirectory(tempRoot);
    }
  }
}

function directoryHasContent(directoryPath: string): boolean {
  return fs.existsSync(directoryPath) && fs.readdirSync(directoryPath).length > 0;
}

function emptyDirectory(directoryPath: string): void {
  fs.mkdirSync(directoryPath, { recursive: true });

  for (const entry of fs.readdirSync(directoryPath)) {
    fs.rmSync(path.join(directoryPath, entry), {
      recursive: true,
      force: true
    });
  }
}

function copyFileArtifact(sourcePath: string, destinationPath: string): void {
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(sourcePath, destinationPath);
}

function copyDirectoryArtifact(sourceDir: string, destinationDir: string): void {
  fs.mkdirSync(path.dirname(destinationDir), { recursive: true });
  fs.cpSync(sourceDir, destinationDir, {
    recursive: true,
    force: true
  });
}

function writeJsonArtifact(destinationPath: string, payload: unknown): void {
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.writeFileSync(destinationPath, JSON.stringify(payload, null, 2));
}

function readBackupManifest(manifestFilePath: string): BackupManifest {
  if (!fs.existsSync(manifestFilePath)) {
    throw new Error("backup-manifest.json nao encontrado no diretorio informado.");
  }

  return JSON.parse(fs.readFileSync(manifestFilePath, "utf8")) as BackupManifest;
}

function validateBackupManifest(
  backupDirectory: string,
  manifest: BackupManifest
): { restorable: boolean; issues: string[] } {
  const issues: string[] = [];

  if (manifest.manifestVersion !== 1 && typeof manifest.manifestVersion !== "undefined") {
    issues.push("manifestVersion invalida.");
  }

  if (!manifest.createdAt) {
    issues.push("createdAt ausente.");
  }

  if (!manifest.databaseFileName) {
    issues.push("databaseFileName ausente.");
  }

  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0) {
    issues.push("artifacts ausentes.");
  }

  if (!manifest.artifacts.some((artifact) => artifact.kind === "DATABASE")) {
    issues.push("artefato DATABASE ausente.");
  }

  for (const artifact of manifest.artifacts ?? []) {
    if (!artifact.relativePath || path.isAbsolute(artifact.relativePath)) {
      issues.push(`relativePath invalido para ${artifact.kind}.`);
      continue;
    }

    if (artifact.relativePath.includes("..")) {
      issues.push(`relativePath inseguro para ${artifact.kind}.`);
      continue;
    }

    if (artifact.relativePath.toLowerCase().includes("secrets")) {
      issues.push("backup nao pode incluir segredos protegidos.");
      continue;
    }

    const sourcePath = resolveBackupArtifactPath(backupDirectory, artifact.relativePath);

    if (!fs.existsSync(sourcePath)) {
      issues.push(`artefato ausente: ${artifact.relativePath}.`);
    }
  }

  return {
    restorable: issues.length === 0,
    issues
  };
}

function resolveBackupArtifactPath(backupDirectory: string, relativePath: string): string {
  const resolvedPath = path.resolve(backupDirectory, relativePath);
  const normalizedRoot = `${path.resolve(backupDirectory)}${path.sep}`;

  if (!resolvedPath.startsWith(normalizedRoot) && resolvedPath !== path.resolve(backupDirectory)) {
    throw new Error(`Artefato fora do pacote de backup: ${relativePath}`);
  }

  return resolvedPath;
}

function resolveRuntimeDatabaseArtifactName(
  artifact: BackupArtifactSnapshot,
  runtimeDbFilePath: string
): string {
  const runtimeDbFileName = path.basename(runtimeDbFilePath);

  if (artifact.kind === "DATABASE") {
    return runtimeDbFileName;
  }

  const sidecarSuffix = path.extname(artifact.relativePath);

  if (artifact.relativePath.endsWith("-wal")) {
    return `${runtimeDbFileName}-wal`;
  }

  if (artifact.relativePath.endsWith("-shm")) {
    return `${runtimeDbFileName}-shm`;
  }

  return `${runtimeDbFileName}${sidecarSuffix}`;
}

function assertSqliteIntegrity(config: Parameters<typeof createRayzenDatabaseClient>[0]): "ok" {
  const client = createRayzenDatabaseClient(config);

  try {
    const row = client.raw.prepare("PRAGMA integrity_check").get() as { integrity_check?: string };

    if (row.integrity_check !== "ok") {
      throw new Error(`Falha no integrity_check do SQLite: ${row.integrity_check ?? "resultado desconhecido"}`);
    }

    return "ok";
  } finally {
    client.close();
  }
}

function safeRemoveDirectory(targetPath: string): void {
  fs.rmSync(targetPath, {
    recursive: true,
    force: true
  });
}

function formatTimestamp(value: string): string {
  return value.replaceAll(":", "-");
}

function sanitizeId(value: string): string {
  return value.replace(/[^0-9A-Za-z]/g, "");
}
