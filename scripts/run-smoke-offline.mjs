#!/usr/bin/env node

import {
  runCashControllerScenario,
  runComandaLifecycleScenario,
  runControllerScenario
} from "../apps/pdv/test/run-pdv-shell-tests.mjs";
import {
  runIpcScenario,
  runPrintServiceScenario
} from "../electron/test/run-electron-main-tests.mjs";

await runControllerScenario();
runComandaLifecycleScenario();
await runCashControllerScenario();
runPrintServiceScenario();
await runIpcScenario();

console.log("[qa/smoke-offline] 5 runtime checks passed.");
