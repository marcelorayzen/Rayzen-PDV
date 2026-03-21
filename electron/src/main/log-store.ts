import fs from "node:fs";
import path from "node:path";

import type { ExportLogsResult } from "../contracts/ipc.js";

const LOG_FILE_NAME = "main.log";
const SENSITIVE_KEY_PATTERN = /(cpf|telefone|phone|email|secret|token|password|senha|certificate|certificado|csc)/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const CPF_PATTERN = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const PHONE_PATTERN = /(?<!\d)(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9?\d{4})-?\d{4}(?!\d)/g;
const LEVEL_PRIORITY = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
} as const;

export type LogLevel = keyof typeof LEVEL_PRIORITY;

export interface LogStoreOptions {
  logsDir: string;
  appVersion: string;
  environment: string;
  level?: LogLevel;
}

export type LogContextValue =
  | string
  | number
  | boolean
  | null
  | LogContextValue[]
  | { [key: string]: LogContextValue };

export class MainProcessLogStore {
  readonly #logsDir: string;
  readonly #logFilePath: string;
  readonly #appVersion: string;
  readonly #environment: string;
  readonly #minimumLevel: LogLevel;

  constructor(options: LogStoreOptions) {
    this.#logsDir = options.logsDir;
    this.#logFilePath = path.join(options.logsDir, LOG_FILE_NAME);
    this.#appVersion = options.appVersion;
    this.#environment = options.environment;
    this.#minimumLevel = options.level ?? "info";

    fs.mkdirSync(this.#logsDir, { recursive: true });
  }

  get logFilePath(): string {
    return this.#logFilePath;
  }

  debug(message: string, context?: Record<string, LogContextValue>): void {
    this.log("debug", message, context);
  }

  info(message: string, context?: Record<string, LogContextValue>): void {
    this.log("info", message, context);
  }

  warn(message: string, context?: Record<string, LogContextValue>): void {
    this.log("warn", message, context);
  }

  error(message: string, context?: Record<string, LogContextValue>): void {
    this.log("error", message, context);
  }

  exportLogs(destinationDir: string): ExportLogsResult {
    if (!path.isAbsolute(destinationDir)) {
      throw new Error("destinationDir must be an absolute path.");
    }

    const exportDirectory = path.join(destinationDir, `rayzen-pdv-logs-${formatTimestamp(new Date())}`);
    fs.mkdirSync(exportDirectory, { recursive: true });

    const logFiles = fs
      .readdirSync(this.#logsDir)
      .filter((fileName) => fileName.endsWith(".log"))
      .map((fileName) => {
        const sourcePath = path.join(this.#logsDir, fileName);
        const destinationPath = path.join(exportDirectory, fileName);
        const redactedContents = redactText(fs.readFileSync(sourcePath, "utf8"));
        fs.writeFileSync(destinationPath, redactedContents);
        return destinationPath;
      });

    const manifestFilePath = path.join(exportDirectory, "manifest.json");
    fs.writeFileSync(
      manifestFilePath,
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          appVersion: this.#appVersion,
          environment: this.#environment,
          redactionApplied: true,
          logFiles
        },
        null,
        2
      )
    );

    return {
      exportDirectory,
      manifestFilePath,
      logFiles
    };
  }

  private log(level: LogLevel, message: string, context?: Record<string, LogContextValue>): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.#minimumLevel]) {
      return;
    }

    const entry = {
      at: new Date().toISOString(),
      service: "electron-main",
      level,
      message,
      context: sanitizeContext(context ?? {}),
      appVersion: this.#appVersion,
      environment: this.#environment
    };

    fs.appendFileSync(this.#logFilePath, `${JSON.stringify(entry)}\n`);
  }
}

function sanitizeContext(value: LogContextValue): LogContextValue {
  if (Array.isArray(value)) {
    return value.map(sanitizeContext);
  }

  if (value && typeof value === "object") {
    const sanitizedEntries = Object.entries(value).map(([key, nestedValue]) => {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        return [key, "[REDACTED]"] as const;
      }

      return [key, sanitizeContext(nestedValue)] as const;
    });

    return Object.fromEntries(sanitizedEntries);
  }

  if (typeof value === "string") {
    return redactText(value);
  }

  return value;
}

function redactText(value: string): string {
  return value
    .replace(EMAIL_PATTERN, "[REDACTED_EMAIL]")
    .replace(CPF_PATTERN, "[REDACTED_CPF]")
    .replace(PHONE_PATTERN, "[REDACTED_PHONE]");
}

function formatTimestamp(date: Date): string {
  return date.toISOString().replaceAll(":", "-");
}
