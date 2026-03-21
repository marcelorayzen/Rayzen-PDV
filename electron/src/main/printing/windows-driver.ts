import { spawnSync } from "node:child_process";

export interface DriverPrinterSnapshot {
  printerId: string;
  printerName: string;
  isOffline: boolean;
  isAvailable: boolean;
  status: string | null;
}

export interface DriverPrintRequest {
  printerName: string;
  ticketFilePath: string;
}

export interface DriverPrintSuccess {
  ok: true;
}

export interface DriverPrintFailure {
  ok: false;
  code: "PRINTER_OFFLINE" | "PRINTER_NOT_FOUND" | "OUT_OF_PAPER" | "DRIVER_PRINT_FAILED";
  message: string;
  retryable: boolean;
}

export type DriverPrintResult = DriverPrintSuccess | DriverPrintFailure;

export interface CommandRunResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export interface CommandRunner {
  run(command: string, args: string[]): CommandRunResult;
}

export interface ThermalPrinterDriver {
  listPrinters(): DriverPrinterSnapshot[];
  printText(request: DriverPrintRequest): DriverPrintResult;
}

export class WindowsThermalPrinterDriver implements ThermalPrinterDriver {
  readonly #runner: CommandRunner;

  constructor(runner: CommandRunner = createSpawnSyncRunner()) {
    this.#runner = runner;
  }

  listPrinters(): DriverPrinterSnapshot[] {
    const result = this.#runner.run("powershell.exe", [
      "-NoProfile",
      "-Command",
      "Get-Printer | Select-Object Name,PrinterStatus,WorkOffline | ConvertTo-Json -Compress"
    ]);

    if (result.exitCode !== 0 || !result.stdout.trim()) {
      return [];
    }

    const parsed = JSON.parse(result.stdout) as
      | { Name?: string; PrinterStatus?: string | number; WorkOffline?: boolean }
      | Array<{ Name?: string; PrinterStatus?: string | number; WorkOffline?: boolean }>;
    const entries = Array.isArray(parsed) ? parsed : [parsed];

    return entries
      .filter((entry) => typeof entry.Name === "string" && entry.Name.trim().length > 0)
      .map((entry) => {
        const printerName = entry.Name!.trim();
        const printerStatus = entry.PrinterStatus == null ? null : String(entry.PrinterStatus);
        const isOffline = entry.WorkOffline === true || printerStatus === "Offline";

        return {
          printerId: printerName,
          printerName,
          isOffline,
          isAvailable: !isOffline,
          status: printerStatus
        };
      });
  }

  printText(request: DriverPrintRequest): DriverPrintResult {
    const command = [
      "$content = Get-Content -Raw -LiteralPath",
      quotePowerShellLiteral(request.ticketFilePath),
      ";",
      "$content | Out-Printer -Name",
      quotePowerShellLiteral(request.printerName)
    ].join(" ");

    const result = this.#runner.run("powershell.exe", [
      "-NoProfile",
      "-Command",
      command
    ]);

    if (result.exitCode === 0) {
      return { ok: true };
    }

    const errorText = `${result.stderr}\n${result.stdout}`.trim();
    const normalized = errorText.toLowerCase();

    if (normalized.includes("offline") || normalized.includes("indispon")) {
      return {
        ok: false,
        code: "PRINTER_OFFLINE",
        message: errorText || "Impressora offline no driver do Windows.",
        retryable: true
      };
    }

    if (normalized.includes("paper") || normalized.includes("papel")) {
      return {
        ok: false,
        code: "OUT_OF_PAPER",
        message: errorText || "Impressora sem papel.",
        retryable: false
      };
    }

    if (normalized.includes("cannot find") || normalized.includes("nao foi encontrado")) {
      return {
        ok: false,
        code: "PRINTER_NOT_FOUND",
        message: errorText || "Impressora nao encontrada no Windows.",
        retryable: true
      };
    }

    return {
      ok: false,
      code: "DRIVER_PRINT_FAILED",
      message: errorText || "Falha ao imprimir pelo driver do Windows.",
      retryable: true
    };
  }
}

export function createSpawnSyncRunner(): CommandRunner {
  return {
    run(command, args) {
      const result = spawnSync(command, args, {
        encoding: "utf8",
        windowsHide: true
      });

      return {
        exitCode: result.status,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? ""
      };
    }
  };
}

function quotePowerShellLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
