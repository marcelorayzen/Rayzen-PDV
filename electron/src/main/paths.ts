import fs from "node:fs";
import path from "node:path";

const DEFAULT_APP_DIRECTORY = "RayzenPDV";
const DEFAULT_DB_FILE_NAME = "rayzen-pdv.sqlite";

export interface MainProcessPaths {
  programDataRoot: string;
  appRoot: string;
  dataDir: string;
  configDir: string;
  logsDir: string;
  backupsDir: string;
  spoolDir: string;
  fiscalDir: string;
  fiscalEventsDir: string;
  fiscalDanfeDir: string;
  fiscalXmlDir: string;
  fiscalSecretsDir: string;
  dbFilePath: string;
  runtimeConfigFilePath: string;
}

export interface PathResolutionOptions {
  programDataRoot?: string;
  appDirectoryName?: string;
  dbFileName?: string;
}

export function resolveMainProcessPaths(options: PathResolutionOptions = {}): MainProcessPaths {
  const programDataRoot =
    options.programDataRoot ??
    process.env["ProgramData"] ??
    path.resolve(process.cwd(), ".rayzen-pdv");

  const appRoot = path.join(programDataRoot, options.appDirectoryName ?? DEFAULT_APP_DIRECTORY);
  const dataDir = path.join(appRoot, "data");
  const configDir = path.join(appRoot, "config");

  return {
    programDataRoot,
    appRoot,
    dataDir,
    configDir,
    logsDir: path.join(appRoot, "logs"),
    backupsDir: path.join(appRoot, "backups"),
    spoolDir: path.join(appRoot, "spool"),
    fiscalDir: path.join(appRoot, "fiscal"),
    fiscalEventsDir: path.join(appRoot, "fiscal", "events"),
    fiscalDanfeDir: path.join(appRoot, "fiscal", "danfe"),
    fiscalXmlDir: path.join(appRoot, "fiscal", "xml"),
    fiscalSecretsDir: path.join(appRoot, "fiscal", "secrets"),
    dbFilePath: path.join(dataDir, options.dbFileName ?? DEFAULT_DB_FILE_NAME),
    runtimeConfigFilePath: path.join(configDir, "runtime-config.json")
  };
}

export function ensureMainProcessPaths(paths: MainProcessPaths): void {
  fs.mkdirSync(paths.dataDir, { recursive: true });
  fs.mkdirSync(paths.configDir, { recursive: true });
  fs.mkdirSync(paths.logsDir, { recursive: true });
  fs.mkdirSync(paths.backupsDir, { recursive: true });
  fs.mkdirSync(paths.spoolDir, { recursive: true });
  fs.mkdirSync(paths.fiscalEventsDir, { recursive: true });
  fs.mkdirSync(paths.fiscalDanfeDir, { recursive: true });
  fs.mkdirSync(paths.fiscalXmlDir, { recursive: true });
  fs.mkdirSync(paths.fiscalSecretsDir, { recursive: true });
}
