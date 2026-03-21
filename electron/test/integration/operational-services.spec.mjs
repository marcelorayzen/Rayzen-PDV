import { describe, test } from "@jest/globals";

import {
  runFiscalContingencyScenario,
  runFiscalServiceScenario,
  runIpcScenario,
  runPreloadScenario,
  runPrintServiceScenario,
  runSupportServiceScenario
} from "../run-electron-main-tests.mjs";

describe("@rayzen/electron integration", () => {
  test("processes production tickets through the print spool service", () => {
    runPrintServiceScenario();
  });

  test("processes the fiscal queue in normal mode", async () => {
    await runFiscalServiceScenario();
  });

  test("handles fiscal contingency, reenvio and query by access key", async () => {
    await runFiscalContingencyScenario();
  });

  test("creates and restores operational backups", () => {
    runSupportServiceScenario();
  });

  test("exposes runtime services through IPC", async () => {
    await runIpcScenario();
  });

  test("exposes the preload API contract", async () => {
    await runPreloadScenario();
  });
});
